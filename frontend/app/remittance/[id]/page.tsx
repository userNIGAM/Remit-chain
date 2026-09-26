"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, ShieldCheck } from "lucide-react";

import { api } from "@/lib/api";
import AuditTimeline from "@/components/AuditTimeline";

type Remittance = {
  _id: string;
  transactionId: string;

  sender?: {
    name?: string;
    email?: string;
    remitId?: string;
  };

  receiver?: {
    name?: string;
    phone?: string;
    remitId?: string;
  };

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

  blockchain?: {
    network?: string;
    transactionHash?: string;
    verified?: boolean;
  };

  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
};

export default function RemittanceDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [remittance, setRemittance] = useState<Remittance | null>(null);

  const [actualPayout, setActualPayout] = useState("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [blockchainResult, setBlockchainResult] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const [dispute, setDispute] = useState<any>(null);
  const [loadingDispute, setLoadingDispute] = useState(false);
  const [disputeActionLoading, setDisputeActionLoading] = useState(false);
  const [resolution, setResolution] = useState("");

  // ==========================================
  // LOAD REMITTANCE
  // ==========================================

  const loadRemittance = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await api(`/remittances/${id}`);

      setRemittance(data.remittance || data);
    } catch (error: any) {
      setError(error.message || "Failed to load remittance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadRemittance();
    }
  }, [id]);

  // ==========================================
  // GENERIC ACTION
  // ==========================================

  const performAction = async (
    endpoint: string,
    method: string,
    successMessage: string,
    body?: Record<string, unknown>,
  ) => {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const data = await api(endpoint, {
        method,
        ...(body
          ? {
              body: JSON.stringify(body),
            }
          : {}),
      });

      console.log("Action response:", data);

      setSuccess(successMessage);
      await loadRemittance();
    } catch (err: any) {
      console.error("Action error:", err);
      setError(err.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // APPROVE
  // ==========================================

  const approveRemittance = async () => {
    await performAction(
      `/remittances/${id}/approve`,
      "PATCH",
      "Remittance approved successfully",
    );
  };

  // ==========================================
  // PROCESS
  // ==========================================

  const processRemittance = async () => {
    await performAction(
      `/remittances/${id}/process`,
      "PATCH",
      "Remittance processed successfully",
    );
  };

  // ==========================================
  // READY FOR PAYOUT
  // ==========================================

  const readyForPayout = async () => {
    await performAction(
      `/remittances/${id}/ready-for-payout`,
      "PATCH",
      "Remittance is ready for payout",
    );
  };

  // ==========================================
  // PAYOUT
  // ==========================================

  const completePayout = async (payout: number) => {
    if (!remittance) return;

    await performAction(
      `/remittances/${id}/payout`,
      "POST",
      "Payout completed successfully",
      {
        actualPayout: payout,
      },
    );
  };

  // ==========================================
  // BLOCKCHAIN COMMIT
  // ==========================================

  const commitBlockchain = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");
      setBlockchainResult(null);

      const data = await api(`/remittances/${id}/blockchain`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      setBlockchainResult(data);

      setSuccess(
        data.message || "Remittance successfully committed to blockchain",
      );

      await loadRemittance();
    } catch (error: any) {
      setError(error.message || "Blockchain commit failed");
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // VERIFY BLOCKCHAIN
  // ==========================================

  const verifyBlockchain = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");
      setVerificationResult(null);

      const data = await api(`/remittances/${id}/verify-blockchain`);
      console.log("Verification result:", data);
      setVerificationResult(data);

      if (data.verified) {
        setSuccess(
          data.message || "Remittance blockchain verification successful",
        );
      } else {
        setError(data.message || "Blockchain verification failed");
      }
    } catch (error: any) {
      setError(error.message || "Blockchain verification failed");
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // Disputes
  // ==========================================
  const fetchDispute = async () => {
    if (!remittance) return;

    try {
      setLoadingDispute(true);

      const data = await api("/disputes");

      console.log("All disputes:", data.disputes);
      console.log("Current remittance ID:", remittance._id);

      const currentDispute = data.disputes?.find(
        (item: any) =>
          item.remittance?._id?.toString() === remittance._id?.toString(),
      );

      console.log("Current dispute:", currentDispute);

      setDispute(currentDispute || null);
    } catch (error: any) {
      console.error("Failed to fetch dispute:", error);
      setDispute(null);
    } finally {
      setLoadingDispute(false);
    }
  };
  useEffect(() => {
    if (remittance) {
      fetchDispute();
    }
  }, [remittance]);

  const startDisputeInvestigation = async () => {
    if (!dispute) return;

    try {
      setDisputeActionLoading(true);
      setError("");
      setSuccess("");

      const data = await api(`/disputes/${dispute._id}/investigate`, {
        method: "PATCH",
      });

      console.log("Investigation response:", data);

      setSuccess("Dispute investigation started");

      await loadRemittance();
      await fetchDispute();
    } catch (error: any) {
      console.error("Investigation error:", error);
      setError(error.message || "Failed to start investigation");
    } finally {
      setDisputeActionLoading(false);
    }
  };

  const requestDisputeRecovery = async () => {
    if (!dispute) return;

    try {
      setDisputeActionLoading(true);
      setError("");
      setSuccess("");

      const data = await api(`/disputes/${dispute._id}/recovery`, {
        method: "PATCH",
      });

      console.log("Recovery response:", data);

      setSuccess("Recovery requested");

      await loadRemittance();
      await fetchDispute();
    } catch (error: any) {
      console.error("Recovery error:", error);
      setError(error.message || "Failed to request recovery");
    } finally {
      setDisputeActionLoading(false);
    }
  };

  const resolveCurrentDispute = async () => {
    if (!dispute) return;

    if (!resolution.trim()) {
      setError("Enter a resolution");
      return;
    }

    try {
      setDisputeActionLoading(true);
      setError("");
      setSuccess("");

      const data = await api(`/disputes/${dispute._id}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({
          resolution: resolution.trim(),
        }),
      });

      console.log("Resolve response:", data);

      setSuccess("Dispute resolved and remittance recovered");

      setResolution("");

      await loadRemittance();
      await fetchDispute();
    } catch (error: any) {
      console.error("Resolve dispute error:", error);
      setError(error.message || "Failed to resolve dispute");
    } finally {
      setDisputeActionLoading(false);
    }
  };

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading remittance...
        </div>
      </main>
    );
  }

  // ==========================================
  // ERROR / NOT FOUND
  // ==========================================

  if (!remittance) {
    return (
      <main className="min-h-screen bg-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="bg-white border border-red-200 rounded-xl p-6">
            <p className="text-red-600">{error || "Remittance not found"}</p>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <main className="min-h-screen bg-gray-100">
      {/* HEADER */}

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Remittance Details
              </h1>

              <p className="text-sm text-gray-500 mt-1">
                Transaction ID:{" "}
                <span className="font-medium text-gray-700">
                  {remittance.transactionId}
                </span>
              </p>
            </div>

            <span className="inline-flex w-fit px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold capitalize">
              {remittance.status}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* ERROR */}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4">
            {success}
          </div>
        )}

        {/* SENDER / RECEIVER */}

        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Transfer Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
            <div>
              <p className="text-sm text-gray-500">Sender</p>

              <p className="font-semibold text-gray-900 mt-1">
                {remittance.sender?.name || "N/A"}
              </p>

              {remittance.sender?.email && (
                <p className="text-sm text-gray-500">
                  {remittance.sender.email}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-500">Receiver</p>

              <p className="font-semibold text-gray-900 mt-1">
                {remittance.receiver?.name || "N/A"}
              </p>

              <p className="text-sm text-gray-500">
                Remit ID: {remittance.receiver?.remitId || "N/A"}
              </p>

              <p className="text-sm text-gray-500">
                Phone: {remittance.receiver?.phone || "N/A"}
              </p>
            </div>
          </div>
        </section>

        {/* REMITTANCE DETAILS */}

        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Remittance Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mt-5">
            <InfoItem
              label="Sending Amount"
              value={`${remittance.authorizedAmount} ${remittance.sendingCurrency}`}
            />

            <InfoItem
              label="Exchange Rate"
              value={String(remittance.exchangeRate)}
            />

            <InfoItem
              label="Fee"
              value={`${remittance.fee} ${remittance.sendingCurrency}`}
            />

            <InfoItem
              label="Expected Payout"
              value={`NPR ${Number(remittance.expectedPayout).toFixed(2)}`}
            />

            <InfoItem
              label="Actual Payout"
              value={
                remittance.actualPayout !== undefined
                  ? `NPR ${Number(remittance.actualPayout).toFixed(2)}`
                  : "Not paid"
              }
            />

            <InfoItem label="Payout Method" value={remittance.payoutMethod} />

            <InfoItem label="Channel" value={remittance.channel} />

            <InfoItem
              label="Payout Currency"
              value={remittance.payoutCurrency || "NPR"}
            />
          </div>
        </section>

        {/* ACTIONS */}

        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Remittance Actions
          </h2>

          <div className="flex flex-wrap gap-3 mt-5">
            {/* APPROVE */}

            {remittance.status === "created" && (
              <ActionButton
                onClick={approveRemittance}
                disabled={actionLoading}
              >
                Approve Remittance
              </ActionButton>
            )}

            {/* PROCESS */}

            {remittance.status === "approved" && (
              <ActionButton
                onClick={processRemittance}
                disabled={actionLoading}
              >
                Process Remittance
              </ActionButton>
            )}

            {/* READY FOR PAYOUT */}

            {remittance.status === "processing" && (
              <ActionButton onClick={readyForPayout} disabled={actionLoading}>
                Ready for Payout
              </ActionButton>
            )}

            {/* PAYOUT */}

            {remittance.status === "ready_for_payout" && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-gray-900">
                  Complete Payout
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  Expected payout:{" "}
                  <span className="font-semibold text-gray-900">
                    {remittance.expectedPayout} {remittance.payoutCurrency}
                  </span>
                </p>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Actual Payout Amount
                  </label>

                  <input
                    type="number"
                    value={actualPayout}
                    onChange={(e) => setActualPayout(e.target.value)}
                    placeholder={String(remittance.expectedPayout)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 outline-none focus:border-green-500"
                  />
                </div>

                <div className="mt-4">
                  <ActionButton
                    onClick={() => completePayout(Number(actualPayout))}
                    disabled={!actualPayout || actionLoading}
                  >
                    {actionLoading ? "Processing..." : "Complete Payout"}
                  </ActionButton>
                </div>
              </div>
            )}

            {/* BLOCKCHAIN */}

            {remittance.status === "completed" && (
              <ActionButton onClick={commitBlockchain} disabled={actionLoading}>
                <ShieldCheck className="w-4 h-4" />
                Commit to Blockchain
              </ActionButton>
            )}

            {/* VERIFY */}

            {blockchainResult || verificationResult ? (
              <ActionButton onClick={verifyBlockchain} disabled={actionLoading}>
                <CheckCircle className="w-4 h-4" />
                Verify Blockchain
              </ActionButton>
            ) : null}
          </div>

          {actionLoading && (
            <div className="flex items-center gap-2 mt-4 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </div>
          )}
        </section>

        {/* BLOCKCHAIN RESULT */}

        {blockchainResult && (
          <section className="bg-white border border-green-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Blockchain Transaction
            </h2>

            <div className="mt-4 space-y-3 text-sm">
              <InfoItem
                label="Network"
                value={
                  blockchainResult.network ||
                  blockchainResult.blockchain?.network ||
                  "Solana Devnet"
                }
              />

              <InfoItem
                label="Transaction Signature"
                value={
                  blockchainResult.signature ||
                  blockchainResult.transactionHash ||
                  blockchainResult.blockchain?.signature ||
                  "N/A"
                }
              />
            </div>
          </section>
        )}

        {/* VERIFICATION RESULT */}

        {verificationResult && (
          <section
            className={`border rounded-xl p-6 ${
              verificationResult.verified
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            } text-gray-900`}
          >
            <h2 className="text-lg font-semibold text-gray-900">
              Blockchain Verification
            </h2>

            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <p>
                <span className="font-semibold text-gray-900">Verified:</span>{" "}
                <span
                  className={
                    verificationResult.verified
                      ? "font-semibold text-green-600"
                      : "font-semibold text-red-600"
                  }
                >
                  {verificationResult.verified ? "Yes" : "No"}
                </span>
              </p>

              {verificationResult.hashVerification?.originalHash && (
                <p className="break-all text-gray-700">
                  <span className="font-semibold text-gray-900">
                    Original Hash:
                  </span>{" "}
                  {verificationResult.hashVerification.originalHash}
                </p>
              )}

              {verificationResult.hashVerification?.recalculatedHash && (
                <p className="break-all text-gray-700">
                  <span className="font-semibold text-gray-900">
                    Recalculated Hash:
                  </span>{" "}
                  {verificationResult.hashVerification.recalculatedHash}
                </p>
              )}

              {verificationResult.message && (
                <p>
                  <span className="font-semibold text-gray-900">Message:</span>{" "}
                  <span className="text-gray-700">
                    {verificationResult.message}
                  </span>
                </p>
              )}
            </div>
          </section>
        )}
        {/* DISPUTE / PAYOUT ERROR */}
        {[
          "error_reported",
          "investigation",
          "recovery_requested",
          "recovered",
        ].includes(remittance.status) && (
          <section className="rounded-xl border border-red-200 bg-red-50 p-6">
            <div className="mb-6 flex items-start gap-3">
              <div className="text-2xl">⚠️</div>

              <div>
                <h2 className="text-xl font-semibold text-red-900">
                  Payout Error Reported
                </h2>

                <p className="mt-1 text-sm text-red-700">
                  The actual payout amount did not match the authorized payout
                  amount. The transaction has been blocked and a dispute has
                  been created.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-white p-4">
                <p className="text-sm text-gray-500">Expected Payout</p>

                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {remittance.expectedPayout} {remittance.payoutCurrency}
                </p>
              </div>

              <div className="rounded-lg bg-white p-4">
                <p className="text-sm text-gray-500">Actual Payout</p>

                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {remittance.actualPayout} {remittance.payoutCurrency}
                </p>
              </div>

              <div className="rounded-lg bg-white p-4">
                <p className="text-sm text-gray-500">Difference</p>

                <p className="mt-1 text-lg font-semibold text-red-600">
                  {Math.abs(
                    Number(remittance.actualPayout || 0) -
                      Number(remittance.expectedPayout || 0),
                  )}{" "}
                  {remittance.payoutCurrency}
                </p>
              </div>
            </div>

            {loadingDispute ? (
              <div className="mt-6 rounded-lg bg-white p-5 text-sm text-gray-600">
                Loading dispute information...
              </div>
            ) : dispute ? (
              <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Dispute Information
                  </h3>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                      dispute.status === "open"
                        ? "bg-yellow-100 text-yellow-800"
                        : dispute.status === "investigation"
                          ? "bg-blue-100 text-blue-800"
                          : dispute.status === "recovery_requested"
                            ? "bg-purple-100 text-purple-800"
                            : dispute.status === "resolved"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {dispute.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-500">Dispute Type</p>
                    <p className="font-medium text-gray-900">{dispute.type}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Expected Amount</p>
                    <p className="font-medium text-gray-900">
                      {dispute.expectedAmount} NPR
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Actual Amount</p>
                    <p className="font-medium text-gray-900">
                      {dispute.actualAmount} NPR
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Difference</p>
                    <p className="font-medium text-red-600">
                      {dispute.difference} NPR
                    </p>
                  </div>
                </div>

                {dispute.description && (
                  <div className="mt-5">
                    <p className="text-sm font-medium text-gray-500">
                      Description
                    </p>

                    <p className="mt-1 text-sm text-gray-700">
                      {dispute.description}
                    </p>
                  </div>
                )}

                {dispute.resolution && (
                  <div className="mt-5 rounded-lg bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-800">
                      Resolution
                    </p>

                    <p className="mt-1 text-sm text-green-700">
                      {dispute.resolution}
                    </p>
                  </div>
                )}

                {/* OPEN */}
                {dispute.status === "open" && (
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={startDisputeInvestigation}
                      disabled={disputeActionLoading}
                      className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {disputeActionLoading
                        ? "Starting..."
                        : "Start Investigation"}
                    </button>
                  </div>
                )}

                {/* INVESTIGATION */}
                {dispute.status === "investigation" && (
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={requestDisputeRecovery}
                      disabled={disputeActionLoading}
                      className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {disputeActionLoading
                        ? "Requesting..."
                        : "Request Recovery"}
                    </button>
                  </div>
                )}

                {/* RECOVERY REQUESTED */}
                {dispute.status === "recovery_requested" && (
                  <div className="mt-6">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Resolution
                    </label>

                    <textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="Enter the resolution details..."
                      rows={4}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-500"
                    />

                    <button
                      type="button"
                      onClick={resolveCurrentDispute}
                      disabled={disputeActionLoading}
                      className="mt-3 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {disputeActionLoading
                        ? "Resolving..."
                        : "Resolve Dispute"}
                    </button>
                  </div>
                )}

                {/* RESOLVED */}
                {dispute.status === "resolved" && (
                  <div className="mt-6 rounded-lg bg-green-50 p-4">
                    <p className="font-medium text-green-800">
                      Dispute Resolved
                    </p>

                    <p className="mt-1 text-sm text-green-700">
                      The dispute has been resolved and the remittance has been
                      recovered.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-lg bg-white p-5 text-sm text-gray-600">
                Dispute information is not available yet.
              </div>
            )}

            <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-5">
              <h3 className="font-semibold text-green-900">
                Dispute Process Completed
              </h3>

              <p className="mt-2 text-sm text-green-700">
                The payout mismatch was investigated, recovery was completed,
                and the remittance has been marked as recovered.
              </p>
            </div>
          </section>
        )}
        <AuditTimeline remittanceId={remittance._id} />
      </div>
    </main>
  );
}

// ==========================================
// INFO ITEM
// ==========================================

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>

      <p className="font-semibold text-gray-900 mt-1 break-all capitalize">
        {value}
      </p>
    </div>
  );
}

// ==========================================
// ACTION BUTTON
// ==========================================

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
