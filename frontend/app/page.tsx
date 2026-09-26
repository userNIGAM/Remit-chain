import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">RemitChain</h1>

          <p className="mt-3 text-gray-600">
            Secure and transparent remittance tracking
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Welcome</h2>

          <p className="mt-2 text-sm text-gray-500">
            Send, track and verify remittances securely.
          </p>

          <Link
            href="/login"
            className="mt-6 block w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 transition"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="mt-3 block w-full rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Create Account
          </Link>
        </div>
      </div>
    </main>
  );
}
