import { type Request, type Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import generateRemitId from "../utils/generateRemitId.js";

// =====================================================
// COOKIE OPTIONS
// =====================================================

const isProd = process.env.NODE_ENV === "production";

const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ("none" as const) : ("lax" as const),
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

// CSRF cookie MUST be readable by JavaScript
const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: isProd,
  sameSite: isProd ? ("none" as const) : ("lax" as const),
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

// =====================================================
// REGISTER
// =====================================================

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      address,
      country,
      preferredPayoutMethod,
    } = req.body;

    if (!name || !email || !phone || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email, phone and password are required",
      });
      return;
    }

    const existingEmail = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingEmail) {
      res.status(400).json({
        success: false,
        message: "Email already registered",
      });
      return;
    }

    const existingPhone = await User.findOne({ phone });

    if (existingPhone) {
      res.status(400).json({
        success: false,
        message: "Phone number already registered",
      });
      return;
    }

    if (role !== "sender" && role !== "receiver") {
      res.status(400).json({
        success: false,
        message: "Public registration is only available for sender or receiver",
      });
      return;
    }

    const userRole = role;

    let remitId = generateRemitId();
    while (await User.findOne({ remitId })) {
      remitId = generateRemitId();
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      role: userRole,
      address,
      country,
      remitId,
      verificationStatus: "pending",
      preferredPayoutMethod,
      isActive: true,
    });

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      remitId: user.remitId,
      verificationStatus: user.verificationStatus,
      preferredPayoutMethod: user.preferredPayoutMethod,
    };

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

// =====================================================
// LOGIN
// =====================================================

type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

export const login = async (
  req: Request<Record<string, string>, unknown, LoginRequestBody>,
  res: Response,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "Account is disabled",
      });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      res.status(500).json({
        success: false,
        message: "JWT secret is not configured",
      });
      return;
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      secret,
      { expiresIn: "7d" },
    );

    // JWT inside HTTP-only cookie
    res.cookie("token", token, TOKEN_COOKIE_OPTIONS);

    // CSRF token (readable by the frontend)
    const csrfToken = crypto.randomBytes(32).toString("hex");
    res.cookie("csrfToken", csrfToken, CSRF_COOKIE_OPTIONS);

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      remitId: user.remitId,
      verificationStatus: user.verificationStatus,
      preferredPayoutMethod: user.preferredPayoutMethod,
    };

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: userResponse,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

// =====================================================
// GET CURRENT USER
// =====================================================

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// LOGOUT
// =====================================================

export const logout = (req: Request, res: Response): void => {
  res.clearCookie("token", TOKEN_COOKIE_OPTIONS);
  res.clearCookie("csrfToken", CSRF_COOKIE_OPTIONS);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};
