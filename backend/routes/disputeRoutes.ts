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

// Role-aware listing (staff = all, users = own)
router.get("/", protect, getDisputes);

// State transitions — staff only
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