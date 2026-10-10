import { type Request, type Response } from "express";
import mongoose from "mongoose";

import User from "../models/User.js";
import Remittance, { type IRemittance } from "../models/Remittance.js";
import AuditLog from "../models/AuditLog.js";
import Payout from "../models/Payout.js";
import Dispute from "../models/Dispute.js";

import { generateTransactionHash } from "../utils/hashTransaction.js";
import {
  anchorTransactionHash,
  verifyBlockchainTransaction,
  type BlockchainStatus,
} from "../services/blockchainService.js";

import {
  escapeRegExp,
  isNonEmptyString,
  isValidObjectId,
  moneyEquals,
  roundMoney,
  toFiniteNumber,
} from "../utils/validation.js";

import { isStaffRole, requireUser } from "../types/auth.js";

// =====================================================
// HELPERS
// =====================================================

type Party = { _id?: unknown } | string | null | undefined;

const idOf = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value ?? "");
};

const fail = (
  res: Response,
  status: number,
  message: string,
  extra: Record<string, unknown> = {},
): void => {
  res.status(status).json({ success: false, message, ...extra });
};

/**
 * Writes one audit entry. The actor's IP is recorded so the trail identifies
 * who acted and from where.
 */
const recordAudit = async (entry: {
  req: Request;
  actorId: string;
  remittance: mongoose.Types.ObjectId;
  action:
    | "created"
    | "approved"
    | "processing"
    | "ready_for_payout"
    | "payout_completed"
    | "error_reported"
    | "investigation_started"
    | "recovery_requested"
    | "dispute_resolved"
    | "blockchain_committed";
  description: string;
  previousStatus?: string;
  newStatus?: string;
}): Promise<void> => {
  await AuditLog.create({
    remittance: entry.remittance,
    actor: new mongoose.Types.ObjectId(entry.actorId),
    action: entry.action,
    ...(entry.description !== undefined
      ? { description: entry.description }
      : {}),
    ...(entry.previousStatus !== undefined
      ? { previousStatus: entry.previousStatus }
      : {}),
    ...(entry.newStatus !== undefined ? { newStatus: entry.newStatus } : {}),
    ...(entry.req.ip ? { ipAddress: entry.req.ip } : {}),
  });
};

// =====================================================
// SNAPSHOT / HASHING
// =====================================================
//
// The exact shape that is hashed and anchored to Solana. Commit and verify
// both go through here so the bytes are guaranteed identical.
// =====================================================

const buildRemittanceSnapshot = (remittance: {
  transactionId: string;
  sender: unknown;
  receiver: unknown;
  authorizedAmount: number;
  sendingCurrency: string;
  exchangeRate: number;
  fee: number;
  expectedPayout: number;
  actualPayout?: number;
  payoutCurrency: string;
  payoutMethod: string;
  payoutBank?: string;
  status: string;
}) => ({
  transactionId: remittance.transactionId,
  sender: idOf(remittance.sender),
  receiver: idOf(remittance.receiver),
  authorizedAmount: remittance.authorizedAmount,
  sendingCurrency: remittance.sendingCurrency,
  exchangeRate: remittance.exchangeRate,
  fee: remittance.fee,
  expectedPayout: remittance.expectedPayout,
  actualPayout: remittance.actualPayout ?? null,
  payoutCurrency: remittance.payoutCurrency,
  payoutMethod: remittance.payoutMethod,
  ...(remittance.payoutBank ? { payoutBank: remittance.payoutBank } : {}),
  status: remittance.status,
});

/**
 * The subset of a record that must never change after it is anchored.
 *
 * `status` is deliberately excluded: a completed remittance can legitimately
 * move into the dispute flow (investigation -> recovery -> recovered) *after*
 * it was committed. Hashing status into the "live" comparison meant every
 * recovered transaction permanently reported itself as tampered with.
 *
 * Key order is inherited from `buildRemittanceSnapshot`, so hashing the stored
 * snapshot and hashing the live document produce byte-identical input.
 */
const omitStatus = (snapshot: object): Record<string, unknown> => {
  const { status: _status, ...immutable } = snapshot as Record<string, unknown>;

  return immutable;
};

const STAFF_ONLY_FIELDS = "-blockchainSnapshot";

// Mongoose 9 does not export its `QueryFilter` type, so the filter is built as
// a plain record and narrowed to `object` at the call sites (see `as object`
// below). `object` — unlike `Record<string, unknown>` — is assignable to the
// model's filter parameter without an index signature conflict.
type RemittanceFilter = Record<string, unknown>;

// Staff see the operational fields they need to pay someone out. Customers
// only ever get the counterparty's public identity — never their email.
const partyProjection = (viewerIsStaff: boolean) =>
  viewerIsStaff
    ? "name phone remitId country verificationStatus"
    : "name remitId";

// =====================================================
// LIST REMITTANCES
// =====================================================

export const getRemittances = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId, userRole } = requireUser(req);
    const staff = isStaffRole(userRole);

    // Typed as a Mongoose filter so the `$or` search and the ownership clause
    // stay type-checked against the schema.
    // Staff see the whole book; customers are pinned to their own side and can
    // never widen that scope with query parameters.
    const query: RemittanceFilter = {};

    if (!staff) {
      if (userRole === "sender") {
        query.sender = userId;
      } else if (userRole === "receiver") {
        query.receiver = userId;
      } else {
        fail(res, 403, "You are not authorized to view remittances");
        return;
      }
    }

    // Optional filters. Ownership is always ANDed on top, so a sender cannot
    // widen their scope by passing their own status/search.
    const { status, search } = req.query as {
      status?: string;
      search?: string;
    };

    if (isNonEmptyString(status)) {
      query.status = status as IRemittance["status"];
    }

    if (isNonEmptyString(search)) {
      const pattern = new RegExp(escapeRegExp(search.trim()), "i");

      query.$or = [
        { transactionId: pattern },
        { transactionHash: pattern },
        { "sender.name": pattern },
        { "receiver.name": pattern },
        { "sender.remitId": pattern },
        { "receiver.remitId": pattern },
      ];
    }

    const remittances = await Remittance.find(query as object)
      .select(STAFF_ONLY_FIELDS)
      .populate("sender", partyProjection(staff))
      .populate("receiver", partyProjection(staff))
      .sort({ createdAt: -1 })
      .limit(500);

    res.status(200).json({
      success: true,
      count: remittances.length,
      remittances,
    });
  } catch (error) {
    console.error("Get remittances error:", error);

    fail(res, 500, "Failed to get remittances");
  }
};

// =====================================================
// DASHBOARD STATS
// =====================================================

const IN_FLIGHT_STATUSES = [
  "created",
  "verified",
  "approved",
  "processing",
  "ready_for_payout",
] as const;

const DISPUTE_STATUSES = [
  "error_reported",
  "investigation",
  "recovery_requested",
] as const;

export const getRemittanceStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId, userRole } = requireUser(req);
    const staff = isStaffRole(userRole);

    // Customers get counters for their own side of the book, which is what
    // their dashboard shows.
    const scope: RemittanceFilter = staff
      ? {}
      : userRole === "sender"
        ? { sender: userId }
        : { receiver: userId };

    const [total, completed, pending, disputes, recovered, blockchainVerified] =
      await Promise.all([
        Remittance.countDocuments(scope as object),
        Remittance.countDocuments({
          ...scope,
          status: "completed",
        } as object),
        Remittance.countDocuments({
          ...scope,
          status: { $in: IN_FLIGHT_STATUSES },
        } as object),
        Remittance.countDocuments({
          ...scope,
          status: { $in: DISPUTE_STATUSES },
        } as object),
        Remittance.countDocuments({
          ...scope,
          status: "recovered",
        } as object),
        Remittance.countDocuments({
          ...scope,
          blockchainTxSignature: { $exists: true, $ne: "" },
        } as object),
      ]);

    res.status(200).json({
      success: true,
      scope: staff ? "system" : "own",
      stats: {
        total,
        completed,
        pending,
        disputes,
        recovered,
        blockchainVerified,
      },
    });
  } catch (error) {
    console.error("Get remittance statistics error:", error);

    fail(res, 500, "Failed to get dashboard statistics");
  }
};

// =====================================================
// FIND RECEIVER
// =====================================================

export const findReceiver = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { remitId, phone } = req.query as {
      remitId?: string;
      phone?: string;
    };

    if (!isNonEmptyString(remitId) && !isNonEmptyString(phone)) {
      fail(res, 400, "Provide remitId or phone");
      return;
    }

    const query: Record<string, unknown> = {};

    if (isNonEmptyString(remitId)) {
      query.remitId = remitId.trim().toUpperCase();
    }

    if (isNonEmptyString(phone)) {
      query.phone = phone.trim();
    }

    const receiver = await User.findOne(query).select(
      "name phone country remitId role verificationStatus isActive preferredPayoutMethod",
    );

    if (!receiver) {
      fail(res, 404, "Receiver not found");
      return;
    }

    if (receiver.role !== "receiver") {
      fail(res, 400, "This user cannot receive remittances");
      return;
    }

    if (!receiver.isActive) {
      fail(res, 400, "Receiver account is disabled");
      return;
    }

    if (receiver.verificationStatus !== "verified") {
      fail(res, 400, "Receiver is not verified");
      return;
    }

    res.status(200).json({
      success: true,
      receiver: {
        id: receiver._id,
        name: receiver.name,
        phone: receiver.phone,
        country: receiver.country,
        remitId: receiver.remitId,
        verificationStatus: receiver.verificationStatus,
        preferredPayoutMethod: receiver.preferredPayoutMethod,
      },
    });
  } catch (error) {
    console.error("Find receiver error:", error);

    fail(res, 500, "Server error while finding receiver");
  }
};

// =====================================================
// CREATE REMITTANCE
// =====================================================

const PAYOUT_METHODS = ["bank", "wallet", "cash"] as const;
const PAYOUT_BANKS = [
  "Nabil Bank",
  "Global IME Bank",
  "NIC Asia Bank",
  "Agricultural Development Bank",
] as const;

type PayoutMethod = (typeof PAYOUT_METHODS)[number];

const isPayoutMethod = (value: unknown): value is PayoutMethod =>
  typeof value === "string" &&
  (PAYOUT_METHODS as readonly string[]).includes(value);

const isPayoutBank = (value: unknown): value is (typeof PAYOUT_BANKS)[number] =>
  typeof value === "string" &&
  (PAYOUT_BANKS as readonly string[]).includes(value.trim());

export const createRemittance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId: actorId, userRole } = requireUser(req);
    const staff = isStaffRole(userRole);

    const body = req.body as Record<string, unknown>;

    const {
      receiverRemitId,
      amount: rawAmount,
      sendingCurrency: rawCurrency,
      exchangeRate: rawRate,
      fee: rawFee,
      payoutMethod,
      payoutBank: rawPayoutBank,
    } = body;

    // ---- Numeric validation -------------------------------------------
    // Coerce first, then range-check. The previous code compared raw values,
    // so a non-numeric body slipped through and produced NaN payouts.
    const amount = toFiniteNumber(rawAmount);
    const exchangeRate = toFiniteNumber(rawRate);
    const fee = rawFee === undefined ? 0 : toFiniteNumber(rawFee);

    if (amount === null) {
      fail(res, 400, "Amount must be a number");
      return;
    }

    if (exchangeRate === null) {
      fail(res, 400, "Exchange rate must be a number");
      return;
    }

    if (fee === null) {
      fail(res, 400, "Fee must be a number");
      return;
    }

    if (amount <= 0) {
      fail(res, 400, "Amount must be greater than zero");
      return;
    }

    if (exchangeRate <= 0) {
      fail(res, 400, "Exchange rate must be greater than zero");
      return;
    }

    if (fee < 0) {
      fail(res, 400, "Fee cannot be negative");
      return;
    }

    // ---- Field validation ---------------------------------------------
    if (!isNonEmptyString(receiverRemitId)) {
      fail(res, 400, "receiverRemitId is required");
      return;
    }

    if (!isNonEmptyString(rawCurrency)) {
      fail(res, 400, "sendingCurrency is required");
      return;
    }

    if (!isPayoutMethod(payoutMethod)) {
      fail(res, 400, "Invalid payout method. Use bank, wallet or cash");
      return;
    }

    const payoutBank =
      payoutMethod === "bank" && isPayoutBank(rawPayoutBank)
        ? rawPayoutBank.trim()
        : undefined;

    if (payoutMethod === "bank" && !payoutBank) {
      fail(res, 400, "Choose a valid receiving bank");
      return;
    }

    // A sender always transacts on the online channel. Only operations staff
    // can log a branch/physical remittance, and then the channel is forced.
    const channel: IRemittance["channel"] = staff
      ? body.channel === "online"
        ? "online"
        : "agent"
      : "online";

    // ---- Party resolution ---------------------------------------------
    // `sender` is a required field, so the sender must be resolved explicitly.
    // A sender is always themselves; staff must name the customer they are
    // acting for, because a remittance can never be attributed to the agent.
    let sender;

    if (userRole === "sender") {
      sender = await User.findById(actorId).select("_id verificationStatus");
    } else {
      if (!isNonEmptyString(body.senderRemitId)) {
        fail(
          res,
          400,
          "senderRemitId is required when staff create a remittance on a customer's behalf",
        );
        return;
      }

      sender = await User.findOne({
        remitId: body.senderRemitId.trim().toUpperCase(),
        role: "sender",
      }).select("_id verificationStatus");
    }

    if (!sender) {
      fail(res, 404, "Sender not found");
      return;
    }

    if (sender.verificationStatus !== "verified") {
      fail(
        res,
        403,
        "Sender identity is not verified. An administrator must verify the account before money can be sent.",
      );
      return;
    }

    const receiver = await User.findOne({
      remitId: receiverRemitId.trim().toUpperCase(),
      role: "receiver",
    });

    if (!receiver) {
      fail(res, 404, "Receiver not found");
      return;
    }

    if (!receiver.isActive) {
      fail(res, 400, "Receiver account is disabled");
      return;
    }

    if (receiver.verificationStatus !== "verified") {
      fail(res, 403, "Receiver identity is not verified");
      return;
    }

    if (String(sender._id) === String(receiver._id)) {
      fail(res, 400, "Sender and receiver cannot be the same user");
      return;
    }

    // ---- Money --------------------------------------------------------
    // Round once, at creation. Unrounded floats are what made the later
    // `actualPayout === expectedPayout` comparison fail for correct payouts.
    const expectedPayout = roundMoney(amount * exchangeRate - fee);

    if (expectedPayout <= 0) {
      fail(res, 400, "Fee is too high compared to the transaction amount");
      return;
    }

    // ---- Persist ------------------------------------------------------
    // Derive the public id from the document's own ObjectId: unique by
    // construction, unlike Date.now() + 3 random digits.
    const documentId = new mongoose.Types.ObjectId();

    const remittance = await Remittance.create({
      _id: documentId,
      transactionId: `REM-${documentId.toString().toUpperCase()}`,
      sender: sender._id,
      receiver: receiver._id,
      createdBy: actorId,
      channel,
      authorizedAmount: roundMoney(amount),
      sendingCurrency: String(rawCurrency).toUpperCase(),
      exchangeRate,
      fee: roundMoney(fee),
      expectedPayout,
      payoutCurrency: "NPR",
      payoutMethod,
      ...(payoutBank ? { payoutBank } : {}),
      status: "created",
    });

    await recordAudit({
      req,
      actorId,
      remittance: remittance._id,
      action: "created",
      description: `Remittance created by ${userRole}`,
      newStatus: "created",
    });

    res.status(201).json({
      success: true,
      message: "Remittance created successfully",
      remittance: {
        id: remittance._id,
        transactionId: remittance.transactionId,
        sender: { id: remittance.sender, remitId: null },
        receiver: {
          id: receiver._id,
          name: receiver.name,
          remitId: receiver.remitId,
        },
        authorizedAmount: remittance.authorizedAmount,
        sendingCurrency: remittance.sendingCurrency,
        exchangeRate: remittance.exchangeRate,
        fee: remittance.fee,
        expectedPayout: remittance.expectedPayout,
        payoutCurrency: remittance.payoutCurrency,
        payoutMethod: remittance.payoutMethod,
        ...(remittance.payoutBank ? { payoutBank: remittance.payoutBank } : {}),
        channel: remittance.channel,
        status: remittance.status,
        createdAt: remittance.createdAt,
      },
    });
  } catch (error) {
    console.error("Create remittance error:", error);

    fail(res, 500, "Server error while creating remittance");
  }
};

// =====================================================
// GET ONE REMITTANCE
// =====================================================

export const getRemittanceById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId, userRole } = requireUser(req);
    const { id } = req.params as { id?: string };

    if (!isValidObjectId(id)) {
      fail(res, 400, "Invalid remittance id");
      return;
    }

    const remittance = await Remittance.findById(id)
      .select(STAFF_ONLY_FIELDS)
      .populate("sender", partyProjection(isStaffRole(userRole)))
      .populate("receiver", partyProjection(isStaffRole(userRole)));

    if (!remittance) {
      fail(res, 404, "Remittance not found");
      return;
    }

    const isParticipant =
      idOf(remittance.sender) === userId ||
      idOf(remittance.receiver) === userId;

    if (!isStaffRole(userRole) && !isParticipant) {
      fail(res, 403, "You are not authorized to view this remittance");
      return;
    }

    res.status(200).json({
      success: true,
      remittance,
    });
  } catch (error) {
    console.error("Get remittance error:", error);

    fail(res, 500, "Failed to get remittance");
  }
};

// =====================================================
// APPROVE
// =====================================================

export const approveRemittance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = requireUser(req);
    const { id } = req.params as { id?: string };

    if (!isValidObjectId(id)) {
      fail(res, 400, "Invalid remittance id");
      return;
    }

    const remittance = await Remittance.findById(id);

    if (!remittance) {
      fail(res, 404, "Remittance not found");
      return;
    }

    if (remittance.status !== "created") {
      fail(
        res,
        400,
        `Cannot approve remittance with status: ${remittance.status}`,
      );
      return;
    }

    // Separation of duties: nobody signs off on a transfer they originated.
    if (idOf(remittance.sender) === userId) {
      fail(res, 403, "You cannot approve a remittance you created");
      return;
    }

    remittance.status = "approved";
    remittance.approvedAt = new Date();
    await remittance.save();

    await recordAudit({
      req,
      actorId: userId,
      remittance: remittance._id,
      action: "approved",
      description: "Remittance approved",
      previousStatus: "created",
      newStatus: "approved",
    });

    res.status(200).json({
      success: true,
      message: "Remittance approved successfully",
      remittance: {
        id: remittance._id,
        transactionId: remittance.transactionId,
        authorizedAmount: remittance.authorizedAmount,
        expectedPayout: remittance.expectedPayout,
        payoutCurrency: remittance.payoutCurrency,
        payoutMethod: remittance.payoutMethod,
        status: remittance.status,
        approvedAt: remittance.approvedAt,
      },
    });
  } catch (error) {
    console.error("Approve remittance error:", error);

    fail(res, 500, "Failed to approve remittance");
  }
};

// =====================================================
// PROCESS
// =====================================================

export const processRemittance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id?: string };

    if (!isValidObjectId(id)) {
      fail(res, 400, "Invalid remittance id");
      return;
    }

    const remittance = await Remittance.findById(id);

    if (!remittance) {
      fail(res, 404, "Remittance not found");
      return;
    }

    if (remittance.status !== "approved") {
      fail(
        res,
        400,
        `Cannot process remittance with status: ${remittance.status}`,
      );
      return;
    }

    remittance.status = "processing";
    await remittance.save();

    await recordAudit({
      req,
      actorId: requireUser(req).userId,
      remittance: remittance._id,
      action: "processing",
      description: "Remittance processing started",
      previousStatus: "approved",
      newStatus: "processing",
    });

    res.status(200).json({
      success: true,
      message: "Remittance processing started",
      remittance: {
        id: remittance._id,
        transactionId: remittance.transactionId,
        status: remittance.status,
      },
    });
  } catch (error) {
    console.error("Process remittance error:", error);

    fail(res, 500, "Failed to process remittance");
  }
};

// =====================================================
// READY FOR PAYOUT
// =====================================================

export const readyForPayout = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id?: string };

    if (!isValidObjectId(id)) {
      fail(res, 400, "Invalid remittance id");
      return;
    }

    const remittance = await Remittance.findById(id);

    if (!remittance) {
      fail(res, 404, "Remittance not found");
      return;
    }

    if (remittance.status !== "processing") {
      fail(
        res,
        400,
        `Cannot mark remittance as ready with status: ${remittance.status}`,
      );
      return;
    }

    remittance.status = "ready_for_payout";
    await remittance.save();

    await recordAudit({
      req,
      actorId: requireUser(req).userId,
      remittance: remittance._id,
      action: "ready_for_payout",
      description: "Remittance is ready for payout",
      previousStatus: "processing",
      newStatus: "ready_for_payout",
    });

    res.status(200).json({
      success: true,
      message: "Remittance is ready for payout",
      remittance: {
        id: remittance._id,
        transactionId: remittance.transactionId,
        expectedPayout: remittance.expectedPayout,
        payoutCurrency: remittance.payoutCurrency,
        status: remittance.status,
      },
    });
  } catch (error) {
    console.error("Ready for payout error:", error);

    fail(res, 500, "Failed to update remittance");
  }
};

// =====================================================
// COMPLETE PAYOUT
// =====================================================

export const completePayout = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = requireUser(req);
    const { id } = req.params as { id?: string };
    const { actualPayout: rawActualPayout } = req.body as {
      actualPayout?: unknown;
    };

    if (!isValidObjectId(id)) {
      fail(res, 400, "Invalid remittance id");
      return;
    }

    const actualPayout = toFiniteNumber(rawActualPayout);

    if (actualPayout === null || actualPayout <= 0) {
      fail(res, 400, "Valid actual payout amount is required");
      return;
    }

    const remittance = await Remittance.findById(id);

    if (!remittance) {
      fail(res, 404, "Remittance not found");
      return;
    }

    if (remittance.status !== "ready_for_payout") {
      fail(
        res,
        400,
        `Cannot complete payout with status: ${remittance.status}`,
      );
      return;
    }

    // ---- Amount mismatch → block + open a dispute --------------------
    // Compared with a cent-level tolerance. A raw `!==` on floats raised a
    // false dispute on correct payouts (e.g. 36250.00000000001 vs 36250).
    if (!moneyEquals(actualPayout, remittance.expectedPayout)) {
      const difference = roundMoney(
        Math.abs(actualPayout - remittance.expectedPayout),
      );

      remittance.status = "error_reported";
      remittance.actualPayout = roundMoney(actualPayout);
      await remittance.save();

      await Dispute.create({
        remittance: remittance._id,
        type: "amount_mismatch",
        expectedAmount: remittance.expectedPayout,
        actualAmount: roundMoney(actualPayout),
        difference,
        reportedBy: userId,
        status: "open",
        description:
          "Actual payout amount does not match the authorized payout amount",
      });

      await recordAudit({
        req,
        actorId: userId,
        remittance: remittance._id,
        action: "error_reported",
        description: `Payout mismatch detected. Expected ${remittance.expectedPayout}, received ${roundMoney(actualPayout)}`,
        previousStatus: "ready_for_payout",
        newStatus: "error_reported",
      });

      fail(res, 400, "Payout amount mismatch. Transaction blocked.", {
        expectedPayout: remittance.expectedPayout,
        actualPayout: roundMoney(actualPayout),
        difference,
        status: remittance.status,
      });

      return;
    }

    // ---- Happy path --------------------------------------------------
    const payout = await Payout.create({
      remittance: remittance._id,
      receiver: remittance.receiver,
      method: remittance.payoutMethod,
      amount: roundMoney(actualPayout),
      currency: remittance.payoutCurrency,
      providerReference: `MOCK-${Date.now()}`,
      status: "completed",
      processedBy: userId,
      processedAt: new Date(),
    });

    remittance.actualPayout = roundMoney(actualPayout);
    remittance.status = "completed";
    remittance.completedAt = new Date();
    await remittance.save();

    await recordAudit({
      req,
      actorId: userId,
      remittance: remittance._id,
      action: "payout_completed",
      description: `Payout completed for ${roundMoney(actualPayout)} ${remittance.payoutCurrency}`,
      previousStatus: "ready_for_payout",
      newStatus: "completed",
    });

    res.status(200).json({
      success: true,
      message: "Payout completed successfully",
      payout: {
        id: payout._id,
        amount: payout.amount,
        currency: payout.currency,
        method: payout.method,
        status: payout.status,
        providerReference: payout.providerReference,
      },
      remittance: {
        id: remittance._id,
        transactionId: remittance.transactionId,
        expectedPayout: remittance.expectedPayout,
        actualPayout: remittance.actualPayout,
        status: remittance.status,
        completedAt: remittance.completedAt,
      },
    });
  } catch (error) {
    console.error("Complete payout error:", error);

    fail(res, 500, "Failed to complete payout");
  }
};

// =====================================================
// COMMIT TO BLOCKCHAIN
// =====================================================

export const commitToBlockchain = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id?: string };

    if (!isValidObjectId(id)) {
      fail(res, 400, "Invalid remittance id");
      return;
    }

    const remittance = await Remittance.findById(id);

    if (!remittance) {
      fail(res, 404, "Remittance not found");
      return;
    }

    if (remittance.status !== "completed") {
      fail(
        res,
        400,
        "Only completed remittances can be committed to blockchain",
      );
      return;
    }

    if (remittance.blockchainTxSignature) {
      // Committed records are immutable by design. There is no route that can
      // overwrite an anchor, not even for an admin.
      fail(res, 400, "Remittance is already committed to blockchain", {
        blockchainTxSignature: remittance.blockchainTxSignature,
      });
      return;
    }

    // Freeze the data BEFORE hashing
    const snapshot = buildRemittanceSnapshot(remittance);
    const transactionHash = generateTransactionHash(snapshot);

    const blockchainResult = await anchorTransactionHash(transactionHash);

    remittance.transactionHash = transactionHash;
    remittance.blockchainTxSignature = blockchainResult.signature;
    remittance.blockchainNetwork = blockchainResult.network;
    remittance.blockchainSnapshot = snapshot;
    remittance.blockchainCommittedAt = new Date();
    await remittance.save();

    await recordAudit({
      req,
      actorId: requireUser(req).userId,
      remittance: remittance._id,
      action: "blockchain_committed",
      description: `Remittance hash committed to ${blockchainResult.network}`,
      previousStatus: remittance.status,
      newStatus: remittance.status,
    });

    res.status(200).json({
      success: true,
      message: "Transaction committed to Solana Devnet",
      blockchain: {
        network: blockchainResult.network,
        transactionHash,
        signature: blockchainResult.signature,
      },
    });
  } catch (error) {
    console.error("Blockchain commit error:", error);

    fail(res, 500, "Failed to commit transaction to blockchain");
  }
};

// =====================================================
// VERIFY BLOCKCHAIN
// =====================================================

export const verifyRemittanceBlockchain = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId, userRole } = requireUser(req);
    const { id } = req.params as { id?: string };

    if (!isValidObjectId(id)) {
      fail(res, 400, "Invalid remittance id");
      return;
    }

    const remittance = await Remittance.findById(id);

    if (!remittance) {
      fail(res, 404, "Remittance not found");
      return;
    }

    // This endpoint was reachable by any authenticated user for any id,
    // which leaked hashes and signatures of unrelated transfers.
    const isParticipant =
      idOf(remittance.sender) === userId ||
      idOf(remittance.receiver) === userId;

    if (!isStaffRole(userRole) && !isParticipant) {
      fail(res, 403, "You are not authorized to view this remittance");
      return;
    }

    if (!remittance.blockchainTxSignature) {
      fail(res, 400, "This remittance has not been committed to blockchain");
      return;
    }

    // 1. HASH VERIFICATION (against the frozen snapshot)
    const storedSnapshot = remittance.blockchainSnapshot;

    const hasSnapshot = storedSnapshot !== undefined && storedSnapshot !== null;

    const snapshot: Record<string, unknown> = hasSnapshot
      ? storedSnapshot
      : buildRemittanceSnapshot(remittance);

    const recalculatedHash = generateTransactionHash(snapshot);
    const hashMatches = recalculatedHash === remittance.transactionHash;

    // Backfill legacy commits on first successful verify
    if (!hasSnapshot && hashMatches) {
      remittance.blockchainSnapshot = snapshot;
      remittance.blockchainCommittedAt =
        remittance.blockchainCommittedAt ?? new Date();
      await remittance.save();
    }

    // 2. LIVE TAMPER CHECK
    // Compares only the immutable fields, so a legitimate post-commit dispute
    // does not masquerade as tampering.
    const immutableHashAtCommit = generateTransactionHash(omitStatus(snapshot));
    const liveHash = generateTransactionHash(
      omitStatus(buildRemittanceSnapshot(remittance)),
    );

    const liveMatchesSnapshot = liveHash === immutableHashAtCommit;

    // 3. SOLANA STATUS
    // The RPC call is fallible (devnet flakiness, rate limits). It must not
    // turn a verification request into a 500, so a failure downgrades to
    // "not verified" with the reason attached.
    let blockchainStatus: BlockchainStatus;

    try {
      blockchainStatus = await verifyBlockchainTransaction(
        remittance.blockchainTxSignature,
      );
    } catch (error) {
      blockchainStatus = {
        found: false,
        confirmed: false,
        finalized: false,
        error: error instanceof Error ? error.message : "RPC lookup failed",
        slot: null,
      };
    }

    const verified =
      hashMatches &&
      liveMatchesSnapshot &&
      blockchainStatus.found &&
      blockchainStatus.finalized &&
      blockchainStatus.error === null;

    res.status(200).json({
      success: true,
      verified,

      remittance: {
        id: remittance._id,
        transactionId: remittance.transactionId,
      },

      hashVerification: {
        originalHash: remittance.transactionHash,
        recalculatedHash,
        matches: hashMatches,
      },

      liveTamperCheck: {
        snapshotHash: immutableHashAtCommit,
        liveHash,
        matches: liveMatchesSnapshot,
        tampered: !liveMatchesSnapshot,
      },

      blockchainVerification: {
        network: remittance.blockchainNetwork,
        signature: remittance.blockchainTxSignature,
        found: blockchainStatus.found,
        confirmed: blockchainStatus.confirmed,
        finalized: blockchainStatus.finalized,
        error: blockchainStatus.error,
        slot: blockchainStatus.slot,
      },

      message: verified
        ? "Transaction is verified and has not been tampered with"
        : !liveMatchesSnapshot
          ? "Transaction data has been modified since it was committed"
          : !blockchainStatus.finalized
            ? "Transaction is on chain but not finalized yet"
            : "Transaction verification failed",
    });
  } catch (error) {
    console.error("Remittance blockchain verification error:", error);

    fail(res, 500, "Blockchain verification failed");
  }
};
