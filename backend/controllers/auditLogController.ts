import AuditLog from "../models/AuditLog.js";

// GET AUDIT LOGS FOR ONE REMITTANCE
export const getRemittanceAuditLogs = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const logs = await AuditLog.find({
      remittance: id,
    })
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