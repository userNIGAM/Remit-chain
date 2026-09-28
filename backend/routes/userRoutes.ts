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

// Get all users
router.get("/", protect, requireRole("admin", "supervisor"), getUsers);

// Get single user
router.get("/:id", protect, requireRole("admin", "supervisor"), getUserById);

// Create staff account
// Admin only
router.post("/staff", protect, requireRole("admin"), createStaff);

// Verify user
router.patch(
  "/:id/verify",
  protect,
  requireRole("admin", "supervisor"),
  verifyUser,
);

// Activate / deactivate user
// Admin only
router.patch("/:id/status", protect, requireRole("admin"), updateUserStatus);

export default router;
