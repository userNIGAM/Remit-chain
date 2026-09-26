import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAuditLog extends Document {
  remittance: Types.ObjectId;

  // User who performed the action
  actor?: Types.ObjectId;

  action:
    | "created"
    | "verified"
    | "approved"
    | "rejected"
    | "processing"
    | "ready_for_payout"
    | "payout_completed"
    | "cancelled"
    | "error_reported"
    | "investigation_started"
    | "recovery_requested"
    | "dispute_resolved"
    | "blockchain_committed";

  // Optional description
  description?: string;

  // Store previous status when status changes
  previousStatus?: string;

  // Store new status
  newStatus?: string;

  // Optional IP address
  ipAddress?: string;

  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    // Transaction related to this event
    remittance: {
      type: Schema.Types.ObjectId,
      ref: "Remittance",
      required: true,
      index: true,
    },

    // Person who performed the action
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // What happened
    action: {
      type: String,
      enum: [
        "created",
        "verified",
        "approved",
        "rejected",
        "processing",
        "ready_for_payout",
        "payout_completed",
        "cancelled",
        "error_reported",
        "investigation_started",
        "recovery_requested",
        "dispute_resolved",
        "blockchain_committed",
      ],
      required: true,
    },

    // Human-readable explanation
    description: {
      type: String,
      trim: true,
    },

    // Previous transaction status
    previousStatus: {
      type: String,
    },

    // New transaction status
    newStatus: {
      type: String,
    },

    // IP address of actor
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

auditLogSchema.index({ remittance: 1, createdAt: -1 });

const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

export default AuditLog;
