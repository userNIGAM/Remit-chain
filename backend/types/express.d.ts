import type { UserRole } from "./roles.js";

/**
 * Augments Express's `Request` with the identity that `protect` attaches.
 *
 * Declaring the fields globally (rather than exporting a narrower
 * `AuthenticatedRequest` subclass) is what keeps every controller assignable to
 * `RequestHandler`: a subclass would narrow the `req` parameter, and Express's
 * router overloads would no longer match.
 *
 * They are optional because a `Request` is not authenticated until `protect`
 * runs. Use `requireUser(req)` from `./auth.js` inside a controller to obtain
 * them as a guaranteed pair.
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: UserRole;
    }
  }
}

export {};
