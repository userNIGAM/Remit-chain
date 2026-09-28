import AuditLog from "../models/AuditLog.js";
import Remittance from "../models/Remittance.js";

const STAFF_ROLES = ["admin", "supervisor", "agent"];

// =====================================================
// GET AUDIT LOGS FOR ONE REMITTANCE
// =====================================================
// Staff can view any. Sender/receiver can view only their own.
// =====================================================

export const getRemittanceAuditLogs = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    if (!STAFF_ROLES.includes(userRole)) {
      const remittance =
        await Remittance.findById(id).select("sender receiver");

      if (!remittance) {
        return res.status(404).json({
          success: false,
          message: "Remittance not found",
        });
      }

      const isOwner =
        remittance.sender.toString() === userId ||
        remittance.receiver.toString() === userId;

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view this remittance history",
        });
      }
    }

    const logs = await AuditLog.find({ remittance: id })
      .populate("actor", "name email role")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get audit logs",
    });
  }
};

// =====================================================
// GET ALL AUDIT LOGS  (admin / supervisor only)
// =====================================================

export const getAuditLogs = async (req: any, res: any): Promise<void> => {
  try {
    const logs = await AuditLog.find()
      .populate("actor", "name email role")
      .populate("remittance", "transactionId status")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, logs });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get audit logs",
    });
  }
};
