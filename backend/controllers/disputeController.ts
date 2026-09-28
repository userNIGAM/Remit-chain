import Remittance from "../models/Remittance.js";
import Dispute from "../models/Dispute.js";
import AuditLog from "../models/AuditLog.js";

// =====================================================
// GET DISPUTES (role-aware)
// =====================================================

export const getDisputes = async (req: any, res: any) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    let query: any = {};

    if (["admin", "supervisor", "agent"].includes(userRole)) {
      query = {};
    } else if (userRole === "sender" || userRole === "receiver") {
      const ownedRemittances = await Remittance.find({
        $or: [{ sender: userId }, { receiver: userId }],
      }).select("_id");

      query = {
        remittance: { $in: ownedRemittances.map((r) => r._id) },
      };
    } else {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view disputes",
      });
    }

    const disputes = await Dispute.find(query)
      .populate("reportedBy", "name email role")
      .populate("remittance")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: disputes.length,
      disputes,
    });
  } catch (error) {
    console.error("Get disputes error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get disputes",
    });
  }
};

// =====================================================
// START INVESTIGATION
// =====================================================

export const startInvestigation = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    if (dispute.status !== "open") {
      return res.status(400).json({
        success: false,
        message: `Cannot start investigation with status: ${dispute.status}`,
      });
    }

    dispute.status = "investigation";
    await dispute.save();

    const remittance = await Remittance.findById(dispute.remittance);
    if (remittance) {
      remittance.status = "investigation";
      await remittance.save();

      await AuditLog.create({
        remittance: remittance._id,
        actor: req.userId,
        action: "investigation_started",
        description: "Dispute investigation started",
        previousStatus: "error_reported",
        newStatus: "investigation",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Investigation started",
      dispute,
    });
  } catch (error) {
    console.error("Start investigation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start investigation",
    });
  }
};

// =====================================================
// REQUEST RECOVERY
// =====================================================

export const requestRecovery = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    if (dispute.status !== "investigation") {
      return res.status(400).json({
        success: false,
        message: `Cannot request recovery with status: ${dispute.status}`,
      });
    }

    dispute.status = "recovery_requested";
    await dispute.save();

    const remittance = await Remittance.findById(dispute.remittance);
    if (remittance) {
      remittance.status = "recovery_requested";
      await remittance.save();

      await AuditLog.create({
        remittance: remittance._id,
        actor: req.userId,
        action: "recovery_requested",
        description: "Recovery requested for payout mismatch",
        previousStatus: "investigation",
        newStatus: "recovery_requested",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Recovery requested",
      dispute,
    });
  } catch (error) {
    console.error("Request recovery error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request recovery",
    });
  }
};

// =====================================================
// RESOLVE DISPUTE
// =====================================================

export const resolveDispute = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    if (!resolution || resolution.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Resolution is required",
      });
    }

    const dispute = await Dispute.findById(id);
    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: "Dispute not found",
      });
    }

    if (dispute.status !== "recovery_requested") {
      return res.status(400).json({
        success: false,
        message: `Cannot resolve dispute with status: ${dispute.status}`,
      });
    }

    dispute.status = "resolved";
    dispute.resolution = resolution;
    dispute.resolvedBy = req.userId;
    dispute.resolvedAt = new Date();
    await dispute.save();

    const remittance = await Remittance.findById(dispute.remittance);

    if (remittance) {
      remittance.status = "recovered";
      await remittance.save();

      await AuditLog.create({
        remittance: remittance._id,
        actor: req.userId,
        action: "dispute_resolved",
        description: `Dispute resolved: ${resolution}`,
        previousStatus: "recovery_requested",
        newStatus: "recovered",
      });
    }

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      message: "Failed to resolve dispute",
    });
  }
};
