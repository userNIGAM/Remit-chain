import Remittance from "../models/Remittance.js";
import Payout from "../models/Payout.js";
import Dispute from "../models/Dispute.js";
import AuditLog from "../models/AuditLog.js";

export const completePayout = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { actualPayout } = req.body;

    // 1. Validate payout amount
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

    // 2. Find remittance
    const remittance = await Remittance.findById(id);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        message: "Remittance not found",
      });
    }

    // 3. Only ready-for-payout transactions can be paid
    if (remittance.status !== "ready_for_payout") {
      return res.status(400).json({
        success: false,
        message: `Cannot complete payout with status: ${remittance.status}`,
      });
    }

    // 4. Check for amount mismatch
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

    // 5. Create payout
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

    // 6. Update remittance
    remittance.actualPayout = actualPayout;
    remittance.status = "completed";
    remittance.completedAt = new Date();

    await remittance.save();

    // 7. Create audit log
    await AuditLog.create({
      remittance: remittance._id,
      actor: req.userId,
      action: "payout_completed",
      description: `Payout completed: ${actualPayout} ${remittance.payoutCurrency}`,
      previousStatus: "ready_for_payout",
      newStatus: "completed",
    });

    // 8. Return response
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
