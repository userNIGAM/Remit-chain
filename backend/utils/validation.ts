import mongoose from "mongoose";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A space-free run of 7-15 digits. Loose on purpose: senders can be abroad
// and receivers are not always on a local 10-digit mobile.
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

export const isValidObjectId = (value: unknown): value is string =>
  typeof value === "string" && mongoose.Types.ObjectId.isValid(value);

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const isValidEmail = (value: unknown): value is string =>
  typeof value === "string" && EMAIL_REGEX.test(value.trim());

export const normalizePhone = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim().replace(/[\s-]/g, "");

  return PHONE_REGEX.test(trimmed) ? trimmed : null;
};

/**
 * Accepts only finite numbers. JSON bodies are untrusted, so a string such as
 * `"abc"` must be rejected instead of silently becoming NaN downstream
 * (every NaN comparison evaluates to false and would slip past range checks).
 */
export const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

/** Money is stored and compared at 2 decimal places. */
export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/** Guards against floating point drift when comparing payout amounts. */
export const moneyEquals = (a: number, b: number): boolean =>
  Math.abs(roundMoney(a) - roundMoney(b)) < 0.005;

export const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
