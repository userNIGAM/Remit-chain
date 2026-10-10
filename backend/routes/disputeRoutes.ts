import { Router } from "express";

import {
  getDisputes,
  getDisputeForRemittance,
  startInvestigation,
  requestRecovery,
  resolveDispute,
} from "../controllers/disputeController.js";

import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// =====================================================
// READ
// =====================================================

// Full dispute queue. Oversight is a supervisory responsibility, so agents are
// not listed here.
router.get("/", protect, requireRole("admin", "supervisor"), getDisputes);

// Dispute attached to a single remittance. Available to the sender, the
// receiver and staff so they can see why a payout was blocked.
router.get("/remittance/:id", protect, getDisputeForRemittance);

// =====================================================
// STATE TRANSITIONS — supervisory only
// =====================================================

router.patch(
  "/:id/investigate",
  protect,
  requireRole("admin", "supervisor"),
  startInvestigation,
);

router.patch(
  "/:id/recovery",
  protect,
  requireRole("admin", "supervisor"),
  requestRecovery,
);

router.patch(
  "/:id/resolve",
  protect,
  requireRole("admin", "supervisor"),
  resolveDispute,
);

export default router;
