import { type Request, type Response } from "express";

import User from "../models/User.js";
import Remittance from "../models/Remittance.js";
import AuditLog from "../models/AuditLog.js";
import Payout from "../models/Payout.js";
import Dispute from "../models/Dispute.js";

import { generateTransactionHash } from "../utils/hashTransaction.js";
import {
  anchorTransactionHash,
  verifyBlockchainTransaction,
} from "../services/blockchainService.js";

// =====================================================
// BUILD REMITTANCE SNAPSHOT
// =====================================================
// The exact shape hashed and anchored to Solana.
// Commit and verify must use this same function so the
// bytes are guaranteed identical.
// =====================================================

const buildRemittanceSnapshot = (remittance: any) => {
  const idOf = (value: any): string =>
    typeof value === "string"
      ? value
      : (value?._id?.toString() ?? value?.toString() ?? "");

  return {
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
    status: remittance.status,
  };
};

// =====================================================
// GET ALL REMITTANCES (role-aware)
// =====================================================

export const getRemittances = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const userRole = (req as any).userRole;

    let query: any = {};

    if (
      userRole === "admin" ||
      userRole === "supervisor" ||
      userRole === "agent"
    ) {
      query = {};
    } else if (userRole === "sender") {
      query = { sender: userId };
    } else if (userRole === "receiver") {
      query = { receiver: userId };
    } else {
      res.status(403).json({
        success: false,
        message: "You are not authorized to view remittances",
      });
      return;
    }

    const remittances = await Remittance.find(query)
      .populate("sender", "name email phone remitId")
      .populate("receiver", "name email phone remitId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: remittances.length,
      remittances,
    });
  } catch (error) {
    console.error("Get remittances error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get remittances",
    });
  }
};

// =====================================================
// DASHBOARD STATS
// =====================================================

export const getRemittanceStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userRole = (req as any).userRole;

    const allowedRoles = ["admin", "supervisor", "agent"];

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to view dashboard statistics",
      });
      return;
    }

    const total = await Remittance.countDocuments();

    const completed = await Remittance.countDocuments({
      status: "completed",
    });

    const pending = await Remittance.countDocuments({
      status: {
        $in: [
          "created",
          "verified",
          "approved",
          "processing",
          "ready_for_payout",
        ],
      },
    });

    const disputes = await Remittance.countDocuments({
      status: {
        $in: ["error_reported", "investigation", "recovery_requested"],
      },
    });

    const recovered = await Remittance.countDocuments({
      status: "recovered",
    });

    const blockchainVerified = await Remittance.countDocuments({
      blockchainTxSignature: {
        $exists: true,
        $ne: "",
      },
    });

    res.status(200).json({
      success: true,
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
    res.status(500).json({
      success: false,
      message: "Failed to get dashboard statistics",
    });
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
    const { remitId, phone } = req.query;

    if (!remitId && !phone) {
      res.status(400).json({
        success: false,
        message: "Provide remitId or phone",
      });
      return;
    }

    const query: any = {};
    if (remitId) query.remitId = remitId;
    if (phone) query.phone = phone;

    const receiver = await User.findOne(query).select(
      "name phone country remitId role verificationStatus",
    );

    if (!receiver) {
      res.status(404).json({
        success: false,
        message: "Receiver not found",
      });
      return;
    }

    if (receiver.role !== "receiver") {
      res.status(400).json({
        success: false,
        message: "This user cannot receive remittances",
      });
      return;
    }

    if (receiver.verificationStatus !== "verified") {
      res.status(400).json({
        success: false,
        message: "Receiver is not verified",
      });
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
      },
    });
  } catch (error) {
    console.error("Find receiver error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while finding receiver",
    });
  }
};

// =====================================================
// CREATE REMITTANCE
// =====================================================

export const createRemittance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const senderId = (req as any).userId;

    if (!senderId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const {
      receiverRemitId,
      amount,
      sendingCurrency,
      exchangeRate,
      fee,
      payoutMethod,
    } = req.body;

    if (
      !receiverRemitId ||
      amount === undefined ||
      !sendingCurrency ||
      exchangeRate === undefined ||
      fee === undefined ||
      !payoutMethod
    ) {
      res.status(400).json({
        success: false,
        message:
          "receiverRemitId, amount, sendingCurrency, exchangeRate, fee and payoutMethod are required",
      });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({
        success: false,
        message: "Amount must be greater than zero",
      });
      return;
    }

    if (exchangeRate <= 0) {
      res.status(400).json({
        success: false,
        message: "Exchange rate must be greater than zero",
      });
      return;
    }

    if (fee < 0) {
      res.status(400).json({
        success: false,
        message: "Fee cannot be negative",
      });
      return;
    }

    const allowedPayoutMethods = ["bank", "wallet", "cash"];

    if (!allowedPayoutMethods.includes(payoutMethod)) {
      res.status(400).json({
        success: false,
        message: "Invalid payout method. Use bank, wallet or cash",
      });
      return;
    }

    const sender = await User.findById(senderId);

    if (!sender) {
      res.status(404).json({
        success: false,
        message: "Sender account not found",
      });
      return;
    }

    if (sender.verificationStatus !== "verified") {
      res.status(403).json({
        success: false,
        message: "Sender identity is not verified",
      });
      return;
    }

    const receiver = await User.findOne({
      remitId: receiverRemitId,
      role: "receiver",
    });

    if (!receiver) {
      res.status(404).json({
        success: false,
        message: "Receiver not found",
      });
      return;
    }

    if (receiver.verificationStatus !== "verified") {
      res.status(403).json({
        success: false,
        message: "Receiver identity is not verified",
      });
      return;
    }

    if (sender._id.toString() === receiver._id.toString()) {
      res.status(400).json({
        success: false,
        message: "Sender and receiver cannot be the same user",
      });
      return;
    }

    const grossPayout = amount * exchangeRate;
    const expectedPayout = grossPayout - fee;

    if (expectedPayout <= 0) {
      res.status(400).json({
        success: false,
        message: "Fee is too high compared to the transaction amount",
      });
      return;
    }

    const transactionId = `REM-${Date.now()}-${Math.floor(
      Math.random() * 1000,
    )}`;

    const remittance = await Remittance.create({
      transactionId,
      sender: sender._id,
      receiver: receiver._id,
      channel: "online",
      authorizedAmount: amount,
      sendingCurrency: sendingCurrency.toUpperCase(),
      exchangeRate,
      fee,
      expectedPayout,
      payoutCurrency: "NPR",
      payoutMethod,
      status: "created",
    });

    await AuditLog.create({
      remittance: remittance._id,
      actor: sender._id,
      action: "created",
      description: "Remittance created by sender",
      newStatus: "created",
    });

    res.status(201).json({
      success: true,
      message: "Remittance created successfully",
      remittance: {
        id: remittance._id,
        transactionId: remittance.transactionId,
        sender: {
          id: sender._id,
          name: sender.name,
          remitId: sender.remitId,
        },
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
        status: remittance.status,
        createdAt: remittance.createdAt,
      },
    });
  } catch (error) {
    console.error("Create remittance error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating remittance",
    });
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
    const { id } = req.params;

    const remittance = await Remittance.findById(id)
      .populate("sender", "name email phone remitId")
      .populate("receiver", "name email phone remitId");

    if (!remittance) {
      res.status(404).json({
        success: false,
        message: "Remittance not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      remittance,
    });
  } catch (error) {
    console.error("Get remittance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get remittance",
    });
  }
};

// =====================================================
// APPROVE
// =====================================================

export const approveRemittance = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const remittance = await Remittance.findById(id);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        message: "Remittance not found",
      });
    }

    if (remittance.status !== "created") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve remittance with status: ${remittance.status}`,
      });
    }

    remittance.status = "approved";
    remittance.approvedAt = new Date();
    await remittance.save();

    await AuditLog.create({
      remittance: remittance._id,
      actor: req.userId,
      action: "approved",
      description: "Remittance approved",
      previousStatus: "created",
      newStatus: "approved",
    });

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      message: "Failed to approve remittance",
    });
  }
};

// =====================================================
// PROCESS
// =====================================================

export const processRemittance = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const remittance = await Remittance.findById(id);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        message: "Remittance not found",
      });
    }

    if (remittance.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: `Cannot process remittance with status: ${remittance.status}`,
      });
    }

    remittance.status = "processing";
    await remittance.save();

    await AuditLog.create({
      remittance: remittance._id,
      actor: req.userId,
      action: "processing",
      description: "Remittance processing started",
      previousStatus: "approved",
      newStatus: "processing",
    });

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      message: "Failed to process remittance",
    });
  }
};

// =====================================================
// READY FOR PAYOUT
// =====================================================

export const readyForPayout = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const remittance = await Remittance.findById(id);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        message: "Remittance not found",
      });
    }

    if (remittance.status !== "processing") {
      return res.status(400).json({
        success: false,
        message: `Cannot mark remittance as ready with status: ${remittance.status}`,
      });
    }

    remittance.status = "ready_for_payout";
    await remittance.save();

    await AuditLog.create({
      remittance: remittance._id,
      actor: req.userId,
      action: "ready_for_payout",
      description: "Remittance is ready for payout",
      previousStatus: "processing",
      newStatus: "ready_for_payout",
    });

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      message: "Failed to update remittance",
    });
  }
};

// =====================================================
// COMPLETE PAYOUT
// =====================================================

export const completePayout = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { actualPayout } = req.body;

    if (
      actualPayout === undefined ||
      typeof actualPayout !== "number" ||
      actualPayout <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid actual payout amount is required",
      });
    }

    const remittance = await Remittance.findById(id);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        message: "Remittance not found",
      });
    }

    if (remittance.status !== "ready_for_payout") {
      return res.status(400).json({
        success: false,
        message: `Cannot complete payout with status: ${remittance.status}`,
      });
    }

    // Amount mismatch → open a dispute
    if (actualPayout !== remittance.expectedPayout) {
      remittance.status = "error_reported";
      remittance.actualPayout = actualPayout;
      await remittance.save();

      const difference = Math.abs(actualPayout - remittance.expectedPayout);

      await Dispute.create({
        remittance: remittance._id,
        type: "amount_mismatch",
        expectedAmount: remittance.expectedPayout,
        actualAmount: actualPayout,
        difference,
        reportedBy: req.userId,
        status: "open",
        description:
          "Actual payout amount does not match the authorized payout amount",
      });

      await AuditLog.create({
        remittance: remittance._id,
        actor: req.userId,
        action: "error_reported",
        description: `Payout mismatch detected. Expected ${remittance.expectedPayout}, received ${actualPayout}`,
        previousStatus: "ready_for_payout",
        newStatus: "error_reported",
      });

      return res.status(400).json({
        success: false,
        message: "Payout amount mismatch. Transaction blocked.",
        expectedPayout: remittance.expectedPayout,
        actualPayout,
        difference,
        status: remittance.status,
      });
    }

    const payout = await Payout.create({
      remittance: remittance._id,
      receiver: remittance.receiver,
      method: remittance.payoutMethod,
      amount: actualPayout,
      currency: remittance.payoutCurrency,
      providerReference: `MOCK-${Date.now()}`,
      status: "completed",
      processedBy: req.userId,
      processedAt: new Date(),
    });

    remittance.actualPayout = actualPayout;
    remittance.status = "completed";
    remittance.completedAt = new Date();
    await remittance.save();

    await AuditLog.create({
      remittance: remittance._id,
      actor: req.userId,
      action: "payout_completed",
      description: `Payout completed for ${actualPayout} ${remittance.payoutCurrency}`,
      previousStatus: "ready_for_payout",
      newStatus: "completed",
    });

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      message: "Failed to complete payout",
    });
  }
};

// =====================================================
// COMMIT TO BLOCKCHAIN
// =====================================================

export const commitToBlockchain = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const remittance = await Remittance.findById(id);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        message: "Remittance not found",
      });
    }

    if (remittance.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Only completed remittances can be committed to blockchain",
      });
    }

    if (remittance.blockchainTxSignature) {
      return res.status(400).json({
        success: false,
        message: "Remittance is already committed to blockchain",
        blockchainTxSignature: remittance.blockchainTxSignature,
      });
    }

    // Freeze the data BEFORE hashing
    const snapshot = buildRemittanceSnapshot(remittance);
    const transactionHash = generateTransactionHash(snapshot);

    // Anchor to Solana
    const blockchainResult = await anchorTransactionHash(transactionHash);

    // Persist hash + snapshot
    remittance.transactionHash = transactionHash;
    remittance.blockchainTxSignature = blockchainResult.signature;
    remittance.blockchainNetwork = blockchainResult.network;
    remittance.blockchainSnapshot = snapshot;
    remittance.blockchainCommittedAt = new Date();
    await remittance.save();

    await AuditLog.create({
      remittance: remittance._id,
      actor: req.userId,
      action: "blockchain_committed",
      description: "Remittance transaction hash committed to Solana Devnet",
      previousStatus: remittance.status,
      newStatus: remittance.status,
    });

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      message: "Failed to commit transaction to blockchain",
    });
  }
};

// =====================================================
// VERIFY BLOCKCHAIN
// =====================================================

export const verifyRemittanceBlockchain = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const remittance = await Remittance.findById(id);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        message: "Remittance not found",
      });
    }

    if (!remittance.blockchainTxSignature) {
      return res.status(400).json({
        success: false,
        message: "This remittance has not been committed to blockchain",
      });
    }

    // =================================================
    // 1. HASH VERIFICATION (against the frozen snapshot)
    // =================================================

    const hasSnapshot = !!remittance.blockchainSnapshot;

    const snapshot = hasSnapshot
      ? remittance.blockchainSnapshot
      : buildRemittanceSnapshot(remittance);

    const recalculatedHash = generateTransactionHash(snapshot!);
    const hashMatches = recalculatedHash === remittance.transactionHash;

    // Backfill legacy commits on first successful verify
    if (!hasSnapshot && hashMatches) {
      remittance.blockchainSnapshot = snapshot as Record<string, unknown>;
      remittance.blockchainCommittedAt =
        remittance.blockchainCommittedAt || new Date();
      await remittance.save();
    }

    // =================================================
    // 2. LIVE TAMPER CHECK
    // =================================================

    const liveSnapshot = buildRemittanceSnapshot(remittance);
    const liveHash = generateTransactionHash(liveSnapshot);
    const liveMatchesSnapshot = liveHash === remittance.transactionHash;

    // =================================================
    // 3. SOLANA STATUS
    // =================================================

    const blockchainStatus = await verifyBlockchainTransaction(
      remittance.blockchainTxSignature,
    );

    const verified =
      hashMatches &&
      liveMatchesSnapshot &&
      blockchainStatus.found &&
      blockchainStatus.finalized &&
      !blockchainStatus.error;

    return res.status(200).json({
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
        snapshotHash: remittance.transactionHash,
        liveHash,
        matches: liveMatchesSnapshot,
        tampered: !liveMatchesSnapshot,
      },

      blockchainVerification: {
        network: remittance.blockchainNetwork,
        signature: remittance.blockchainTxSignature,
        found: blockchainStatus.found,
        finalized: blockchainStatus.finalized,
        error: blockchainStatus.error,
        slot: blockchainStatus.slot,
      },

      message: verified
        ? "Transaction is verified and has not been tampered with"
        : !liveMatchesSnapshot
          ? "Transaction data has been modified since it was committed"
          : "Transaction verification failed",
    });
  } catch (error) {
    console.error("Remittance blockchain verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Blockchain verification failed",
    });
  }
};
