import mongoose, { Document, Schema } from "mongoose";

// TypeScript interface
export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
  password: string;

  role: "sender" | "receiver" | "agent" | "supervisor" | "admin";

  address?: string;
  country?: string;

  // Public ID that can be shared with other people
  // Example: NP-48291
  remitId: string;

  // Whether the user's identity has been verified
  verificationStatus: "pending" | "verified" | "rejected";

  // Preferred way to receive money
  preferredPayoutMethod?: "bank" | "wallet" | "cash";

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    // User's full name
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Email used for login
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Phone number
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Hashed password
    password: {
      type: String,
      required: true,
    },

    // User's role in the system
    role: {
      type: String,
      enum: ["sender", "receiver", "agent", "supervisor", "admin"],
      default: "receiver",
      required: true,
    },

    // Address
    address: {
      type: String,
      trim: true,
    },

    // Country
    country: {
      type: String,
      trim: true,
    },

    // Public identifier for finding a receiver
    // Example: NP-48291
    remitId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // KYC/identity verification status
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },

    // Receiver's preferred payout method
    preferredPayoutMethod: {
      type: String,
      enum: ["bank", "wallet", "cash"],
    },

    // Allows admin to deactivate an account
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
