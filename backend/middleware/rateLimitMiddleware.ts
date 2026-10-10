import { type NextFunction, type Request, type Response } from "express";

// =====================================================
// RATE LIMITER  (fixed window, in-memory)
// =====================================================
//
// Guards the credential endpoints against brute force and account
// enumeration. In-process on purpose: this is a single-instance deployment and
// it avoids pulling in a dependency plus an external store for a handful of
// routes. Swap the store for Redis before running more than one instance.
// =====================================================

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const SWEEP_INTERVAL_MS = 60_000;

const sweep = setInterval(() => {
  const now = Date.now();

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}, SWEEP_INTERVAL_MS);

// Do not hold the event loop open just for the sweeper.
sweep.unref?.();

const sendRateLimited = (
  res: Response,
  retryAfterSeconds: number,
): void => {
  res.setHeader("Retry-After", String(retryAfterSeconds));

  res.status(429).json({
    success: false,
    message: "Too many requests. Please try again shortly.",
  });
};

const clientKey = (req: Request): string =>
  req.ip || req.socket.remoteAddress || "unknown";

export const rateLimit = (options?: {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
}) => {
  const windowMs = options?.windowMs ?? 15 * 60 * 1000;
  const max = options?.max ?? 10;
  const keyPrefix = options?.keyPrefix ?? "global";

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${keyPrefix}:${clientKey(req)}`;

    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });

      next();
      return;
    }

    if (existing.count >= max) {
      sendRateLimited(res, Math.ceil((existing.resetAt - now) / 1000));

      return;
    }

    existing.count += 1;

    next();
  };
};
