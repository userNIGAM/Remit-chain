import { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import { USER_ROLES, type UserRole } from "../types/roles.js";

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================
//
// The JWT only proves *who* the caller is. Role and account status are read
// from the database on every request so that:
//   - deactivating an account takes effect immediately instead of after the
//     7 day token lifetime, and
//   - a role change is honoured on the next call.
//
// The token payload is intentionally not trusted for authorisation.
// =====================================================

type TokenPayload = {
  userId?: unknown;
};

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" &&
  (USER_ROLES as readonly string[]).includes(value);

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. Get token from HTTP-only cookie
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });

      return;
    }

    // 2. Get JWT secret
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      res.status(500).json({
        success: false,
        message: "JWT secret is not configured",
      });

      return;
    }

    // 3. Verify JWT
    const decoded = jwt.verify(token, secret) as TokenPayload;

    if (typeof decoded.userId !== "string" || !decoded.userId) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token",
      });

      return;
    }

    // 4. Resolve the live account
    const user = await User.findById(decoded.userId).select(
      "role isActive",
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Account no longer exists",
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

    if (!isUserRole(user.role)) {
      res.status(403).json({
        success: false,
        message: "Account has an unsupported role",
      });

      return;
    }

    // 5. Continue to controller
    req.userId = user._id.toString();
    req.userRole = user.role;

    next();
  } catch (error) {
    if (error && typeof error === "object" && "name" in error) {
      const name = String((error as { name?: unknown }).name);

      // A malformed id in the token is a bad token, not a server fault.
      if (name === "CastError") {
        res.status(401).json({
          success: false,
          message: "Invalid or expired authentication token",
        });

        return;
      }
    }

    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });

    return;
  }
};
