export const USER_ROLES = [
  "sender",
  "receiver",
  "agent",
  "supervisor",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  sender: "/dashboard/sender",
  receiver: "/dashboard/receiver",
  agent: "/dashboard/agent",
  supervisor: "/dashboard/supervisor",
  admin: "/dashboard",
};

export const isUserRole = (role: unknown): role is UserRole =>
  typeof role === "string" &&
  Object.prototype.hasOwnProperty.call(ROLE_HOME_ROUTES, role);

export const getRoleHomeRoute = (role: unknown): string | null =>
  isUserRole(role) ? ROLE_HOME_ROUTES[role] : null;
