"use client";

import {
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

type User = {
  name?: string;
  email?: string;
  phone?: string;
  remitId?: string;
};

type Remittance = {
  _id: string;
  transactionId: string;
  sender?: User;
  receiver?: User;
  authorizedAmount: number;
  sendingCurrency: string;
  exchangeRate: number;
  fee: number;
  expectedPayout: number;
  actualPayout?: number;
  payoutCurrency?: string;
  payoutMethod: string;
  channel: string;
  status: string;
  transactionHash?: string;
  blockchainTxSignature?: string;
  blockchainNetwork?: string;
  createdAt?: string;
  completedAt?: string;
};

export default function RemittancesPage() {
  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadRemittances = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await api<{ remittances: Remittance[] }>("/remittances");

      setRemittances(data.remittances || []);
    } catch (error: any) {
      setError(error.message || "Failed to load remittances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRemittances();
  }, []);

  const filteredRemittances = remittances.filter((remittance) => {
    const searchText = search.toLowerCase().trim();

    if (!searchText) {
      return true;
    }

    return (
      remittance.transactionId?.toLowerCase().includes(searchText) ||
      remittance.sender?.name?.toLowerCase().includes(searchText) ||
      remittance.receiver?.name?.toLowerCase().includes(searchText) ||
      remittance.receiver?.remitId?.toLowerCase().includes(searchText) ||
      remittance.status?.toLowerCase().includes(searchText)
    );
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";

      case "recovered":
        return "bg-blue-100 text-blue-700";

      case "created":
      case "verified":
        return "bg-gray-100 text-gray-700";

      case "approved":
      case "processing":
      case "ready_for_payout":
        return "bg-yellow-100 text-yellow-700";

      case "error_reported":
      case "investigation":
      case "recovery_requested":
        return "bg-red-100 text-red-700";

      case "rejected":
      case "cancelled":
        return "bg-gray-200 text-gray-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatStatus = (status: string) => {
    return status
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const formatDate = (date?: string) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleString();
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Remittances</h1>

            <p className="mt-1 text-sm text-gray-500">
              View and manage remittance transactions.
            </p>
          </div>

          <button
            onClick={loadRemittances}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search transaction, sender, receiver, Remit ID..."
              className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-75 items-center justify-center">
            <div className="flex items-center gap-3 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading remittances...
            </div>
          </div>
        ) : filteredRemittances.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <Clock className="mx-auto h-10 w-10 text-gray-400" />

            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              No remittances found
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Try changing your search.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                      Transaction
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                      Sender
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                      Receiver
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                      Amount
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                      Payout
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                      Status
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-gray-500">
                      Date
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredRemittances.map((remittance) => (
                    <tr key={remittance._id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="font-medium text-gray-900">
                          {remittance.transactionId}
                        </p>

                        {remittance.transactionHash && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Blockchain
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {remittance.sender?.name || "-"}
                        </p>

                        <p className="text-xs text-gray-500">
                          {remittance.sender?.remitId || "-"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {remittance.receiver?.name || "-"}
                        </p>

                        <p className="text-xs text-gray-500">
                          {remittance.receiver?.remitId || "-"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {remittance.authorizedAmount}{" "}
                          {remittance.sendingCurrency}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          NPR{" "}
                          {Number(
                            remittance.expectedPayout || 0,
                          ).toLocaleString()}
                        </p>

                        {remittance.actualPayout !== undefined &&
                          remittance.actualPayout !== null && (
                            <p className="text-xs text-gray-500">
                              Actual: NPR{" "}
                              {Number(remittance.actualPayout).toLocaleString()}
                            </p>
                          )}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(
                            remittance.status,
                          )}`}
                        >
                          {formatStatus(remittance.status)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(remittance.createdAt)}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <Link
                          href={`/remittance/${remittance._id}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 text-sm text-gray-500">
              Showing{" "}
              <span className="font-medium text-gray-900">
                {filteredRemittances.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-gray-900">
                {remittances.length}
              </span>{" "}
              remittances
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
