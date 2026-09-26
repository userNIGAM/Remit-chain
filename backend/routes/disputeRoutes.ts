import { Router } from "express";

import {
  getDisputes,
  startInvestigation,
  requestRecovery,
  resolveDispute,
} from "../controllers/disputeController.js";

import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// Get disputes
router.get("/", protect, requireRole("admin", "supervisor"), getDisputes);

// Start investigation
router.patch(
  "/:id/investigate",
  protect,
  requireRole("admin", "supervisor"),
  startInvestigation,
);

// Request recovery
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
  resolveDispute
);

export default router;
