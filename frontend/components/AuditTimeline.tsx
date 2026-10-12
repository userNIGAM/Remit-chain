"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileClock,
  ShieldCheck,
  WalletCards,
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
    role?: string;
  };
};

const ACTION_PRESENTATION: Record<
  string,
  {
    label: string;
    icon: typeof Activity;
    iconClass: string;
    statusClass: string;
  }
> = {
  created: {
    label: "Transfer created",
    icon: FileClock,
    iconClass: "bg-blue-100 text-blue-700",
    statusClass: "bg-blue-50 text-blue-700",
  },
  approved: {
    label: "Transfer approved",
    icon: CheckCircle2,
    iconClass: "bg-green-100 text-green-700",
    statusClass: "bg-green-50 text-green-700",
  },
  processing: {
    label: "Processing started",
    icon: Activity,
    iconClass: "bg-amber-100 text-amber-700",
    statusClass: "bg-amber-50 text-amber-700",
  },
  ready_for_payout: {
    label: "Ready for payout",
    icon: WalletCards,
    iconClass: "bg-violet-100 text-violet-700",
    statusClass: "bg-violet-50 text-violet-700",
  },
  receiver_confirmed: {
    label: "Receiver confirmed receipt",
    icon: CheckCircle2,
    iconClass: "bg-emerald-100 text-emerald-700",
    statusClass: "bg-emerald-50 text-emerald-700",
  },
  payout_completed: {
    label: "Payout completed",
    icon: CheckCircle2,
    iconClass: "bg-green-100 text-green-700",
    statusClass: "bg-green-50 text-green-700",
  },
  error_reported: {
    label: "Payout discrepancy reported",
    icon: AlertTriangle,
    iconClass: "bg-red-100 text-red-700",
    statusClass: "bg-red-50 text-red-700",
  },
  investigation_started: {
    label: "Dispute investigation started",
    icon: Activity,
    iconClass: "bg-amber-100 text-amber-700",
    statusClass: "bg-amber-50 text-amber-700",
  },
  recovery_requested: {
    label: "Recovery requested",
    icon: AlertTriangle,
    iconClass: "bg-orange-100 text-orange-700",
    statusClass: "bg-orange-50 text-orange-700",
  },
  dispute_resolved: {
    label: "Dispute resolved",
    icon: CheckCircle2,
    iconClass: "bg-green-100 text-green-700",
    statusClass: "bg-green-50 text-green-700",
  },
  blockchain_committed: {
    label: "Committed to blockchain",
    icon: ShieldCheck,
    iconClass: "bg-emerald-100 text-emerald-700",
    statusClass: "bg-emerald-50 text-emerald-700",
  },
};

const titleCase = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
};

export default function AuditTimeline({ remittanceId }: { remittanceId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api<{ logs: AuditLog[] }>(
        `/audit-logs/remittance/${remittanceId}`,
      );
      setLogs(data.logs || []);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Failed to load transaction history",
      );
    } finally {
      setLoading(false);
    }
  }, [remittanceId]);

  useEffect(() => {
    if (remittanceId) {
      void Promise.resolve().then(fetchLogs);
    }
  }, [fetchLogs, remittanceId]);

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
          <p className="mt-1 text-sm text-gray-500">
            A timestamped record of each transfer event.
          </p>
        </div>
        {!loading && !error && (
          <span className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {logs.length} {logs.length === 1 ? "event" : "events"}
          </span>
        )}
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center gap-3 py-4 text-sm text-gray-600">
            <Clock3 className="h-5 w-5 animate-spin text-green-700" />
            Loading transaction history...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Transaction history could not be loaded.</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void fetchLogs()}
              className="mt-3 text-sm font-medium text-red-800 underline underline-offset-4 hover:text-red-900"
            >
              Try again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
            <FileClock className="mx-auto h-7 w-7 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-800">No events recorded yet</p>
            <p className="mt-1 text-sm text-gray-500">
              New activity will appear here as the transfer progresses.
            </p>
          </div>
        ) : (
          <ol className="relative ml-3 border-l border-gray-200 pl-7">
            {logs.map((log) => {
              const presentation = ACTION_PRESENTATION[log.action] || {
                label: titleCase(log.action),
                icon: Activity,
                iconClass: "bg-gray-100 text-gray-700",
                statusClass: "bg-gray-50 text-gray-700",
              };
              const Icon = presentation.icon;

              return (
                <li key={log._id} className="relative pb-8 last:pb-0">
                  <span
                    className={`absolute -left-10 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${presentation.iconClass}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {presentation.label}
                      </h3>
                      {log.description && (
                        <p className="mt-1 text-sm leading-6 text-gray-600">{log.description}</p>
                      )}
                    </div>
                    <time className="shrink-0 text-xs text-gray-500" dateTime={log.createdAt}>
                      {formatDate(log.createdAt)}
                    </time>
                  </div>

                  {(log.previousStatus || log.newStatus) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
                      {log.previousStatus && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
                          {titleCase(log.previousStatus)}
                        </span>
                      )}
                      {log.previousStatus && log.newStatus && <span className="text-gray-400">→</span>}
                      {log.newStatus && (
                        <span className={`rounded-full px-2.5 py-1 ${presentation.statusClass}`}>
                          {titleCase(log.newStatus)}
                        </span>
                      )}
                    </div>
                  )}

                  {log.actor && (
                    <p className="mt-3 text-xs text-gray-500">
                      Recorded by <span className="font-medium text-gray-700">{log.actor.name || "System"}</span>
                      {log.actor.role && ` · ${titleCase(log.actor.role)}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
