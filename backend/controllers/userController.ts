import { type Request, type Response } from "express";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import generateRemitId from "../utils/generateRemitId.js";
import { requireUser } from "../types/auth.js";
import {
  isNonEmptyString,
  isValidEmail,
  isValidObjectId,
  normalizePhone,
} from "../utils/validation.js";

const MIN_PASSWORD_LENGTH = 8;

// =====================================================
// GET ALL USERS
// =====================================================

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching users",
    });
  }
};

// =====================================================
// GET USER BY ID
// =====================================================

export const getUserById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id?: string };

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid user id",
      });

      return;
    }

    const user = await User.findById(id).select("-password");

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
    console.error("Get user error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching user",
    });
  }
};

// =====================================================
// CREATE STAFF ACCOUNT
// =====================================================

export const createStaff = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, phone, password, role, address, country } = req.body;

    // Only staff roles can be created here
    if (role !== "agent" && role !== "supervisor") {
      res.status(400).json({
        success: false,
        message: "Staff role must be either agent or supervisor",
      });

      return;
    }

    // Required fields
    if (!isNonEmptyString(name)) {
      res.status(400).json({
        success: false,
        message: "Name is required",
      });

      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({
        success: false,
        message: "Enter a valid email address",
      });

      return;
    }

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      res.status(400).json({
        success: false,
        message: "Enter a valid phone number (7-15 digits)",
      });

      return;
    }

    if (!isNonEmptyString(password) || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });

      return;
    }

    // Check email
    const existingEmail = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (existingEmail) {
      res.status(400).json({
        success: false,
        message: "Email already registered",
      });

      return;
    }

    // Check phone
    const existingPhone = await User.findOne({
      phone: normalizedPhone,
    });

    if (existingPhone) {
      res.status(400).json({
        success: false,
        message: "Phone number already registered",
      });

      return;
    }

    // Generate Remit ID
    let remitId = generateRemitId();

    while (await User.findOne({ remitId })) {
      remitId = generateRemitId();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create staff user
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: normalizedPhone,
      password: hashedPassword,

      role,

      address,
      country,

      remitId,

      // Staff account is considered verified
      verificationStatus: "verified",

      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        remitId: user.remitId,
        verificationStatus: user.verificationStatus,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Create staff error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while creating staff account",
    });
  }
};

// =====================================================
// VERIFY USER
// =====================================================

export const verifyUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params as { id?: string };

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid user id",
      });

      return;
    }

    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });

      return;
    }

    if (user.verificationStatus === "verified") {
      res.status(400).json({
        success: false,
        message: "User is already verified",
      });

      return;
    }

    user.verificationStatus = "verified";

    await user.save();

    res.status(200).json({
      success: true,
      message: "User verified successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        remitId: user.remitId,
        verificationStatus: user.verificationStatus,
      },
    });
  } catch (error) {
    console.error("Verify user error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while verifying user",
    });
  }
};

// =====================================================
// CHANGE USER STATUS
// =====================================================

export const updateUserStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId: actingUserId } = requireUser(req);
    const { id } = req.params as { id?: string };
    const { isActive } = req.body as { isActive?: unknown };

    if (typeof isActive !== "boolean") {
      res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });

      return;
    }

    if (!isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid user id",
      });

      return;
    }

    // An admin must not be able to lock themselves out. With a single admin
    // deployment that would leave the system unadministrable.
    if (id === actingUserId && isActive === false) {
      res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });

      return;
    }

    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });

      return;
    }

    user.isActive = isActive;

    await user.save();

    res.status(200).json({
      success: true,
      message: isActive ? "User account activated" : "User account deactivated",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Update user status error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while updating user status",
    });
  }
};
