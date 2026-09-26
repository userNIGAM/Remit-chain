import mongoose, { Document, Schema, Types } from "mongoose";

export interface IDispute extends Document {
  remittance: Types.ObjectId;

  type: "amount_mismatch" | "duplicate_payout" | "wrong_receiver" | "other";

  expectedAmount: number;
  actualAmount?: number;

  difference?: number;

  reportedBy: Types.ObjectId;

  status:
    | "open"
    | "investigation"
    | "recovery_requested"
    | "resolved"
    | "closed";

  description?: string;

  resolution?: string;

  resolvedBy?: Types.ObjectId;

  resolvedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const disputeSchema = new Schema<IDispute>(
  {
    // Transaction where the problem occurred
    remittance: {
      type: Schema.Types.ObjectId,
      ref: "Remittance",
      required: true,
      index: true,
    },

    // Type of problem
    type: {
      type: String,
      enum: ["amount_mismatch", "duplicate_payout", "wrong_receiver", "other"],
      required: true,
    },

    // Amount that should have been paid
    expectedAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Amount that was actually paid
    actualAmount: {
      type: Number,
      min: 0,
    },

    // Difference between expected and actual
    difference: {
      type: Number,
      min: 0,
    },

    // Person who reported the problem
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Current dispute state
    status: {
      type: String,
      enum: [
        "open",
        "investigation",
        "recovery_requested",
        "resolved",
        "closed",
      ],
      default: "open",
    },

    // Explanation of the issue
    description: {
      type: String,
      trim: true,
    },

    // Final resolution
    resolution: {
      type: String,
      trim: true,
    },

    // Supervisor/admin who resolved it
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

disputeSchema.index({ status: 1 });

const Dispute = mongoose.model<IDispute>("Dispute", disputeSchema);

export default Dispute;
