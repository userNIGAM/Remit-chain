export const USER_ROLES = [
  "sender",
  "receiver",
  "agent",
  "supervisor",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const PUBLIC_ROLES = ["sender", "receiver"] as const;

export type PublicRole = (typeof PUBLIC_ROLES)[number];

export const STAFF_ROLES = ["agent", "supervisor", "admin"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
