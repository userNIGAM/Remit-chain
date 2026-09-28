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
  // tamperTestRemittance,
} from "../controllers/remittanceController.js";

import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();
router.get(
  "/",
  protect,
  getRemittances
);
router.get(
  "/stats",
  protect,
  getRemittanceStats
);
router.get("/receiver", protect, findReceiver);
router.get("/:id", protect, getRemittanceById);
router.post("/", protect, createRemittance);

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

router.post(
  "/:id/blockchain",
  protect,
  requireRole("admin", "supervisor"),
  commitToBlockchain,
);

router.get("/:id/verify-blockchain", protect, verifyRemittanceBlockchain);

// router.patch(
//   "/:id/tamper-test",
//   protect,
//   requireRole("admin"),
//   tamperTestRemittance
// );

export default router;
