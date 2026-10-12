"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Landmark, Loader2, Send } from "lucide-react";

import { api } from "@/lib/api";
import { getRoleHomeRoute, isUserRole } from "@/lib/roles";

type Receiver = {
  _id?: string;
  name: string;
  remitId: string;
  phone?: string;
  verificationStatus?: string;
};

type CreatedRemittance = {
  id: string;
  transactionId: string;
};

const DEMO_BANKS = [
  "Nabil Bank",
  "Global IME Bank",
  "NIC Asia Bank",
  "Agricultural Development Bank",
];

// Fixed platform pricing, mirrored from the backend. Displayed to the sender but
// never submitted: the server is the single source of truth.
const EXCHANGE_RATE = 36.5;
const TRANSFER_FEE = 25;

export default function CreateRemittancePage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [remitId, setRemitId] = useState("");
  const [amount, setAmount] = useState("");
  const [sendingCurrency, setSendingCurrency] = useState("AED");
  const [payoutMethod, setPayoutMethod] = useState("bank");
  const [payoutBank, setPayoutBank] = useState("");
  const [receiverAccountNumber, setReceiverAccountNumber] = useState("");

  const [receiver, setReceiver] = useState<Receiver | null>(null);
  const [loadingReceiver, setLoadingReceiver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      try {
        const data = await api<{ user: { role?: unknown } }>("/auth/me");
        const home = getRoleHomeRoute(data.user?.role);

        if (!isUserRole(data.user?.role) || !home) {
          router.replace("/login");
          return;
        }

        if (data.user.role !== "sender") {
          router.replace(home);
          return;
        }
      } catch {
        router.replace("/login");
        return;
      }

      if (active) setCheckingAccess(false);
    };

    void checkAccess();

    return () => {
      active = false;
    };
  }, [router]);

  // ==========================================
  // FIND RECEIVER
  // ==========================================

  const findReceiver = async () => {
    if (!remitId.trim()) {
      setError("Enter a Remit ID");
      return;
    }

    try {
      setError("");
      setReceiver(null);
      setLoadingReceiver(true);

      const data = await api<{ receiver: Receiver }>(
        `/remittances/receiver?remitId=${encodeURIComponent(remitId.trim())}`,
      );

      setReceiver(data.receiver);
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Receiver not found",
      );
    } finally {
      setLoadingReceiver(false);
    }
  };

  // ==========================================
  // CALCULATE EXPECTED PAYOUT
  // ==========================================

  const calculatedPayout =
    Number(amount || 0) * EXCHANGE_RATE - TRANSFER_FEE;

  // ==========================================
  // CREATE REMITTANCE
  // ==========================================

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setError("");
      setSuccess("");

      if (!receiver) {
        setError("Please find and select a receiver first");
        return;
      }

      if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        setError("Enter a valid amount");
        return;
      }

      if (Number(amount) * EXCHANGE_RATE - TRANSFER_FEE <= 0) {
        setError("Amount is too small to cover the transfer fee");
        return;
      }

      if (payoutMethod === "bank" && !payoutBank) {
        setError("Choose a receiving bank");
        return;
      }

      if (payoutMethod === "bank" && !receiverAccountNumber.trim()) {
        setError("Enter the receiver's bank account number");
        return;
      }

      setSubmitting(true);

      const data = await api<{ remittance: CreatedRemittance }>("/remittances", {
        method: "POST",
        body: JSON.stringify({
          receiverRemitId: receiver.remitId,
          amount: Number(amount),
          sendingCurrency,
          payoutMethod,
          ...(payoutMethod === "bank"
            ? { payoutBank, receiverAccountNumber: receiverAccountNumber.trim() }
            : {}),
        }),
      });

      setSuccess(
        `Remittance created successfully: ${data.remittance.transactionId}`,
      );
      setTimeout(() => {
        router.push(`/remittance/${data.remittance.id}`);
      }, 1000);
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Failed to create remittance",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-emerald-50">
        <Loader2 className="h-6 w-6 animate-spin text-green-700" aria-label="Checking access" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-gray-50 to-white">
      {/* ==========================================
          HEADER
      ========================================== */}

      <header className="border-b border-emerald-900/10 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/dashboard/sender")}
            aria-label="Back to sender dashboard"
            className="rounded-xl border border-gray-200 p-2.5 text-gray-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              RemitChain · Sender
            </p>
            <h1 className="mt-0.5 text-xl font-bold text-gray-900">
              Create Remittance
            </h1>

            <p className="text-sm text-gray-500">
              Send money to a registered receiver
            </p>
          </div>
        </div>
      </header>

      {/* ==========================================
          FORM
      ========================================== */}

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ======================================
              RECEIVER
          ====================================== */}

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <Send className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Receiver</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enter the receiver&apos;s Remit ID.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={remitId}
                disabled={loadingReceiver}
                onChange={(e) => {
                  setRemitId(e.target.value);
                  setReceiver(null);
                  setError("");
                }}
                placeholder="Example: NP-24574"
                className="min-w-0 rounded-xl border border-gray-300 px-4 py-3 text-black outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-wait disabled:bg-gray-50"
              />

              <button
                type="button"
                onClick={findReceiver}
                disabled={loadingReceiver}
                className="rounded-xl bg-gray-900 px-5 py-3 font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingReceiver ? "Searching..." : "Find Receiver"}
              </button>
            </div>

            {/* Receiver found */}

            {receiver && (
              <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="font-semibold text-green-800">Receiver Found</p>

                <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-black sm:grid-cols-2">
                  <p>
                    <span className="text-gray-900">Name:</span>{" "}
                    <strong>{receiver.name}</strong>
                  </p>

                  <p>
                    <span className="text-gray-900">Remit ID:</span>{" "}
                    <strong>{receiver.remitId}</strong>
                  </p>

                  <p>
                    <span className="text-gray-900">Phone:</span>{" "}
                    <strong>{receiver.phone || "Not provided"}</strong>
                  </p>

                  <p>
                    <span className="text-gray-900">Status:</span>{" "}
                    <strong>{receiver.verificationStatus}</strong>
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ======================================
              REMITTANCE DETAILS
          ====================================== */}

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Remittance Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              {/* Payout Method */}

              <div>
                <label htmlFor="payoutMethod" className="mb-2 block text-sm font-medium text-gray-700">
                  Payout Method
                </label>

                <select
                  id="payoutMethod"
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-black outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="bank">Bank</option>

                  <option value="wallet">Wallet</option>

                  <option value="cash">Cash</option>
                </select>
              </div>

              {payoutMethod === "bank" && (
                <div>
                  <label htmlFor="payoutBank" className="mb-2 block text-sm font-medium text-gray-700">
                    Receiving Bank
                  </label>
                  <select
                    id="payoutBank"
                    value={payoutBank}
                    onChange={(e) => setPayoutBank(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-black outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Choose a bank</option>
                    {DEMO_BANKS.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>

                  <label
                    htmlFor="receiverAccountNumber"
                    className="mt-4 mb-2 block text-sm font-medium text-gray-700"
                  >
                    Receiver Account Number
                  </label>

                  <input
                    id="receiverAccountNumber"
                    type="text"
                    inputMode="numeric"
                    required
                    value={receiverAccountNumber}
                    onChange={(e) => setReceiverAccountNumber(e.target.value)}
                    placeholder="e.g. 0123456789012"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-black outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />

                  <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                    <Landmark className="h-3.5 w-3.5" />
                    Demo bank options for the hackathon flow.
                  </p>
                </div>
              )}

              {/* Amount */}

              <div>
                <label htmlFor="amount" className="mb-2 block text-sm font-medium text-gray-700">
                  Sending Amount
                </label>

                <input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  className="w-full border text-black border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Currency */}

              <div>
                <label htmlFor="sendingCurrency" className="mb-2 block text-sm font-medium text-gray-700">
                  Sending Currency
                </label>

                <select
                  id="sendingCurrency"
                  value={sendingCurrency}
                  onChange={(e) => setSendingCurrency(e.target.value)}
                  className="w-full border text-black border-gray-300 rounded-lg px-4 py-3 bg-white"
                >
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                  <option value="QAR">QAR</option>
                  <option value="SAR">SAR</option>
                  <option value="AUD">AUD</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>

              {/* Exchange Rate (fixed platform rate) */}

              <div>
                <p className="mb-2 block text-sm font-medium text-gray-700">
                  Exchange Rate
                </p>

                <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-black">
                  {EXCHANGE_RATE}
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  Fixed platform rate — not editable.
                </p>
              </div>

              {/* Transfer Fee (fixed platform fee) */}

              <div>
                <p className="mb-2 block text-sm font-medium text-gray-700">
                  Transfer Fee
                </p>

                <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-black">
                  NPR {TRANSFER_FEE}
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  Fixed platform fee — not editable.
                </p>
              </div>
            </div>
          </section>

          {/* ======================================
              PAYOUT PREVIEW
          ====================================== */}

          <section className="rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-950 to-emerald-800 p-5 text-white shadow-lg shadow-emerald-900/10 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              <span className="text-white">Payout Summary</span>
            </h2>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="flex justify-between py-2">
                <span className="text-emerald-100/75">Sending Amount</span>

                <span className="font-medium text-white">
                  {amount || "0"} {sendingCurrency}
                </span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-emerald-100/75">Exchange Rate</span>

                <span className="font-medium text-white">{EXCHANGE_RATE}</span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-emerald-100/75">Fee</span>

                <span className="font-medium text-white">
                  {TRANSFER_FEE} NPR
                </span>
              </div>

              <div className="my-3 border-t border-white/15" />

              <div className="flex justify-between">
                <span className="font-semibold text-white">
                  Expected Payout
                </span>

                <span className="text-xl font-bold text-emerald-200">
                  {calculatedPayout > 0 ? calculatedPayout.toFixed(2) : "0.00"}{" "}
                  NPR
                </span>
              </div>
            </div>
          </section>

          {/* ======================================
              ERROR / SUCCESS
          ====================================== */}

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

          {/* ======================================
              SUBMIT
          ====================================== */}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-4 font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="w-5 h-5" />

            {submitting ? "Creating Remittance..." : "Create Remittance"}
          </button>
        </form>
      </div>
    </main>
  );
}
