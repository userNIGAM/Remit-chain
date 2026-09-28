"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Loader2,
  Send,
  Users,
  Wallet,
} from "lucide-react";

import { api } from "@/lib/api";
import { getRoleHomeRoute, isUserRole, type UserRole } from "@/lib/roles";

type RoleDashboardProps = {
  roleParam: string;
};

type DashboardUser = {
  name: string;
  email: string;
  role: UserRole;
  remitId: string;
};

type Action = {
  href: string;
  title: string;
  icon: typeof Send;
};

const ROLE_CONTENT: Record<
  UserRole,
  { title: string; description: string; actions: Action[] }
> = {
  sender: {
    title: "Sender Dashboard",
    description: "Create remittances and follow their progress.",
    actions: [
      { href: "/remittance/create", title: "Send money", icon: Send },
      { href: "/remittance", title: "Your remittances", icon: Wallet },
    ],
  },
  receiver: {
    title: "Receiver Dashboard",
    description: "Track incoming remittances and follow payouts.",
    actions: [
      { href: "/remittance", title: "Your remittances", icon: Wallet },
    ],
  },
  agent: {
    title: "Agent Dashboard",
    description: "Review remittances and manage payout operations.",
    actions: [
      { href: "/remittance", title: "Manage remittances", icon: Wallet },
      { href: "/disputes", title: "Disputes", icon: AlertTriangle },
    ],
  },
  supervisor: {
    title: "Supervisor Dashboard",
    description: "Oversee remittance processing, disputes, and activity.",
    actions: [
      { href: "/remittance", title: "Remittances", icon: Wallet },
      { href: "/disputes", title: "Disputes", icon: AlertTriangle },
      { href: "/dashboard/audit-logs", title: "Audit logs", icon: FileText },
      { href: "/dashboard/users", title: "User review", icon: Users },
    ],
  },
  admin: {
    title: "Admin Dashboard",
    description: "Monitor remittances, disputes, and system activity.",
    actions: [
      { href: "/remittance", title: "Remittances", icon: Wallet },
      { href: "/disputes", title: "Disputes", icon: AlertTriangle },
      { href: "/dashboard/audit-logs", title: "Audit logs", icon: FileText },
      { href: "/dashboard/users", title: "User management", icon: Users },
    ],
  },
};

export default function RoleDashboard({ roleParam }: RoleDashboardProps) {
  const router = useRouter();
  const role = isUserRole(roleParam) ? roleParam : null;
  const [user, setUser] = useState<DashboardUser | null>(null);

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      if (!role) {
        router.replace("/login");
        return;
      }

      try {
        const data = (await api("/auth/me")) as { user: DashboardUser };
        const actualRole = data.user?.role;
        const actualRoleHome = getRoleHomeRoute(actualRole);

        if (!actualRoleHome) {
          router.replace("/login");
          return;
        }

        if (actualRole !== role) {
          router.replace(actualRoleHome);
          return;
        }

        if (active) setUser(data.user);
      } catch {
        router.replace("/login");
      }
    };

    loadUser();

    return () => {
      active = false;
    };
  }, [role, router]);

  if (!role || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2
          className="h-6 w-6 animate-spin text-green-700"
          aria-label="Loading dashboard"
        />
      </main>
    );
  }

  const content = ROLE_CONTENT[role];

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-gray-900">
            RemitChain
          </Link>
          <div className="text-right">
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="text-sm capitalize text-gray-500">{user.role}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <section className="border-b border-gray-200 pb-8">
          <p className="text-sm font-medium capitalize text-green-700">
            {role} workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            {content.title}
          </h1>
          <p className="mt-2 text-gray-600">{content.description}</p>
          {role === "sender" && (
            <p className="mt-5 text-sm text-gray-500">
              Remit ID:{" "}
              <span className="font-medium text-gray-800">
                {user.remitId}
              </span>
            </p>
          )}
        </section>

        <section className="grid gap-3 py-8 sm:grid-cols-2 lg:grid-cols-3">
          {content.actions.map(({ href, title, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-24 items-center justify-between border border-gray-200 bg-white px-5 py-4 transition hover:border-green-700"
            >
              <span className="flex items-center gap-3 font-semibold text-gray-900">
                <Icon className="h-5 w-5 text-green-700" />
                {title}
              </span>
              <ArrowRight className="h-4 w-4 text-gray-400 transition group-hover:translate-x-1 group-hover:text-green-700" />
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}