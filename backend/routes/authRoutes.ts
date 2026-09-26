import { Router } from "express";

import {
  register,
  login,
  getMe,
  logout,
} from "../controllers/authController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// Public routes

router.post("/register", register);

router.post("/login", login);

// Protected route

router.get("/me", protect, getMe);

// Logout

router.post("/logout", logout);

export default router;
