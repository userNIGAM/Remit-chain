"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";

import { api } from "@/lib/api";

export default function CreateRemittancePage() {
  const router = useRouter();

  const [remitId, setRemitId] = useState("");
  const [amount, setAmount] = useState("");
  const [sendingCurrency, setSendingCurrency] = useState("AED");
  const [exchangeRate, setExchangeRate] = useState("");
  const [fee, setFee] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank");
  const [channel, setChannel] = useState("online");

  const [receiver, setReceiver] = useState<any>(null);
  const [loadingReceiver, setLoadingReceiver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

      const data = await api(
        `/remittances/receiver?remitId=${encodeURIComponent(remitId.trim())}`,
      );

      setReceiver(data.receiver);
    } catch (error: any) {
      setError(error.message || "Receiver not found");
    } finally {
      setLoadingReceiver(false);
    }
  };

  // ==========================================
  // CALCULATE EXPECTED PAYOUT
  // ==========================================

  const calculatedPayout =
    Number(amount || 0) * Number(exchangeRate || 0) - Number(fee || 0);

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

      if (!amount || Number(amount) <= 0) {
        setError("Enter a valid amount");
        return;
      }

      if (!exchangeRate || Number(exchangeRate) <= 0) {
        setError("Enter a valid exchange rate");
        return;
      }

      if (Number(fee) < 0) {
        setError("Fee cannot be negative");
        return;
      }

      setSubmitting(true);

      const data = await api("/remittances", {
        method: "POST",
        body: JSON.stringify({
          receiverRemitId: receiver.remitId,
          amount: Number(amount),
          sendingCurrency,
          exchangeRate: Number(exchangeRate),
          fee: Number(fee || 0),
          payoutMethod,
          channel,
        }),
      });

      setSuccess(
        `Remittance created successfully: ${data.remittance.transactionId}`,
      );
      console.log("Created remittance:", data.remittance);
      console.log("Mongo ID:", data.remittance?._id);
      // Redirect to transaction page if available
      if (data.remittance?.id) {
        setTimeout(() => {
          router.push(`/remittance/${data.remittance.id}`);
        }, 1000);
      }
    } catch (error: any) {
      setError(error.message || "Failed to create remittance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* ==========================================
          HEADER
      ========================================== */}

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-xl font-bold text-gray-900">
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

      <div className="max-w-5xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ======================================
              RECEIVER
          ====================================== */}

          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900">Receiver</h2>

            <p className="text-sm text-gray-500 mt-1">
              Enter the receiver's Remit ID.
            </p>

            <div className="flex gap-3 mt-5">
              <input
                type="text"
                value={remitId}
                onChange={(e) => setRemitId(e.target.value)}
                placeholder="Example: NP-24574"
                className="flex-1 border text-black border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
              />

              <button
                type="button"
                onClick={findReceiver}
                disabled={loadingReceiver}
                className="px-5 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {loadingReceiver ? "Searching..." : "Find Receiver"}
              </button>
            </div>

            {/* Receiver found */}

            {receiver && (
              <div className="mt-5 border border-green-200 bg-green-50 rounded-lg p-4">
                <p className="font-semibold text-green-800">Receiver Found</p>

                <div className="mt-3 grid text-black grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
                    <strong>{receiver.phone}</strong>
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

          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Remittance Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              {/* Amount */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sending Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  className="w-full border text-black border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Currency */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sending Currency
                </label>

                <select
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

              {/* Exchange Rate */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exchange Rate
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  placeholder="36.5"
                  className="w-full border text-black border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Fee */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fee
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="25"
                  className="w-full border text-black border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Channel */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Channel
                </label>

                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full border text-black border-gray-300 rounded-lg px-4 py-3 bg-white"
                >
                  <option value="online">Online</option>

                  <option value="agent">Agent / Branch</option>
                </select>
              </div>

              {/* Payout Method */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payout Method
                </label>

                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full border text-black border-gray-300 rounded-lg px-4 py-3 bg-white"
                >
                  <option value="bank">Bank</option>

                  <option value="wallet">Wallet</option>

                  <option value="cash">Cash</option>
                </select>
              </div>
            </div>
          </section>

          {/* ======================================
              PAYOUT PREVIEW
          ====================================== */}

          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Payout Summary
            </h2>

            <div className="mt-5 bg-gray-50 rounded-lg p-5">
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Sending Amount</span>

                <span className="font-medium">
                  {amount || "0"} {sendingCurrency}
                </span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-gray-500">Exchange Rate</span>

                <span className="font-medium">{exchangeRate || "0"}</span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-gray-500">Fee</span>

                <span className="font-medium">
                  {fee || "0"} {sendingCurrency}
                </span>
              </div>

              <div className="border-t border-gray-200 my-3" />

              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">
                  Expected Payout
                </span>

                <span className="font-bold text-xl text-green-600">
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
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg py-4 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />

            {submitting ? "Creating Remittance..." : "Create Remittance"}
          </button>
        </form>
      </div>
    </main>
  );
}
