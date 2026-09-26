import { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import generateRemitId from "../utils/generateRemitId.js";

// =====================================================
// REGISTER
// =====================================================

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Get information from request body
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

    // 2. Validate required fields
    if (!name || !email || !phone || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email, phone and password are required",
      });

      return;
    }

    // 3. Check whether email already exists
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

    // 4. Check whether phone already exists
    const existingPhone = await User.findOne({
      phone,
    });

    if (existingPhone) {
      res.status(400).json({
        success: false,
        message: "Phone number already registered",
      });

      return;
    }

    // 5. Generate a public Remit ID
    let remitId = generateRemitId();

    // Make sure the generated ID does not already exist
    while (await User.findOne({ remitId })) {
      remitId = generateRemitId();
    }

    // 6. Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 7. Determine role
    //
    // For now:
    // - If no role is supplied, user becomes receiver.
    //
    // Later, we will restrict who can create
    // agent/supervisor/admin accounts.
const userRole =
  role === "sender"
    ? "sender"
    : "receiver";

    // 8. Create user
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

    // 9. Remove password before sending user data
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

    // 10. Send response
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

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Get login information
    const { email, password } = req.body;

    // 2. Validate input
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });

      return;
    }

    // 3. Find user
    //
    // We explicitly select password because later we may
    // choose to exclude it from normal queries.
    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+password");

    // 4. Check user
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });

      return;
    }

    // 5. Check whether account is active
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "Account is disabled",
      });

      return;
    }

    // 6. Compare password with hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });

      return;
    }

    // 7. Generate JWT
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
      {
        expiresIn: "7d",
      },
    );

    // 8. Store JWT inside HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,

      // In production with HTTPS:
      // secure: true
      secure: process.env.NODE_ENV === "production",

      // Helps protect against CSRF
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",

      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 9. Don't send password to frontend
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

    // 10. Response
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
    // authMiddleware will put the user's ID here
    const userId = (req as any).userId;

    // Find user
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
  // Delete authentication cookie
  res.clearCookie("token");

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};
