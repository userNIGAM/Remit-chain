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

export const findReceiver = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // 1. Get search value
    const { remitId, phone } = req.query;

    // 2. Make sure at least one search field exists
    if (!remitId && !phone) {
      res.status(400).json({
        success: false,
        message: "Provide remitId or phone",
      });

      return;
    }

    // 3. Build search query
    const query: any = {};

    if (remitId) {
      query.remitId = remitId;
    }

    if (phone) {
      query.phone = phone;
    }

    // 4. Find receiver
    const receiver = await User.findOne(query).select(
      "name phone country remitId role verificationStatus",
    );

    // 5. Check whether user exists
    if (!receiver) {
      res.status(404).json({
        success: false,
        message: "Receiver not found",
      });

      return;
    }

    // 6. Make sure this is a receiver
    if (receiver.role !== "receiver") {
      res.status(400).json({
        success: false,
        message: "This user cannot receive remittances",
      });

      return;
    }

    // 7. Receiver must be verified
    if (receiver.verificationStatus !== "verified") {
      res.status(400).json({
        success: false,
        message: "Receiver is not verified",
      });

      return;
    }

    // 8. Return limited information
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
//
// Creates a new money transfer.
//
// IMPORTANT:
// We NEVER trust senderId from the frontend.
//
// The sender comes from the JWT:
// req.userId
//
// This prevents someone from pretending to be another
// user by sending another user's ID.
// =====================================================

export const createRemittance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // =================================================
    // 1. GET AUTHENTICATED SENDER
    // =================================================

    const senderId = (req as any).userId;

    if (!senderId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });

      return;
    }

    // =================================================
    // 2. GET DATA FROM REQUEST BODY
    // =================================================

    const {
      receiverRemitId,
      amount,
      sendingCurrency,
      exchangeRate,
      fee,
      payoutMethod,
    } = req.body;

    // =================================================
    // 3. VALIDATE REQUIRED DATA
    // =================================================

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

    // =================================================
    // 4. VALIDATE NUMBERS
    // =================================================

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

    // =================================================
    // 5. VALIDATE PAYOUT METHOD
    // =================================================

    const allowedPayoutMethods = ["bank", "wallet", "cash"];

    if (!allowedPayoutMethods.includes(payoutMethod)) {
      res.status(400).json({
        success: false,
        message: "Invalid payout method. Use bank, wallet or cash",
      });

      return;
    }

    // =================================================
    // 6. FIND SENDER
    // =================================================

    const sender = await User.findById(senderId);

    if (!sender) {
      res.status(404).json({
        success: false,
        message: "Sender account not found",
      });

      return;
    }

    // =================================================
    // 7. VERIFY SENDER
    // =================================================

    if (sender.verificationStatus !== "verified") {
      res.status(403).json({
        success: false,
        message: "Sender identity is not verified",
      });

      return;
    }

    // =================================================
    // 8. FIND RECEIVER
    // =================================================

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

    // =================================================
    // 9. VERIFY RECEIVER
    // =================================================

    if (receiver.verificationStatus !== "verified") {
      res.status(403).json({
        success: false,
        message: "Receiver identity is not verified",
      });

      return;
    }

    // =================================================
    // 10. PREVENT SENDING TO YOURSELF
    // =================================================

    if (sender._id.toString() === receiver._id.toString()) {
      res.status(400).json({
        success: false,
        message: "Sender and receiver cannot be the same user",
      });

      return;
    }
    const grossPayout = amount * exchangeRate;

    const expectedPayout = grossPayout - fee;

    // Make sure payout doesn't become negative
    if (expectedPayout <= 0) {
      res.status(400).json({
        success: false,
        message: "Fee is too high compared to the transaction amount",
      });

      return;
    }

    // =================================================
    // 12. GENERATE TRANSACTION ID
    // =================================================

    const transactionId = `REM-${Date.now()}-${Math.floor(
      Math.random() * 1000,
    )}`;

    // =================================================
    // 13. CREATE REMITTANCE
    // =================================================

    const remittance = await Remittance.create({
      transactionId,

      sender: sender._id,

      receiver: receiver._id,

      // This transaction was created through
      // the application, not a physical agent.
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

    // =================================================
    // 14. CREATE AUDIT LOG
    // =================================================

    await AuditLog.create({
      remittance: remittance._id,

      actor: sender._id,

      action: "created",

      description: "Remittance created by sender",

      newStatus: "created",
    });

    // =================================================
    // 15. RETURN RESPONSE
    // =================================================

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

export const approveRemittance = async (req: any, res: any) => {
  try {
    // 1. Get remittance ID from URL
    const { id } = req.params;

    // 2. Find the remittance
    const remittance = await Remittance.findById(id);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        message: "Remittance not found",
      });
    }

    // 3. Only CREATED remittances can be approved
    if (remittance.status !== "created") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve remittance with status: ${remittance.status}`,
      });
    }

    // 4. Change status
    remittance.status = "approved";
    remittance.approvedAt = new Date();

    await remittance.save();

    // 5. Create audit log
    await AuditLog.create({
      remittance: remittance._id,
      actor: req.userId,
      action: "approved",
      description: "Remittance approved",
      previousStatus: "created",
      newStatus: "approved",
    });

    // 6. Return response
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

    // Only approved remittances can enter processing
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

    // Only processing remittances can become ready for payout
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

export const completePayout = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { actualPayout } = req.body;

    // 1. Validate amount
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

    // 4. IMPORTANT: verify payout amount
    if (actualPayout !== remittance.expectedPayout) {
      // Mark transaction as error
      remittance.status = "error_reported";
      remittance.actualPayout = actualPayout;

      await remittance.save();

      // Create dispute
      await Dispute.create({
        remittance: remittance._id,
        type: "amount_mismatch",
        expectedAmount: remittance.expectedPayout,
        actualAmount: actualPayout,
        difference: actualPayout - remittance.expectedPayout,
        reportedBy: req.userId,
        status: "open",
        description:
          "Actual payout amount does not match the authorized payout amount",
      });

      // Audit log
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
        difference: actualPayout - remittance.expectedPayout,
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

    // 7. Audit log
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

    // Only completed transactions should be committed
    if (remittance.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Only completed remittances can be committed to blockchain",
      });
    }

    // Prevent duplicate blockchain commits
    if (remittance.blockchainTxSignature) {
      return res.status(400).json({
        success: false,
        message: "Remittance is already committed to blockchain",
        blockchainTxSignature: remittance.blockchainTxSignature,
      });
    }

    // Data that represents the transaction
    const transactionData = {
      transactionId: remittance.transactionId,
      sender: remittance.sender.toString(),
      receiver: remittance.receiver.toString(),
      authorizedAmount: remittance.authorizedAmount,
      sendingCurrency: remittance.sendingCurrency,
      exchangeRate: remittance.exchangeRate,
      fee: remittance.fee,
      expectedPayout: remittance.expectedPayout,
      actualPayout: remittance.actualPayout,
      payoutCurrency: remittance.payoutCurrency,
      payoutMethod: remittance.payoutMethod,
      status: remittance.status,
    };

    // Generate SHA-256 hash
    const transactionHash = generateTransactionHash(transactionData);

    // Send hash to Solana
    const blockchainResult = await anchorTransactionHash(transactionHash);

    // Store blockchain information
    remittance.transactionHash = transactionHash;

    remittance.blockchainTxSignature = blockchainResult.signature;

    remittance.blockchainNetwork = blockchainResult.network;

    await remittance.save();

    // Audit log
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

export const verifyRemittanceBlockchain = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    // Find the remittance
    const remittance = await Remittance.findById(id);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        message: "Remittance not found",
      });
    }

    // A blockchain signature must exist
    if (!remittance.blockchainTxSignature) {
      return res.status(400).json({
        success: false,
        message: "This remittance has not been committed to blockchain",
      });
    }

    // Recreate the exact transaction data
    const transactionData = {
      transactionId: remittance.transactionId,
      sender: remittance.sender.toString(),
      receiver: remittance.receiver.toString(),
      authorizedAmount: remittance.authorizedAmount,
      sendingCurrency: remittance.sendingCurrency,
      exchangeRate: remittance.exchangeRate,
      fee: remittance.fee,
      expectedPayout: remittance.expectedPayout,
      actualPayout: remittance.actualPayout,
      payoutCurrency: remittance.payoutCurrency,
      payoutMethod: remittance.payoutMethod,
      status: remittance.status,
    };

    // Generate the hash again
    const recalculatedHash = generateTransactionHash(transactionData);

    // Compare with the original hash
    const hashMatches = recalculatedHash === remittance.transactionHash;

    // Check the Solana signature
    const blockchainStatus = await verifyBlockchainTransaction(
      remittance.blockchainTxSignature,
    );

    const verified =
      hashMatches &&
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

// =====================================================
// TEMPORARY TAMPER TEST
// =====================================================
// ⚠️ FOR SECURITY TESTING ONLY
//
// This intentionally changes the authorized amount
// after the transaction has already been committed
// to the blockchain.
//
// The blockchain still contains the ORIGINAL hash.
// Therefore, verification should fail.
//
// DELETE THIS FUNCTION AFTER TESTING.
// =====================================================

// export const tamperTestRemittance = async (req: any, res: any) => {
//   try {
//     const { id } = req.params;

//     const remittance = await Remittance.findById(id);

//     if (!remittance) {
//       return res.status(404).json({
//         success: false,
//         message: "Remittance not found",
//       });
//     }

//     // Save original value for the response
//     const originalAmount = remittance.authorizedAmount;

//     // INTENTIONALLY MODIFY THE DATA
//     remittance.authorizedAmount = originalAmount + 1000;

//     await remittance.save();

//     return res.status(200).json({
//       success: true,
//       message: "TAMPER TEST: Remittance data modified",
//       warning: "This was an intentional security test",
//       remittance: {
//         id: remittance._id,
//         transactionId: remittance.transactionId,
//         originalAuthorizedAmount: originalAmount,
//         tamperedAuthorizedAmount: remittance.authorizedAmount,
//         blockchainHash: remittance.transactionHash,
//       },
//     });
//   } catch (error) {
//     console.error("Tamper test error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Tamper test failed",
//     });
//   }
// };
