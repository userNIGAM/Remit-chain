"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Blocks,
  CheckCircle,
  Clock,
  FileSearch,
  Loader2,
  Search,
} from "lucide-react";

import { api } from "@/lib/api";

type AuditLog = {
  _id: string;
  action: string;
  description?: string;
  previousStatus?: string;
  newStatus?: string;
  createdAt: string;

  actor?: {
    name?: string;
    email?: string;
    role?: string;
  };

  remittance?: {
    _id: string;
    transactionId?: string;
    status?: string;
  };
};

const actionOptions = [
  "all",
  "created",
  "approved",
  "processing",
  "ready_for_payout",
  "payout_completed",
  "error_reported",
  "investigation_started",
  "recovery_requested",
  "dispute_resolved",
  "blockchain_committed",
];

const statusOptions = [
  "all",
  "created",
  "approved",
  "processing",
  "ready_for_payout",
  "completed",
  "error_reported",
  "investigation",
  "recovery_requested",
  "recovered",
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await api<{ logs: AuditLog[] }>("/audit-logs");

        setLogs(data.logs || []);
      } catch (error: any) {
        console.error("Audit logs error:", error);
        setError(error.message || "Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatStatus = (status?: string) => {
    if (!status) return "";

    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getActionClass = (action: string) => {
    switch (action) {
      case "payout_completed":
        return "bg-green-100 text-green-700";

      case "blockchain_committed":
        return "bg-purple-100 text-purple-700";

      case "error_reported":
        return "bg-red-100 text-red-700";

      case "investigation_started":
      case "recovery_requested":
      case "dispute_resolved":
        return "bg-yellow-100 text-yellow-700";

      case "approved":
        return "bg-blue-100 text-blue-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusClass = (status?: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";

      case "recovered":
        return "bg-blue-100 text-blue-700";

      case "error_reported":
        return "bg-red-100 text-red-700";

      case "investigation":
      case "recovery_requested":
        return "bg-yellow-100 text-yellow-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const filteredLogs = useMemo(() => {
    const query = search.toLowerCase().trim();

    return logs.filter((log) => {
      const matchesSearch =
        !query ||
        log.remittance?.transactionId?.toLowerCase().includes(query) ||
        log.actor?.name?.toLowerCase().includes(query) ||
        log.actor?.email?.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.description?.toLowerCase().includes(query);

      const matchesAction =
        actionFilter === "all" || log.action === actionFilter;

      const matchesStatus =
        statusFilter === "all" ||
        log.previousStatus === statusFilter ||
        log.newStatus === statusFilter;

      return matchesSearch && matchesAction && matchesStatus;
    });
  }, [logs, search, actionFilter, statusFilter]);

  const totalEvents = logs.length;

  const payoutEvents = logs.filter(
    (log) => log.action === "payout_completed",
  ).length;

  const disputeEvents = logs.filter((log) =>
    [
      "error_reported",
      "investigation_started",
      "recovery_requested",
      "dispute_resolved",
    ].includes(log.action),
  ).length;

  const blockchainEvents = logs.filter(
    (log) => log.action === "blockchain_committed",
  ).length;

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading audit logs...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-white p-6">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>

        <p className="mt-1 text-sm text-gray-500">
          Complete system history of remittance activities and status changes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Events</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {totalEvents}
              </p>
            </div>

            <div className="rounded-lg bg-gray-100 p-3">
              <Activity className="h-5 w-5 text-gray-700" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Payout Events</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {payoutEvents}
              </p>
            </div>

            <div className="rounded-lg bg-green-100 p-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Dispute Events</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {disputeEvents}
              </p>
            </div>

            <div className="rounded-lg bg-yellow-100 p-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Blockchain Events</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {blockchainEvents}
              </p>
            </div>

            <div className="rounded-lg bg-purple-100 p-3">
              <Blocks className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transaction, actor or action..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
          >
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action === "all" ? "All Actions" : formatAction(action)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All Statuses" : formatStatus(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-gray-600" />

            <h2 className="font-semibold text-gray-900">Activity History</h2>

            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
              {filteredLogs.length}
            </span>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center">
            <FileSearch className="mx-auto h-10 w-10 text-gray-300" />

            <p className="mt-3 text-sm font-medium text-gray-700">
              No audit logs found
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Try changing your search or filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log) => (
              <div key={log._id} className="p-5 transition hover:bg-gray-50">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getActionClass(
                          log.action,
                        )}`}
                      >
                        {formatAction(log.action)}
                      </span>

                      {log.remittance?.transactionId && (
                        <span className="font-mono text-xs text-gray-500">
                          {log.remittance.transactionId}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-gray-700">
                      {log.description || "No description available"}
                    </p>

                    {(log.previousStatus || log.newStatus) && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {log.previousStatus && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs ${getStatusClass(
                              log.previousStatus,
                            )}`}
                          >
                            {formatStatus(log.previousStatus)}
                          </span>
                        )}

                        {log.previousStatus && log.newStatus && (
                          <span className="text-gray-400">→</span>
                        )}

                        {log.newStatus && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs ${getStatusClass(
                              log.newStatus,
                            )}`}
                          >
                            {formatStatus(log.newStatus)}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                      {log.actor && (
                        <span>
                          By{" "}
                          <span className="font-medium text-gray-700">
                            {log.actor.name || "Unknown user"}
                          </span>
                          {log.actor.role && (
                            <span className="ml-1">({log.actor.role})</span>
                          )}
                        </span>
                      )}

                      {log.actor?.email && <span>{log.actor.email}</span>}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
                    <Clock className="h-4 w-4" />
                    {formatDate(log.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}