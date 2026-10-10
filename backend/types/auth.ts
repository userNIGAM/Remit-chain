import type { UserRole } from "./roles.js";

/**
 * Identity attached to a request by `protect`.
 *
 * These are declared via Express's global augmentation (see `express.d.ts`)
 * rather than by declaring a narrower `Request` subclass. A subclass would be
 * a *narrower* parameter type, so `router.get("/", protect, handler)` would
 * fail to resolve against Express's overloads. Augmenting keeps every handler
 * assignable to the standard `RequestHandler` signature.
 */
export const requireUser = (
  req: Express.Request,
): { userId: string; userRole: UserRole } => {
  if (!req.userId || !req.userRole) {
    // Reaching this means a route was wired without `protect`, which is a
    // programming error rather than a client mistake.
    throw new Error(
      "requireUser called on a request that has not been authenticated",
    );
  }

  return { userId: req.userId, userRole: req.userRole };
};

/** agent / supervisor / admin — the operations side of the business. */
export const isStaffRole = (role: unknown): role is UserRole =>
  role === "agent" || role === "supervisor" || role === "admin";

/** supervisor / admin — oversight: disputes, audit, blockchain anchoring. */
export const isPrivilegedRole = (role: unknown): role is UserRole =>
  role === "supervisor" || role === "admin";
