import { type Request, type Response } from "express";

import User from "../models/User.js";


// =====================================================
// VERIFY USER
// =====================================================
//
// Admin/supervisor can verify a user's identity.
//
// For our hackathon this represents the KYC verification
// process. We are NOT implementing real KYC document
// verification.
// =====================================================

export const verifyUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {

    // 1. Get user ID from URL
    //
    // Example:
    //
    // PATCH /api/users/verify/65abc123
    //
    const { id } = req.params;

    // 2. Find user
    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });

      return;
    }

    // 3. Check whether already verified
    if (user.verificationStatus === "verified") {
      res.status(400).json({
        success: false,
        message: "User is already verified",
      });

      return;
    }

    // 4. Update verification status
    user.verificationStatus = "verified";

    // 5. Save
    await user.save();

    // 6. Return user without password
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