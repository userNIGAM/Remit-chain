"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Wallet } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/api";
import { getRoleHomeRoute, type UserRole } from "@/lib/roles";

type NavbarUser = {
  name: string;
  role: UserRole;
};

type NavigationItem = {
  href: string;
  label: string;
};

const NAVIGATION: Record<UserRole, NavigationItem[]> = {
  sender: [
    { href: "/dashboard/sender", label: "Dashboard" },
    { href: "/remittance/create", label: "Send money" },
    { href: "/remittance", label: "My transfers" },
  ],
  receiver: [
    { href: "/dashboard/receiver", label: "Dashboard" },
    { href: "/remittance", label: "Incoming transfers" },
  ],
  agent: [
    { href: "/dashboard/agent", label: "Dashboard" },
    { href: "/remittance", label: "Transfers" },
    { href: "/disputes", label: "Disputes" },
  ],
  supervisor: [
    { href: "/dashboard/supervisor", label: "Dashboard" },
    { href: "/remittance", label: "Transfers" },
    { href: "/disputes", label: "Disputes" },
    { href: "/dashboard/audit-logs", label: "Audit logs" },
    { href: "/dashboard/users", label: "Users" },
  ],
  admin: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/remittance", label: "Transfers" },
    { href: "/disputes", label: "Disputes" },
    { href: "/dashboard/audit-logs", label: "Audit logs" },
    { href: "/dashboard/users", label: "Users" },
  ],
};

export default function RoleNavbar({ user }: { user: NavbarUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const home = getRoleHomeRoute(user.role) || "/dashboard";

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      setLogoutError("");
      await api("/auth/logout", { method: "POST", body: JSON.stringify({}) });
      router.replace("/login");
      router.refresh();
    } catch (error: unknown) {
      setLogoutError(error instanceof Error ? error.message : "Logout failed");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex min-h-16 items-center justify-between gap-4">
          <Link href={home} className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-700 text-white">
              <Wallet className="h-4 w-4" />
            </span>
            RemitChain
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {NAVIGATION[user.role].map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs capitalize text-gray-500">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="Toggle navigation"
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {open && (
          <div className="border-t border-gray-100 py-3 lg:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {NAVIGATION[user.role].map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onClick={() => setOpen(false)}
                />
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 sm:hidden">
              <div>
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs capitalize text-gray-500">{user.role}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>
        )}

        {logoutError && <p className="pb-3 text-sm text-red-700">{logoutError}</p>}
      </div>
    </header>
  );
}

function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: NavigationItem;
  pathname: string;
  onClick?: () => void;
}) {
  const active =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-green-50 text-green-800"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      {item.label}
    </Link>
  );
}
