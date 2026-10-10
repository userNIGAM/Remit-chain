import { Router } from "express";

import {
  findReceiver,
  createRemittance,
  approveRemittance,
  processRemittance,
  readyForPayout,
  completePayout,
  commitToBlockchain,
  verifyRemittanceBlockchain,
  getRemittanceById,
  getRemittances,
  getRemittanceStats,
} from "../controllers/remittanceController.js";

import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// =====================================================
// READ
// =====================================================

// Role-aware list: senders/receivers only ever see their own side.
router.get("/", protect, getRemittances);

// Role-aware counters. Staff see the whole system, customers see their own.
router.get("/stats", protect, getRemittanceStats);

// Receiver lookup. Senders, agents, supervisors and admins may all resolve a
// receiver for a new remittance; receivers have no reason to.
router.get(
  "/receiver",
  protect,
  requireRole("sender", "agent", "supervisor", "admin"),
  findReceiver,
);

router.get("/:id", protect, getRemittanceById);

// =====================================================
// CREATE
// =====================================================

// Senders create online remittances; operations staff create branch
// (agent channel) remittances on behalf of a customer.
router.post(
  "/",
  protect,
  requireRole("sender", "agent", "supervisor", "admin"),
  createRemittance,
);

// =====================================================
// LIFECYCLE
// =====================================================

// Approving is a supervisory act — agents must not be able to self-approve.
router.patch(
  "/:id/approve",
  protect,
  requireRole("admin", "supervisor"),
  approveRemittance,
);

router.patch(
  "/:id/process",
  protect,
  requireRole("admin", "supervisor", "agent"),
  processRemittance,
);

router.patch(
  "/:id/ready-for-payout",
  protect,
  requireRole("admin", "supervisor", "agent"),
  readyForPayout,
);

router.post(
  "/:id/payout",
  protect,
  requireRole("admin", "supervisor", "agent"),
  completePayout,
);

// =====================================================
// BLOCKCHAIN
// =====================================================

// Committing anchors a tamper-evident record, so it stays with supervisory
// roles. There is deliberately no route that mutates a committed record.
router.post(
  "/:id/blockchain",
  protect,
  requireRole("admin", "supervisor"),
  commitToBlockchain,
);

// Verification is read-only and every role may confirm its own transfers.
router.get("/:id/verify-blockchain", protect, verifyRemittanceBlockchain);

export default router;
