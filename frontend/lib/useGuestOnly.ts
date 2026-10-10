"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { getRoleHomeRoute, type UserRole } from "@/lib/roles";

type SessionResponse = {
  user?: {
    role?: UserRole;
  };
};

/**
 * Keeps signed-in people out of public authentication screens. The session
 * token stays HttpOnly; `/auth/me` is the only source of truth for it.
 */
export function useGuestOnly(): boolean {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const data = await api<SessionResponse>("/auth/me");
        const home = getRoleHomeRoute(data.user?.role);

        if (home) {
          router.replace(home);
          return;
        }
      } catch {
        // No valid session: render the public page normally.
      }

      if (active) setCheckingSession(false);
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  return checkingSession;
}
