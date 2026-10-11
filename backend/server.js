import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.ts";
import userRoutes from "./routes/userRoutes.ts";
import remittanceRoutes from "./routes/remittanceRoutes.ts";
import disputeRoutes from "./routes/disputeRoutes.ts";
import auditLogRoutes from "./routes/auditLogRoutes.ts";

import { csrfProtection } from "./middleware/csrfMiddleware.ts";

dotenv.config();

// Fail fast if the frontend URL is missing.
// Without this, `cors` reflects the request Origin and
// any site can send credentialed requests.
const configuredFrontendUrls = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

if (configuredFrontendUrls.length === 0) {
  throw new Error(
    "FRONTEND_URL is not set. Refusing to start with an open CORS policy.",
  );
}

const allowedFrontendOrigins = new Set([
  ...configuredFrontendUrls,
  "https://remit-chain-eta.vercel.app",
]);

const app = express();
const PORT = process.env.PORT || 5000;

// Correct client IPs (and therefore req.ip) when running behind a proxy / load
// balancer, which the rate limiter depends on.
app.set("trust proxy", 1);

// =====================================================
// DATABASE
// =====================================================

connectDB();

// =====================================================
// MIDDLEWARE
// =====================================================

// Security headers. The API only serves JSON, so the default CSP is enough
// to neutralise any attempt to get a browser to render our responses.
app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, Boolean(origin && allowedFrontendOrigins.has(origin)));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// CSRF must run after cookieParser
app.use(csrfProtection);

// =====================================================
// HEALTH ROUTE
// =====================================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "RemitChain API is running",
  });
});

// =====================================================
// ROUTES
// =====================================================

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/remittances", remittanceRoutes);
app.use("/api/disputes", disputeRoutes);
app.use("/api/audit-logs", auditLogRoutes);

// =====================================================
// FALLBACKS
// =====================================================

// Unmatched route. Without this Express answers with an HTML error page,
// which the JSON-only frontend cannot read.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Last-resort error handler so a thrown error is still JSON.
// Express 5 forwards rejected promises here automatically.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  // An invalid :id used to surface as a 500 because Mongoose CastErrors were
  // never translated. Treat them as a bad request.
  if (error && typeof error === "object" && "name" in error) {
    if (String(error.name) === "CastError") {
      res.status(400).json({
        success: false,
        message: "Malformed identifier",
      });
      return;
    }
  }

  console.error("Unhandled request error:", error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// =====================================================
// START
// =====================================================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
