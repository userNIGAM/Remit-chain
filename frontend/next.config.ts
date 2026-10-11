import type { NextConfig } from "next";

// The API is proxied through this origin so the browser treats it as
// first-party. That keeps the httpOnly session cookie and the CSRF token
// readable/usable, which breaks when the frontend (Vercel) and backend
// (Render) are separate domains and the browser blocks third-party cookies.
//
// Override the backend with the server-side BACKEND_URL env var on Vercel.
const BACKEND_URL =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://remit-chain.onrender.com"
    : "http://localhost:5000");

const normalizedBackendUrl = BACKEND_URL.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${normalizedBackendUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // Never let the CDN cache authenticated API responses.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
