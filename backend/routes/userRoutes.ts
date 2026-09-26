import { Router } from "express";

import { verifyUser } from "../controllers/userController.js";

import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// =====================================================
// VERIFY USER
// =====================================================
//
// Only:
// - admin
// - supervisor
//
// can verify users.
// =====================================================

router.patch(
  "/:id/verify",
  protect,
  requireRole("admin", "supervisor"),
  verifyUser,
);

export default router;
