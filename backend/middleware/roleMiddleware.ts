import { type NextFunction, type Request, type Response } from "express";

import { USER_ROLES, type UserRole } from "../types/roles.js";

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" &&
  (USER_ROLES as readonly string[]).includes(value);

export const requireRole = (...allowedRoles: UserRole[]) => {
  const allowed = new Set<UserRole>(allowedRoles);

  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    // authMiddleware should already have set userRole on the request.
    // A missing value means `protect` did not run on this route.
    const userRole = (req as { userRole?: unknown }).userRole;

    if (!isUserRole(userRole) || !allowed.has(userRole)) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action",
      });

      return;
    }

    next();
  };
};
