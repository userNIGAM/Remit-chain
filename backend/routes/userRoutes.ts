import { Router } from "express";

import {
  getUsers,
  getUserById,
  createStaff,
  verifyUser,
  updateUserStatus,
} from "../controllers/userController.js";

import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// =====================================================
// USER MANAGEMENT
// =====================================================

// Supervisors get read access for verification purposes only.
router.get("/", protect, requireRole("admin", "supervisor"), getUsers);

router.get("/:id", protect, requireRole("admin", "supervisor"), getUserById);

// Creating privileged accounts is admin-only: privileged roles are never
// self-service through public registration.
router.post("/staff", protect, requireRole("admin"), createStaff);

// KYC decision on customer accounts.
router.patch(
  "/:id/verify",
  protect,
  requireRole("admin", "supervisor"),
  verifyUser,
);

// Activating / deactivating accounts is admin-only.
router.patch("/:id/status", protect, requireRole("admin"), updateUserStatus);

export default router;
