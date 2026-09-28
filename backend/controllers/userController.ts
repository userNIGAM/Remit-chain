import { type Request, type Response } from "express";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import generateRemitId from "../utils/generateRemitId.js";

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
    const { id } = req.params;

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
    if (!name || !email || !phone || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email, phone and password are required",
      });

      return;
    }

    // Check email
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

    // Check phone
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

    // Generate Remit ID
    let remitId = generateRemitId();

    while (await User.findOne({ remitId })) {
      remitId = generateRemitId();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create staff user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
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
    const { id } = req.params;

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
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(400).json({
        success: false,
        message: "isActive must be true or false",
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
