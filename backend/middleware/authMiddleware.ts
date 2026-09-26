import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

export const protect = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // 1. Get token from HTTP-only cookie
    const token = req.cookies?.token;

    // 2. Check whether token exists
    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });

      return;
    }

    // 3. Get JWT secret
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      res.status(500).json({
        success: false,
        message: "JWT secret is not configured",
      });

      return;
    }

    // 4. Verify JWT
    const decoded = jwt.verify(token, secret) as {
      userId: string;
      role: string;
    };

    // 5. Store authenticated user's information
    // on the request.
    //
    // Controllers can access:
    //
    // req.userId
    // req.userRole
    //
    (req as any).userId = decoded.userId;
    (req as any).userRole = decoded.role;

    // 6. Continue to controller
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });

    return;
  }
};
