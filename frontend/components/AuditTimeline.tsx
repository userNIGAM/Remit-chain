"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, Loader2 } from "lucide-react";

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
};

export default function AuditTimeline({
  remittanceId,
}: {
  remittanceId: string;
}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await api<{ logs: AuditLog[] }>(
        `/audit-logs/remittance/${remittanceId}`,
      );

      setLogs(data.logs || []);
    } catch (error: any) {
      console.error("Audit log error:", error);
      setError(error.message || "Failed to load transaction history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (remittanceId) {
      fetchLogs();
    }
  }, [remittanceId]);

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading transaction history...
        </div>
      </section>
    );
  }

  // Owners may not have permission on some routes; just show empty state.
  if (error) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Transaction History
        </h2>
        <div className="mt-5 rounded-lg bg-gray-50 p-5 text-sm text-gray-500">
          No transaction history available.
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-900">
        Transaction History
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        Complete audit trail of this remittance.
      </p>

      {logs.length === 0 ? (
        <div className="mt-5 rounded-lg bg-gray-50 p-5 text-sm text-gray-500">
          No transaction history available.
        </div>
      ) : (
        <div className="mt-6">
          {logs.map((log, index) => (
            <div key={log._id} className="relative flex gap-4 pb-8 last:pb-0">
              {index !== logs.length - 1 && (
                <div className="absolute left-2.75 top-7 h-full w-px bg-gray-200" />
              )}

              <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-semibold text-gray-900">
                    {formatAction(log.action)}
                  </h3>

                  <span className="text-xs text-gray-500">
                    {formatDate(log.createdAt)}
                  </span>
                </div>

                {log.description && (
                  <p className="mt-1 text-sm text-gray-600">
                    {log.description}
                  </p>
                )}

                {(log.previousStatus || log.newStatus) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {log.previousStatus && (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                        {log.previousStatus}
                      </span>
                    )}

                    {log.previousStatus && log.newStatus && (
                      <span className="text-gray-400">→</span>
                    )}

                    {log.newStatus && (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
                        {log.newStatus}
                      </span>
                    )}
                  </div>
                )}

                {log.actor && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />

                    <span>{log.actor.name || "Unknown user"}</span>

                    {log.actor.role && <span>({log.actor.role})</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}