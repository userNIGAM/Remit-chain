"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Search,
  Loader2,
} from "lucide-react";

import { api } from "@/lib/api";

type Remittance = {
  _id: string;
  transactionId: string;
  authorizedAmount: number;
  sendingCurrency: string;
  expectedPayout: number;
  actualPayout?: number;
  payoutCurrency: string;
  payoutMethod: string;
  status: string;
};

type Dispute = {
  _id: string;

  remittance: Remittance;

  reportedBy?: {
    name: string;
    email: string;
    role: string;
  };

  type: string;

  expectedAmount: number;
  actualAmount: number;
  difference: number;

  status: "open" | "investigation" | "recovery_requested" | "resolved";

  description?: string;
  resolution?: string;

  resolvedBy?: string;
  resolvedAt?: string;

  createdAt: string;
  updatedAt: string;
};

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [resolution, setResolution] = useState("");

  const loadDisputes = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await api("/disputes");

      console.log("Disputes:", data);

      setDisputes(data.disputes);
    } catch (error: any) {
      console.error("Dispute loading error:", error);

      setError(error.message || "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisputes();
  }, []);

  // =====================================================
  // START INVESTIGATION
  // =====================================================

  const handleInvestigation = async (disputeId: string) => {
    try {
      setActionLoading(disputeId);
      setError("");

      await api(`/disputes/${disputeId}/investigate`, {
        method: "PATCH",
      });

      await loadDisputes();
    } catch (error: any) {
      console.error("Investigation error:", error);

      setError(error.message || "Failed to start investigation");
    } finally {
      setActionLoading(null);
    }
  };

  // =====================================================
  // REQUEST RECOVERY
  // =====================================================

  const handleRecovery = async (disputeId: string) => {
    try {
      setActionLoading(disputeId);
      setError("");

      await api(`/disputes/${disputeId}/recovery`, {
        method: "PATCH",
      });

      await loadDisputes();
    } catch (error: any) {
      console.error("Recovery request error:", error);

      setError(error.message || "Failed to request recovery");
    } finally {
      setActionLoading(null);
    }
  };

  // =====================================================
  // RESOLVE DISPUTE
  // =====================================================

  const handleResolve = async (disputeId: string) => {
    if (!resolution.trim()) {
      setError("Please enter a resolution.");
      return;
    }

    try {
      setActionLoading(disputeId);
      setError("");

      await api(`/disputes/${disputeId}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({
          resolution,
        }),
      });

      setResolution("");

      await loadDisputes();
    } catch (error: any) {
      console.error("Resolve dispute error:", error);

      setError(error.message || "Failed to resolve dispute");
    } finally {
      setActionLoading(null);
    }
  };

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredDisputes = disputes.filter((dispute) => {
    const searchValue = search.toLowerCase();

    return (
      dispute.remittance.transactionId.toLowerCase().includes(searchValue) ||
      dispute.reportedBy?.name?.toLowerCase().includes(searchValue) ||
      dispute.remittance.status.toLowerCase().includes(searchValue) ||
      dispute.type.toLowerCase().includes(searchValue)
    );
  });

  // =====================================================
  // STATUS
  // =====================================================

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Open";

      case "investigation":
        return "Investigation";

      case "recovery_requested":
        return "Recovery Requested";

      case "resolved":
        return "Resolved";

      default:
        return status;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-100 text-red-700";

      case "investigation":
        return "bg-yellow-100 text-yellow-700";

      case "recovery_requested":
        return "bg-orange-100 text-orange-700";

      case "resolved":
        return "bg-green-100 text-green-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">RemitChain</h1>

            <p className="text-sm text-gray-500">Dispute Management</p>
          </div>

          <a
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Back to Dashboard
          </a>
        </div>
      </header>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* TITLE */}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Dispute Management
          </h2>

          <p className="text-gray-500 mt-1">
            Investigate payout disputes and manage recovery.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* SEARCH */}

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />

            <input
              type="text"
              placeholder="Search transaction, reporter, type or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* =====================================================
            LOADING
        ===================================================== */}

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <Loader2 className="w-6 h-6 mx-auto text-gray-400 animate-spin" />

            <p className="mt-3 text-gray-500">Loading disputes...</p>
          </div>
        ) : filteredDisputes.length === 0 ? (
          /* =====================================================
             EMPTY
          ===================================================== */

          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <CheckCircle className="w-10 h-10 mx-auto text-green-500" />

            <h3 className="mt-4 font-semibold text-gray-900">
              No disputes found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              There are currently no disputes matching your search.
            </p>
          </div>
        ) : (
          /* =====================================================
             DISPUTES
          ===================================================== */

          <div className="space-y-5">
            {filteredDisputes.map((dispute) => {
              const isLoading = actionLoading === dispute._id;

              return (
                <div
                  key={dispute._id}
                  className="bg-white border border-gray-200 rounded-xl p-6"
                >
                  {/* TOP */}

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-red-50 p-3 rounded-lg">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {dispute.remittance.transactionId}
                        </h3>

                        <p className="text-sm text-gray-500 mt-1">
                          {dispute.type.replace("_", " ")}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex w-fit px-3 py-1 rounded-full text-xs font-medium ${getStatusStyle(
                        dispute.status,
                      )}`}
                    >
                      {getStatusLabel(dispute.status)}
                    </span>
                  </div>

                  {/* DISPUTE DETAILS */}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-6">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Reported By
                      </p>

                      <p className="font-medium text-gray-900 mt-1">
                        {dispute.reportedBy?.name}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Expected
                      </p>

                      <p className="font-semibold text-gray-900 mt-1">
                        {dispute.expectedAmount.toLocaleString()}{" "}
                        {dispute.remittance.payoutCurrency}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 uppercase">Actual</p>

                      <p className="font-semibold text-red-600 mt-1">
                        {dispute.actualAmount.toLocaleString()}{" "}
                        {dispute.remittance.payoutCurrency}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Difference
                      </p>

                      <p className="font-semibold text-orange-600 mt-1">
                        {dispute.difference.toLocaleString()}{" "}
                        {dispute.remittance.payoutCurrency}
                      </p>
                    </div>
                  </div>

                  {/* DESCRIPTION */}

                  {dispute.description && (
                    <div className="mt-6 bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase">
                        Description
                      </p>

                      <p className="text-sm text-gray-700 mt-1">
                        {dispute.description}
                      </p>
                    </div>
                  )}

                  {/* RESOLUTION */}

                  {dispute.resolution && (
                    <div className="mt-4 bg-green-50 border border-green-100 rounded-lg p-4">
                      <p className="text-xs text-green-700 uppercase">
                        Resolution
                      </p>

                      <p className="text-sm text-green-800 mt-1">
                        {dispute.resolution}
                      </p>
                    </div>
                  )}

                  {/* =================================================
                        ACTIONS
                    ================================================= */}

                  <div className="mt-6 pt-5 border-t border-gray-100">
                    {/* OPEN */}

                    {dispute.status === "open" && (
                      <button
                        onClick={() => handleInvestigation(dispute._id)}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                        Start Investigation
                      </button>
                    )}

                    {/* INVESTIGATION */}

                    {dispute.status === "investigation" && (
                      <button
                        onClick={() => handleRecovery(dispute._id)}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                        Request Recovery
                      </button>
                    )}

                    {/* RECOVERY REQUESTED */}

                    {dispute.status === "recovery_requested" && (
                      <div className="space-y-3">
                        <textarea
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          placeholder="Enter the resolution details..."
                          rows={3}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                        />

                        <button
                          onClick={() => handleResolve(dispute._id)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Resolve Dispute
                        </button>
                      </div>
                    )}

                    {/* RESOLVED */}

                    {dispute.status === "resolved" && (
                      <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                        <CheckCircle className="w-5 h-5" />
                        Dispute resolved and remittance recovered.
                      </div>
                    )}
                  </div>

                  {/* VIEW TRANSACTION */}

                  <div className="mt-5 flex justify-end">
                    <a
                      href={`/remittance/${dispute.remittance._id}`}
                      className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                    >
                      View Transaction
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
