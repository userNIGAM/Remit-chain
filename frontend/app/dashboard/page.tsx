"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileText,
  Send,
  ShieldCheck,
  Wallet,
  AlertTriangle,
  ScrollText,
} from "lucide-react";
import Link from "next/link";

import { api } from "@/lib/api";

interface User {
  name: string;
  email: string;
  role: string;
  remitId: string;
}

type DashboardStats = {
  total: number;
  completed: number;
  pending: number;
  disputes: number;
  recovered: number;
  blockchainVerified: number;
};

export default function DashboardPage() {
  const [loadingStats, setLoadingStats] = useState(true);

  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    completed: 0,
    pending: 0,
    disputes: 0,
    recovered: 0,
    blockchainVerified: 0,
  });

  const [statsError, setStatsError] = useState("");
  const [user, setUser] = useState<User | null>(null);

  const loadDashboardStats = async () => {
    try {
      setLoadingStats(true);
      setStatsError("");

      const data = await api("/remittances/stats");

      setStats(data.stats);
    } catch (error: any) {
      setStatsError(error.message || "Failed to load dashboard statistics");
    } finally {
      setLoadingStats(false);
    }
  };

  const loadUser = async () => {
    try {
      const data = await api("/auth/me");

      console.log("Logged in user:", data);

      setUser(data.user);
    } catch (error: any) {
      console.error("User loading error:", error);
    }
  };

  useEffect(() => {
    loadDashboardStats();
    loadUser();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">RemitChain</h1>

            <p className="text-sm text-gray-500">
              Remittance Management System
            </p>
          </div>

          <div className="text-right">
            <p className="font-medium text-gray-900">
              {user?.name || "Loading..."}
            </p>

            <p className="text-sm text-gray-500 capitalize">
              {user?.role || ""}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* PAGE TITLE */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

          <p className="text-gray-500 mt-1">
            Manage and monitor your remittance transactions.
          </p>
        </div>

        {/* ERROR */}
        {statsError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {statsError}
          </div>
        )}

        {/* STATISTICS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Remittances"
            value={loadingStats ? "..." : stats.total}
          />

          <StatCard
            label="Completed"
            value={loadingStats ? "..." : stats.completed}
            valueClass="text-green-600"
          />

          <StatCard
            label="Pending"
            value={loadingStats ? "..." : stats.pending}
          />

          <StatCard
            label="Active Disputes"
            value={loadingStats ? "..." : stats.disputes}
            valueClass="text-red-600"
          />
        </div>

        {/* ADDITIONAL STATISTICS */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Recovered Remittances"
            value={loadingStats ? "..." : stats.recovered}
            valueClass="text-blue-600"
          />

          <StatCard
            label="Blockchain Verified"
            value={loadingStats ? "..." : stats.blockchainVerified}
            valueClass="text-green-600"
          />
        </div>

        {/* QUICK ACTIONS */}
        <section className="mt-8">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Quick Actions
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Access the main RemitChain workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* SEND REMITTANCE */}
            <DashboardAction
              href="/remittance/create"
              title="Send Remittance"
              description="Create a new remittance transaction."
              icon={<Send className="w-6 h-6" />}
              primary
            />

            {/* TRANSACTIONS */}
            <DashboardAction
              href="/remittance"
              title="Transactions"
              description="View and manage remittance transactions."
              icon={<Wallet className="w-6 h-6" />}
            />

            {/* DISPUTES */}
            <DashboardAction
              href="/disputes"
              title="Disputes"
              description="Investigate payout errors and recover funds."
              icon={<AlertTriangle className="w-6 h-6" />}
            />

            {/* AUDIT LOGS */}
            <DashboardAction
              href="/dashboard/audit-logs"
              title="Audit Logs"
              description="Review the complete transaction activity history."
              icon={<ScrollText className="w-6 h-6" />}
            />
          </div>
        </section>

        {/* SECURITY / BLOCKCHAIN INFORMATION */}
        <section className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-green-50 p-3">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>

            <div>
              <h3 className="font-semibold text-lg text-gray-900">
                Blockchain Security
              </h3>

              <p className="text-sm text-gray-500 mt-1">
                Completed remittance transactions can be anchored to Solana
                Devnet and verified from their transaction details.
              </p>

              <Link
                href="/remittance"
                className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-green-600 hover:text-green-700"
              >
                View Transactions
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ACCOUNT INFORMATION */}
        <section className="mt-6 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-lg text-gray-900">
                Account Information
              </h3>

              <p className="text-sm text-gray-500">
                Your RemitChain account details
              </p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-gray-600" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <AccountItem label="Name" value={user?.name || "Loading..."} />

            <AccountItem label="Email" value={user?.email || "Loading..."} />

            <AccountItem
              label="Role"
              value={user?.role || "Loading..."}
              capitalize
            />

            <AccountItem
              label="Remit ID"
              value={user?.remitId || "Loading..."}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

/* ==========================================
   STAT CARD
========================================== */

function StatCard({
  label,
  value,
  valueClass = "text-gray-900",
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>

      <p className={`mt-2 text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

/* ==========================================
   DASHBOARD ACTION
========================================== */

function DashboardAction({
  href,
  title,
  description,
  icon,
  primary = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "group rounded-xl bg-green-600 p-5 text-white transition hover:bg-green-700"
          : "group rounded-xl border border-gray-200 bg-white p-5 transition hover:border-gray-300"
      }
    >
      <div className="flex items-center justify-between">
        <div className={primary ? "text-white" : "text-gray-700"}>{icon}</div>

        <ArrowRight
          className={
            primary
              ? "w-5 h-5 text-green-100 transition group-hover:translate-x-1"
              : "w-5 h-5 text-gray-400 transition group-hover:translate-x-1"
          }
        />
      </div>

      <h4
        className={
          primary
            ? "font-semibold text-lg mt-5"
            : "font-semibold text-lg text-gray-900 mt-5"
        }
      >
        {title}
      </h4>

      <p
        className={
          primary ? "text-sm text-green-100 mt-1" : "text-sm text-gray-500 mt-1"
        }
      >
        {description}
      </p>
    </Link>
  );
}

/* ==========================================
   ACCOUNT ITEM
========================================== */

function AccountItem({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>

      <p
        className={`font-medium text-gray-900 mt-1 ${
          capitalize ? "capitalize" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
