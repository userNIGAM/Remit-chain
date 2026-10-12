"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, ShieldCheck } from "lucide-react";

import { api } from "@/lib/api";
import AuditTimeline from "@/components/AuditTimeline";
import { isUserRole, type UserRole } from "@/lib/roles";

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
  payoutBank?: string;
  receiverAccountNumber?: string;
  receiverConfirmed?: boolean;
  receiverConfirmedAt?: string;
  channel: string;
  status: string;

  transactionHash?: string;
  blockchainTxSignature?: string;
  blockchainNetwork?: string;

  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
};

type CurrentUser = {
  role: UserRole;
};

type BlockchainResult = {
  message?: string;
  blockchain?: {
    network?: string;
    signature?: string;
  } | null;
};

type VerificationResult = {
  verified: boolean;
  message?: string;
  liveTamperCheck?: { matches: boolean } | null;
  hashVerification?: {
    originalHash?: string;
    recalculatedHash?: string;
    matches: boolean;
  } | null;
  blockchainVerification?: {
    found?: boolean;
    finalized?: boolean;
    slot?: number | null;
    signature?: string;
  } | null;
};

type RemittanceDispute = {
  _id: string;
  remittance?: { _id?: string };
  type?: string;
  status?: string;
  expectedAmount?: number;
  actualAmount?: number;
  difference?: number;
  description?: string;
  resolution?: string;
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;


export default function RemittanceDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [remittance, setRemittance] = useState<Remittance | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [actualPayout, setActualPayout] = useState("");
  const [receiverAccountInput, setReceiverAccountInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [blockchainResult, setBlockchainResult] =
    useState<BlockchainResult | null>(null);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);

  const [dispute, setDispute] = useState<RemittanceDispute | null>(null);
  const [loadingDispute, setLoadingDispute] = useState(false);
  const [disputeActionLoading, setDisputeActionLoading] = useState(false);
  const [resolution, setResolution] = useState("");

  const loadRemittance = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await api<{ remittance: Remittance }>(`/remittances/${id}`);

      setRemittance(data.remittance || (data as unknown as Remittance));
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to load remittance"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      void Promise.resolve().then(loadRemittance);
    }
  }, [id, loadRemittance]);

  useEffect(() => {
    let active = true;

    const loadCurrentUser = async () => {
      try {
        const data = await api<{ user: { role?: unknown } }>("/auth/me");

        if (!isUserRole(data.user?.role)) {
          router.replace("/login");
          return;
        }

        if (active) setCurrentUser({ role: data.user.role });
      } catch {
        router.replace("/login");
      }
    };

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, [router]);

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
    } catch (err: unknown) {
      console.error("Action error:", err);
      setError(getErrorMessage(err, "Action failed"));
    } finally {
      setActionLoading(false);
    }
  };

  const approveRemittance = async () => {
    await performAction(
      `/remittances/${id}/approve`,
      "PATCH",
      "Remittance approved successfully",
    );
  };

  const processRemittance = async () => {
    await performAction(
      `/remittances/${id}/process`,
      "PATCH",
      "Remittance processed successfully",
    );
  };

  const readyForPayout = async () => {
    await performAction(
      `/remittances/${id}/ready-for-payout`,
      "PATCH",
      "Remittance is ready for payout",
    );
  };

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

  const confirmReceipt = async () => {
    if (!remittance) return;

    if (remittance.payoutMethod !== "cash" && !receiverAccountInput.trim()) {
      setError("Enter the account number where you want to receive the money");
      return;
    }

    await performAction(
      `/remittances/${id}/confirm-receipt`,
      "PATCH",
      "Receipt confirmed. Your payout will be released shortly.",
      remittance.payoutMethod !== "cash"
        ? { accountNumber: receiverAccountInput.trim() }
        : {},
    );
  };

  const commitBlockchain = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");
      setBlockchainResult(null);

      const data = await api<BlockchainResult>(`/remittances/${id}/blockchain`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      setBlockchainResult(data);

      setSuccess(
        data.message || "Remittance successfully committed to blockchain",
      );

      await loadRemittance();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Blockchain commit failed"));
    } finally {
      setActionLoading(false);
    }
  };

  const verifyBlockchain = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");
      setVerificationResult(null);

      const data = await api<VerificationResult>(
        `/remittances/${id}/verify-blockchain`,
      );
      console.log("Verification result:", data);
      setVerificationResult(data);

      if (data.verified) {
        setSuccess(
          data.message || "Remittance blockchain verification successful",
        );
      } else {
        setError(data.message || "Blockchain verification failed");
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Blockchain verification failed"));
    } finally {
      setActionLoading(false);
    }
  };

  const fetchDispute = useCallback(async () => {
    if (!remittance) return;

    try {
      setLoadingDispute(true);

      const data = await api<{ disputes: RemittanceDispute[] }>("/disputes");

      const currentDispute = data.disputes?.find(
        (item) =>
          item.remittance?._id?.toString() === remittance._id?.toString(),
      );

      setDispute(currentDispute || null);
    } catch (error: unknown) {
      console.error("Failed to fetch dispute:", error);
      setDispute(null);
    } finally {
      setLoadingDispute(false);
    }
  }, [remittance]);

  useEffect(() => {
    if (remittance) {
      void Promise.resolve().then(fetchDispute);
    }
  }, [remittance, fetchDispute]);

  const startDisputeInvestigation = async () => {
    if (!dispute) return;

    try {
      setDisputeActionLoading(true);
      setError("");
      setSuccess("");

      await api(`/disputes/${dispute._id}/investigate`, {
        method: "PATCH",
      });

      setSuccess("Dispute investigation started");

      await loadRemittance();
      await fetchDispute();
    } catch (error: unknown) {
      console.error("Investigation error:", error);
      setError(getErrorMessage(error, "Failed to start investigation"));
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

      await api(`/disputes/${dispute._id}/recovery`, {
        method: "PATCH",
      });

      setSuccess("Recovery requested");

      await loadRemittance();
      await fetchDispute();
    } catch (error: unknown) {
      console.error("Recovery error:", error);
      setError(getErrorMessage(error, "Failed to request recovery"));
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

      await api(`/disputes/${dispute._id}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({
          resolution: resolution.trim(),
        }),
      });

      setSuccess("Dispute resolved and remittance recovered");

      setResolution("");

      await loadRemittance();
      await fetchDispute();
    } catch (error: unknown) {
      console.error("Resolve dispute error:", error);
      setError(getErrorMessage(error, "Failed to resolve dispute"));
    } finally {
      setDisputeActionLoading(false);
    }
  };

  const canApprove = ["admin", "supervisor"].includes(currentUser?.role || "");
  const canProcessPayout = ["admin", "supervisor", "agent"].includes(
    currentUser?.role || "",
  );
  const canCommitBlockchain = ["admin", "supervisor"].includes(
    currentUser?.role || "",
  );
  const canManageDispute = ["admin", "supervisor"].includes(
    currentUser?.role || "",
  );

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

  return (
    <main className="min-h-screen bg-gray-100">
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
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4">
            {success}
          </div>
        )}

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
              value={`${remittance.fee} NPR`}
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

            {remittance.payoutBank && (
              <InfoItem label="Receiving Bank" value={remittance.payoutBank} />
            )}

            {remittance.receiverAccountNumber && (
              <InfoItem
                label="Receiver Account"
                value={remittance.receiverAccountNumber}
              />
            )}

            <InfoItem label="Channel" value={remittance.channel} />

            <InfoItem
              label="Payout Currency"
              value={remittance.payoutCurrency || "NPR"}
            />
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Remittance Actions
          </h2>

          <div className="flex flex-wrap gap-3 mt-5">
            {canApprove && remittance.status === "created" && (
              <ActionButton
                onClick={approveRemittance}
                disabled={actionLoading}
              >
                Approve Remittance
              </ActionButton>
            )}

            {canProcessPayout && remittance.status === "approved" && (
              <ActionButton
                onClick={processRemittance}
                disabled={actionLoading}
              >
                Process Remittance
              </ActionButton>
            )}

            {canProcessPayout && remittance.status === "processing" && (
              <ActionButton onClick={readyForPayout} disabled={actionLoading}>
                Ready for Payout
              </ActionButton>
            )}

            {currentUser?.role === "receiver" &&
              remittance.status === "ready_for_payout" && (
                <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Receive Money
                  </h3>

                  {remittance.receiverConfirmed ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-green-800">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      You confirmed receipt
                      {remittance.receiverConfirmedAt
                        ? ` on ${new Date(remittance.receiverConfirmedAt).toLocaleString()}`
                        : ""}
                      . Waiting for the payout to be released.
                    </div>
                  ) : (
                    <>
                      <p className="mt-2 text-sm text-gray-600">
                        Confirm your details to receive{" "}
                        <span className="font-semibold text-gray-900">
                          {remittance.expectedPayout}{" "}
                          {remittance.payoutCurrency || "NPR"}
                        </span>{" "}
                        by {remittance.payoutMethod}.
                      </p>

                      {remittance.payoutMethod === "cash" ? (
                        <p className="mt-3 text-sm text-gray-600">
                          Bring a valid ID to collect your cash at the branch,
                          then confirm below.
                        </p>
                      ) : (
                        <div className="mt-4">
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            {remittance.payoutMethod === "bank"
                              ? "Bank Account Number"
                              : "Wallet Number"}
                          </label>

                          <input
                            type="text"
                            inputMode="numeric"
                            value={receiverAccountInput}
                            onChange={(e) =>
                              setReceiverAccountInput(e.target.value)
                            }
                            placeholder={
                              remittance.payoutMethod === "bank"
                                ? remittance.receiverAccountNumber ||
                                  "Enter your account number"
                                : "Enter your wallet number"
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:border-emerald-500"
                          />

                          {remittance.payoutMethod === "bank" &&
                            remittance.receiverAccountNumber && (
                              <p className="mt-2 text-xs text-gray-500">
                                The sender entered{" "}
                                {remittance.receiverAccountNumber}. Re-enter it
                                to confirm.
                              </p>
                            )}
                        </div>
                      )}

                      <div className="mt-4">
                        <ActionButton
                          onClick={confirmReceipt}
                          disabled={actionLoading}
                        >
                          {actionLoading ? "Confirming..." : "Confirm Receipt"}
                        </ActionButton>
                      </div>
                    </>
                  )}
                </div>
              )}

            {canProcessPayout && remittance.status === "ready_for_payout" && (
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

                {remittance.receiverConfirmed ? (
                  <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                    Receiver confirmed receipt
                    {remittance.receiverConfirmedAt
                      ? ` on ${new Date(remittance.receiverConfirmedAt).toLocaleString()}`
                      : ""}
                    .
                  </p>
                ) : (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Waiting for the receiver to confirm receipt before the payout
                    can be completed.
                  </p>
                )}

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
                    disabled={
                      !remittance.receiverConfirmed ||
                      !actualPayout ||
                      actionLoading
                    }
                  >
                    {actionLoading ? "Processing..." : "Complete Payout"}
                  </ActionButton>
                </div>
              </div>
            )}

            {canCommitBlockchain && remittance.status === "completed" && (
              <ActionButton onClick={commitBlockchain} disabled={actionLoading}>
                <ShieldCheck className="w-4 h-4" />
                Commit to Blockchain
              </ActionButton>
            )}
          </div>

          {actionLoading && (
            <div className="flex items-center gap-2 mt-4 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </div>
          )}
        </section>

        {(remittance.transactionHash ||
          remittance.blockchainTxSignature ||
          blockchainResult) && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Blockchain Verification
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Verify that the remittance record has not been tampered with.
                </p>
              </div>

              <ShieldCheck className="h-7 w-7 text-green-600" />
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase text-gray-500">
                  Network
                </p>

                <p className="mt-1 font-medium text-gray-900">
                  {remittance.blockchainNetwork ||
                    blockchainResult?.blockchain?.network ||
                    "Solana Devnet"}
                </p>
              </div>

              {remittance.transactionHash && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Transaction Hash
                  </p>

                  <p className="mt-1 break-all font-mono text-sm text-gray-900">
                    {remittance.transactionHash}
                  </p>
                </div>
              )}

              {remittance.blockchainTxSignature && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Solana Transaction Signature
                  </p>

                  <p className="mt-1 break-all font-mono text-sm text-gray-900">
                    {remittance.blockchainTxSignature}
                  </p>
                </div>
              )}

              {blockchainResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />

                    <p className="font-medium text-green-800">
                      Transaction committed to blockchain
                    </p>
                  </div>

                  <p className="mt-2 break-all font-mono text-sm text-green-700">
                    Signature: {blockchainResult.blockchain?.signature}
                  </p>
                </div>
              )}

              <button
                onClick={verifyBlockchain}
                disabled={actionLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Verifying Blockchain...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5" />
                    Verify Blockchain
                  </>
                )}
              </button>
            </div>

            {verificationResult && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="mb-4 text-md font-semibold text-gray-900">
                  Verification Result
                </h3>

                <div
                  className={`rounded-lg border p-4 ${
                    verificationResult.verified
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {verificationResult.verified ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <ShieldCheck className="h-6 w-6 text-red-600" />
                    )}

                    <div>
                      <p
                        className={`font-semibold ${
                          verificationResult.verified
                            ? "text-green-800"
                            : "text-red-800"
                        }`}
                      >
                        {verificationResult.verified
                          ? "Transaction Verified"
                          : "Transaction Verification Failed"}
                      </p>

                      <p
                        className={`text-sm ${
                          verificationResult.verified
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {verificationResult.message}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Live tamper check */}
                {verificationResult.liveTamperCheck && (
                  <div
                    className={`mt-4 rounded-lg border p-4 ${
                      verificationResult.liveTamperCheck.matches
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <p
                      className={`font-medium ${
                        verificationResult.liveTamperCheck.matches
                          ? "text-green-800"
                          : "text-red-800"
                      }`}
                    >
                      {verificationResult.liveTamperCheck.matches
                        ? "Live data matches on-chain snapshot"
                        : "Live data differs from on-chain snapshot — possible tampering"}
                    </p>
                  </div>
                )}

                {verificationResult.hashVerification && (
                  <div className="mt-4 rounded-lg border border-gray-200 p-4">
                    <h4 className="mb-3 font-medium text-gray-900">
                      Hash Verification
                    </h4>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-gray-500">
                          Original Hash
                        </p>

                        <p className="mt-1 break-all font-mono text-xs text-gray-700">
                          {verificationResult.hashVerification.originalHash}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-gray-500">
                          Recalculated Hash
                        </p>

                        <p className="mt-1 break-all font-mono text-xs text-gray-700">
                          {verificationResult.hashVerification.recalculatedHash}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {verificationResult.hashVerification.matches ? (
                          <>
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span className="font-medium text-green-700">
                              Hash matches
                            </span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-5 w-5 text-red-600" />
                            <span className="font-medium text-red-700">
                              Hash does not match
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {verificationResult.blockchainVerification && (
                  <div className="mt-4 rounded-lg border border-gray-200 p-4">
                    <h4 className="mb-3 font-medium text-gray-900">
                      Blockchain Status
                    </h4>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                          Transaction Found
                        </p>

                        <p className="mt-1 font-medium">
                          {verificationResult.blockchainVerification.found
                            ? "Yes"
                            : "No"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Finalized</p>

                        <p className="mt-1 font-medium">
                          {verificationResult.blockchainVerification.finalized
                            ? "Yes"
                            : "No"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Slot</p>

                        <p className="mt-1 font-medium">
                          {verificationResult.blockchainVerification.slot ??
                            "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-500">
                        Blockchain Signature
                      </p>

                      <p className="mt-1 break-all font-mono text-xs text-gray-700">
                        {verificationResult.blockchainVerification.signature}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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

                {canManageDispute && dispute.status === "open" && (
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

                {canManageDispute && dispute.status === "investigation" && (
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

                {canManageDispute && dispute.status === "recovery_requested" && (
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
