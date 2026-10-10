import { Router } from "express";

import {
  register,
  login,
  getMe,
  updateMyProfile,
  logout,
} from "../controllers/authController.js";

import { protect } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/rateLimitMiddleware.js";

const router = Router();

// =====================================================
// PUBLIC ROUTES
// =====================================================

// Credential endpoints are throttled per IP to blunt brute force attempts and
// account enumeration.
router.post(
  "/register",
  rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: "register" }),
  register,
);

router.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "login" }),
  login,
);

// =====================================================
// PROTECTED ROUTES
// =====================================================

router.get("/me", protect, getMe);

// Every role can view and maintain its own profile, including a receiver's
// preferred payout method.
router.patch("/me", protect, updateMyProfile);

// Logout is intentionally not behind `protect`. Clearing the session cookies
// must stay possible even when the token has already expired, otherwise a
// stale session can never be dismissed from the client. It is still CSRF
// protected, so a third-party site cannot force a logout.
router.post("/logout", logout);

export default router;
