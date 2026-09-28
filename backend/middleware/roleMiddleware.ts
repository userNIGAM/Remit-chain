import { type Request, type Response, type NextFunction } from "express";


export const requireRole = (
  ...allowedRoles: string[]
) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {

    // authMiddleware should already have added
    // userRole to the request.
    const userRole = (req as any).userRole;

    // Check whether user's role is allowed
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action",
      });

      return;
    }

    next();
  };
};