import mongoose, { Document, Schema, Types } from "mongoose";

export interface IRemittance extends Document {
  transactionId: string;

  sender: Types.ObjectId;
  receiver: Types.ObjectId;

  createdBy?: Types.ObjectId;

  channel: "online" | "agent";

  authorizedAmount: number;
  sendingCurrency: string;
  exchangeRate: number;
  fee: number;
  expectedPayout: number;
  payoutCurrency: string;
  actualPayout?: number;
  payoutMethod: "bank" | "wallet" | "cash";

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

  // Frozen data that was hashed at commit time.
  // Verification re-hashes THIS, not the live document,
  // so post-commit status changes don't break verification.
  blockchainSnapshot?: Record<string, unknown>;
  blockchainCommittedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  completedAt?: Date;
}

const remittanceSchema = new Schema<IRemittance>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    channel: {
      type: String,
      enum: ["online", "agent"],
      required: true,
    },

    authorizedAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    sendingCurrency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    exchangeRate: {
      type: Number,
      required: true,
      min: 0,
    },

    fee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    expectedPayout: {
      type: Number,
      required: true,
      min: 0,
    },

    payoutCurrency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    actualPayout: {
      type: Number,
      min: 0,
    },

    payoutMethod: {
      type: String,
      enum: ["bank", "wallet", "cash"],
      required: true,
    },

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

    transactionHash: {
      type: String,
    },

    blockchainTxSignature: {
      type: String,
    },

    blockchainNetwork: {
      type: String,
    },

    // Exact object that was hashed and anchored to Solana
    blockchainSnapshot: {
      type: Schema.Types.Mixed,
    },

    blockchainCommittedAt: {
      type: Date,
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

remittanceSchema.index({ sender: 1 });
remittanceSchema.index({ receiver: 1 });
remittanceSchema.index({ status: 1 });

const Remittance = mongoose.model<IRemittance>("Remittance", remittanceSchema);

export default Remittance;
