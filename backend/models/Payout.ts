import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPayout extends Document {
  remittance: Types.ObjectId;
  receiver: Types.ObjectId;

  method: "bank" | "wallet" | "cash";

  amount: number;
  currency: string;

  providerReference?: string;

  status: "pending" | "processing" | "completed" | "failed";

  processedBy?: Types.ObjectId;
  processedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<IPayout>(
  {
    // Remittance associated with this payout
    remittance: {
      type: Schema.Types.ObjectId,
      ref: "Remittance",
      required: true,
      unique: true,
      index: true,
    },

    // Person receiving the money
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    //   index: true,
    },

    // How receiver gets the money
    method: {
      type: String,
      enum: ["bank", "wallet", "cash"],
      required: true,
    },

    // Actual amount paid
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Currency of payout
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    // Mock reference for hackathon
    // Example: MOCK-1758520000000
    providerReference: {
      type: String,
      trim: true,
    },

    // Payout lifecycle
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },

    // Admin/agent/supervisor who processed payout
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

payoutSchema.index({ receiver: 1 });
payoutSchema.index({ status: 1 });

const Payout = mongoose.model<IPayout>("Payout", payoutSchema);

export default Payout;
