"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { api } from "@/lib/api";

interface User {
  name: string;
  email: string;
  role: string;
  remitId: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await api("/auth/me");
        setUser(data.user);
      } catch (error) {
        console.error("Dashboard error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading dashboard...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      {/* ================= HEADER ================= */}

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">RemitChain</h1>

            <p className="text-sm text-gray-500">
              Remittance Management System
            </p>
          </div>

          <div className="text-right">
            <p className="font-medium text-gray-900">{user?.name}</p>

            <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </header>

      {/* ================= MAIN ================= */}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome */}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

          <p className="text-gray-500 mt-1">
            Manage and monitor your remittance transactions.
          </p>
        </div>

        {/* ================= STATS ================= */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Total */}

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Remittances</p>

                <p className="text-3xl font-bold text-gray-900 mt-2">12</p>
              </div>

              <div className="bg-gray-100 p-3 rounded-lg">
                <Wallet className="w-6 h-6 text-gray-700" />
              </div>
            </div>
          </div>

          {/* Completed */}

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>

                <p className="text-3xl font-bold text-green-600 mt-2">8</p>
              </div>

              <div className="bg-green-50 p-3 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Pending */}

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending</p>

                <p className="text-3xl font-bold text-yellow-600 mt-2">3</p>
              </div>

              <div className="bg-yellow-50 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Disputes */}

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Disputes</p>

                <p className="text-3xl font-bold text-red-600 mt-2">1</p>
              </div>

              <div className="bg-red-50 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* ================= QUICK ACTIONS ================= */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {/* Send */}

          <a
            href="/remittance/create"
            className="bg-green-600 hover:bg-green-700 text-white rounded-xl p-5 transition"
          >
            <div className="flex items-center justify-between">
              <Send className="w-6 h-6" />

              <ArrowRight className="w-5 h-5" />
            </div>

            <h3 className="font-semibold text-lg mt-5">Send Remittance</h3>

            <p className="text-sm text-green-100 mt-1">
              Create a new remittance transaction.
            </p>
          </a>

          {/* Transactions */}

          <a
            href="/remittances"
            className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl p-5 transition"
          >
            <div className="flex items-center justify-between">
              <Wallet className="w-6 h-6 text-gray-700" />

              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>

            <h3 className="font-semibold text-lg text-gray-900 mt-5">
              Transactions
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              View all remittance transactions.
            </p>
          </a>

          {/* Blockchain */}

          <a
            href="/blockchain"
            className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl p-5 transition"
          >
            <div className="flex items-center justify-between">
              <ShieldCheck className="w-6 h-6 text-green-600" />

              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>

            <h3 className="font-semibold text-lg text-gray-900 mt-5">
              Blockchain Verification
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Verify transaction integrity.
            </p>
          </a>
        </div>

        {/* ================= USER INFORMATION ================= */}

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-lg text-gray-900">
                Account Information
              </h3>

              <p className="text-sm text-gray-500">
                Your RemitChain account details
              </p>
            </div>

            <div className="bg-green-50 p-3 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="text-sm text-gray-500">Name</p>

              <p className="font-medium text-gray-900 mt-1">{user?.name}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Email</p>

              <p className="font-medium text-gray-900 mt-1">{user?.email}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Role</p>

              <p className="font-medium text-gray-900 mt-1 capitalize">
                {user?.role}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Remit ID</p>

              <p className="font-medium text-gray-900 mt-1">{user?.remitId}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
