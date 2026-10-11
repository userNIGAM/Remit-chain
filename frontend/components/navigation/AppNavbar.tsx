"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { api } from "@/lib/api";
import { isUserRole, type UserRole } from "@/lib/roles";
import RoleNavbar from "@/components/navigation/RoleNavbar";

type SessionUser = {
  name: string;
  role: UserRole;
};

// Public routes that never show the authenticated navigation.
const HIDDEN_PREFIXES = ["/login", "/register"];

/**
 * Renders the authenticated navbar from the root layout so every page shares
 * one fixed bar. It resolves the live session itself (the httpOnly token is not
 * readable from JS) and renders nothing for guests or on public routes.
 */
export default function AppNavbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      try {
        const data = await api<{ user?: SessionUser }>("/auth/me");

        if (!active) return;

        setUser(
          data.user && isUserRole(data.user.role)
            ? { name: data.user.name, role: data.user.role }
            : null,
        );
      } catch {
        if (active) setUser(null);
      }
    };

    void loadUser();

    return () => {
      active = false;
    };
  }, [pathname]);

  const isHidden =
    pathname === "/" || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  if (isHidden || !user) return null;

  return <RoleNavbar user={user} />;
}
