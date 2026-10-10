import { type Request, type Response } from "express";

import AuditLog from "../models/AuditLog.js";
import Remittance from "../models/Remittance.js";

import { requireUser, isStaffRole } from "../types/auth.js";
import { isValidObjectId } from "../utils/validation.js";

// =====================================================
// GET AUDIT LOGS FOR ONE REMITTANCE
// =====================================================
// Staff can view any. Sender/receiver can view only their own.
// =====================================================

export const getRemittanceAuditLogs = async (
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

    if (!isStaffRole(userRole)) {
      const remittance = await Remittance.findById(id).select("sender receiver");

      if (!remittance) {
        res.status(404).json({
          success: false,
          message: "Remittance not found",
        });
        return;
      }

      const isOwner =
        String(remittance.sender) === userId ||
        String(remittance.receiver) === userId;

      if (!isOwner) {
        res.status(403).json({
          success: false,
          message: "You are not authorized to view this remittance history",
        });
        return;
      }
    }

    const logs = await AuditLog.find({ remittance: id })
      .populate("actor", "name role")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Get audit logs error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get audit logs",
    });
  }
};

// =====================================================
// GET ALL AUDIT LOGS  (admin / supervisor only)
// =====================================================

export const getAuditLogs = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    requireUser(req);

    const logs = await AuditLog.find()
      .populate("actor", "name role")
      .populate("remittance", "transactionId status")
      .sort({ createdAt: -1 })
      .limit(500);

    res.status(200).json({ success: true, count: logs.length, logs });
  } catch (error) {
    console.error("Get audit logs error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get audit logs",
    });
  }
};
