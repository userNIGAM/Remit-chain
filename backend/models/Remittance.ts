import mongoose, { Document, Schema, Types } from "mongoose";

export interface IRemittance extends Document {
  transactionId: string;

  sender: Types.ObjectId;
  receiver: Types.ObjectId;

  // Agent who created the transaction
  // Null when transaction was created online
  createdBy?: Types.ObjectId;

  // How the transaction was initiated
  channel: "online" | "agent";

  // Amount sender is sending
  authorizedAmount: number;

  // Currency sender is sending
  sendingCurrency: string;

  // Exchange rate used for conversion
  exchangeRate: number;

  // Remittance/service fee
  fee: number;

  // Amount receiver should receive
  expectedPayout: number;

  // Currency receiver receives
  payoutCurrency: string;

  // Actual amount paid to receiver
  actualPayout?: number;

  // How receiver receives money
  payoutMethod: "bank" | "wallet" | "cash";

  // Current transaction status
  status:
    | "created"
    | "verified"
    | "approved"
    | "processing"
    | "ready_for_payout"
    | "completed"
    | "rejected"
    | "cancelled"
    | "error_reported"
    | "investigation"
    | "recovery_requested"
    | "recovered";

  // Blockchain information
  transactionHash?: string;
  blockchainTxSignature?: string;
  blockchainNetwork?: string;

  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  completedAt?: Date;
}

const remittanceSchema = new Schema<IRemittance>(
  {
    // Human-readable transaction ID
    // Example: REM-20260920-001
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Person sending money
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Person receiving money
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Agent who created the transaction
    // This is optional because online transactions
    // do not have an agent.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Online or physical branch
    channel: {
      type: String,
      enum: ["online", "agent"],
      required: true,
    },

    // Amount authorized by sender
    authorizedAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Sending currency
    // Example: AED
    sendingCurrency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    // Exchange rate
    // Example:
    // 1 AED = 36.50 NPR
    exchangeRate: {
      type: Number,
      required: true,
      min: 0,
    },

    // Service fee
    fee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Expected amount receiver should receive
    expectedPayout: {
      type: Number,
      required: true,
      min: 0,
    },

    // Receiving currency
    // Example: NPR
    payoutCurrency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    // Actual amount paid
    //
    // This is intentionally separate from expectedPayout.
    //
    // Example:
    // expectedPayout = 18,250
    // actualPayout = 18,250
    //
    // If an employee accidentally pays 182,500:
    // actualPayout = 182,500
    //
    // We can detect the mismatch.
    actualPayout: {
      type: Number,
      min: 0,
    },

    // Bank / wallet / cash
    payoutMethod: {
      type: String,
      enum: ["bank", "wallet", "cash"],
      required: true,
    },

    // Current state of transaction
    status: {
      type: String,
      enum: [
        "created",
        "verified",
        "approved",
        "processing",
        "ready_for_payout",
        "completed",
        "rejected",
        "cancelled",
        "error_reported",
        "investigation",
        "recovery_requested",
        "recovered",
      ],
      default: "created",
    },

    // SHA-256 hash of important transaction data
    //
    // This is what we will later anchor to blockchain.
    transactionHash: {
      type: String,
    },

    // Solana transaction signature
    //
    // Example:
    // 5abc...xyz
    //
    // We will fill this when we implement blockchain.
    blockchainTxSignature: {
      type: String,
    },

    // Example: solana-devnet
    blockchainNetwork: {
      type: String,
    },

    approvedAt: {
      type: Date,
    },

    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Useful indexes for transaction searching
remittanceSchema.index({ sender: 1 });
remittanceSchema.index({ receiver: 1 });
remittanceSchema.index({ status: 1 });

const Remittance = mongoose.model<IRemittance>("Remittance", remittanceSchema);

export default Remittance;
