import { type Request, type Response, type NextFunction } from "express";

// =====================================================
// CSRF PROTECTION  (double-submit cookie pattern)
// =====================================================
//
// 1. On login/register, the server sets a readable cookie
//    named "csrfToken" alongside the httpOnly "token" cookie.
//
// 2. The frontend reads "csrfToken" (JS can access it) and
//    sends it back on every mutating request as the header
//    "X-CSRF-Token".
//
// 3. This middleware requires that header and the cookie
//    match before allowing a state-changing request.
//
// A malicious origin cannot read the cookie (same-origin
// policy) and therefore cannot forge the header.
// =====================================================

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

// Endpoints that initiate a session have no CSRF token yet
// and are already protected by credentials in the body.
const CSRF_EXEMPT_PATHS = ["/api/auth/login", "/api/auth/register"];

export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // 1. Safe methods never mutate state
  if (SAFE_METHODS.includes(req.method)) {
    next();
    return;
  }

  // 2. Login/register are exempt — no session exists yet
  const fullPath = req.originalUrl.split("?")[0] ?? "";
  if (CSRF_EXEMPT_PATHS.some((p) => fullPath.startsWith(p))) {
    next();
    return;
  }

  // 3. Both values must be present and must match
  const cookieToken = req.cookies?.csrfToken;
  const headerToken = req.headers["x-csrf-token"];

  if (
    typeof cookieToken !== "string" ||
    typeof headerToken !== "string" ||
    cookieToken.length === 0 ||
    headerToken.length === 0 ||
    cookieToken !== headerToken
  ) {
    res.status(403).json({
      success: false,
      message: "Invalid or missing CSRF token",
    });
    return;
  }

  next();
};