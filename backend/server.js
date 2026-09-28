import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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
if (!process.env.FRONTEND_URL) {
  throw new Error(
    "FRONTEND_URL is not set. Refusing to start with an open CORS policy.",
  );
}

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// DATABASE
// =====================================================

connectDB();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
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
// TEST ROUTE
// =====================================================

app.get("/", (req, res) => {
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
// START
// =====================================================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
