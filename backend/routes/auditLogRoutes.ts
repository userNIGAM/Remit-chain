import { Router } from "express";

import {
  getAuditLogs,
  getRemittanceAuditLogs,
} from "../controllers/auditLogController.js";

import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// Global list — staff only
router.get("/", protect, requireRole("admin", "supervisor"), getAuditLogs);

// Per-remittance history — any authenticated owner/staff
router.get("/remittance/:id", protect, getRemittanceAuditLogs);

export default router;