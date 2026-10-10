import { type Request, type Response } from "express";
import mongoose from "mongoose";

import Remittance from "../models/Remittance.js";
import Dispute from "../models/Dispute.js";
import AuditLog from "../models/AuditLog.js";

import { requireUser } from "../types/auth.js";
import { isValidObjectId, isNonEmptyString } from "../utils/validation.js";

// =====================================================
// GET DISPUTES (supervisor / admin queue)
// =====================================================
//
// Access is enforced by `requireRole("admin", "supervisor")` on the route, so
// this returns the full queue. Agents were previously able to list every
// dispute in the system, which is oversight data.
// =====================================================

export const getDisputes = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    requireUser(req);

    const disputes = await Dispute.find({})
      .populate("reportedBy", "name email role")
      .populate({
        path: "remittance",
        select: "transactionId authorizedAmount expectedPayout actualPayout status",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: disputes.length,
      disputes,
    });
  } catch (error) {
    console.error("Get disputes error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get disputes",
    });
  }
};

// =====================================================
// GET DISPUTE FOR A REMITTANCE
// =====================================================
//
// Lets a customer see why their transfer is blocked without exposing the
// global dispute queue. Participant check mirrors the remittance controller.
// =====================================================

const idOf = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value ?? "");
};

export const getDisputeForRemittance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId, userRole } = requireUser(req);
    const { id } = req.params as { id?: string };

    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid remittance id" });
      return;
    }

    const remittance = await Remittance.findById(id)
      .select("sender receiver")
      .lean();

    if (!remittance) {
      res.status(404).json({ success: false, message: "Remittance not found" });
      return;
    }

    const isStaff =
      userRole === "agent" ||
      userRole === "supervisor" ||
      userRole === "admin";

    const isParticipant =
      idOf(remittance.sender) === userId || idOf(remittance.receiver) === userId;

    if (!isStaff && !isParticipant) {
      res.status(403).json({ success: false, message: "Not authorized" });
      return;
    }

    const dispute = await Dispute.findOne({ remittance: id })
      .populate("reportedBy", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      dispute,
    });
  } catch (error) {
    console.error("Get dispute for remittance error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get dispute",
    });
  }
};

// =====================================================
// START INVESTIGATION
// =====================================================

export const startInvestigation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = requireUser(req);
    const { id } = req.params as { id?: string };

    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid dispute id" });
      return;
    }

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      res.status(404).json({ success: false, message: "Dispute not found" });
      return;
    }

    if (dispute.status !== "open") {
      res.status(400).json({
        success: false,
        message: `Cannot start investigation with status: ${dispute.status}`,
      });
      return;
    }

    dispute.status = "investigation";
    await dispute.save();

    const remittance = await Remittance.findById(dispute.remittance);

    if (remittance) {
      remittance.status = "investigation";
      await remittance.save();

      await AuditLog.create({
        remittance: remittance._id,
        actor: new mongoose.Types.ObjectId(userId),
        action: "investigation_started",
        description: "Dispute investigation started",
        previousStatus: "error_reported",
        newStatus: "investigation",
        ...(req.ip ? { ipAddress: req.ip } : {}),
      });
    }

    res.status(200).json({
      success: true,
      message: "Investigation started",
      dispute,
    });
  } catch (error) {
    console.error("Start investigation error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to start investigation",
    });
  }
};

// =====================================================
// REQUEST RECOVERY
// =====================================================

export const requestRecovery = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = requireUser(req);
    const { id } = req.params as { id?: string };

    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid dispute id" });
      return;
    }

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      res.status(404).json({ success: false, message: "Dispute not found" });
      return;
    }

    if (dispute.status !== "investigation") {
      res.status(400).json({
        success: false,
        message: `Cannot request recovery with status: ${dispute.status}`,
      });
      return;
    }

    dispute.status = "recovery_requested";
    await dispute.save();

    const remittance = await Remittance.findById(dispute.remittance);

    if (remittance) {
      remittance.status = "recovery_requested";
      await remittance.save();

      await AuditLog.create({
        remittance: remittance._id,
        actor: new mongoose.Types.ObjectId(userId),
        action: "recovery_requested",
        description: "Recovery requested for payout mismatch",
        previousStatus: "investigation",
        newStatus: "recovery_requested",
        ...(req.ip ? { ipAddress: req.ip } : {}),
      });
    }

    res.status(200).json({
      success: true,
      message: "Recovery requested",
      dispute,
    });
  } catch (error) {
    console.error("Request recovery error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to request recovery",
    });
  }
};

// =====================================================
// RESOLVE DISPUTE
// =====================================================

export const resolveDispute = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = requireUser(req);
    const { id } = req.params as { id?: string };
    const { resolution } = req.body as { resolution?: unknown };

    if (!isNonEmptyString(resolution)) {
      res.status(400).json({
        success: false,
        message: "Resolution is required",
      });
      return;
    }

    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid dispute id" });
      return;
    }

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      res.status(404).json({ success: false, message: "Dispute not found" });
      return;
    }

    if (dispute.status !== "recovery_requested") {
      res.status(400).json({
        success: false,
        message: `Cannot resolve dispute with status: ${dispute.status}`,
      });
      return;
    }

    dispute.status = "resolved";
    dispute.resolution = resolution.trim();
    dispute.resolvedBy = new mongoose.Types.ObjectId(userId);
    dispute.resolvedAt = new Date();
    await dispute.save();

    const remittance = await Remittance.findById(dispute.remittance);

    if (remittance) {
      remittance.status = "recovered";
      await remittance.save();

      await AuditLog.create({
        remittance: remittance._id,
        actor: new mongoose.Types.ObjectId(userId),
        action: "dispute_resolved",
        description: `Dispute resolved: ${resolution.trim()}`,
        previousStatus: "recovery_requested",
        newStatus: "recovered",
        ...(req.ip ? { ipAddress: req.ip } : {}),
      });
    }

    res.status(200).json({
      success: true,
      message: "Dispute resolved and remittance recovered",
      dispute,
      remittance: remittance
        ? {
            id: remittance._id,
            transactionId: remittance.transactionId,
            status: remittance.status,
          }
        : null,
    });
  } catch (error) {
    console.error("Resolve dispute error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to resolve dispute",
    });
  }
};
