import { Router } from "express";

import { getRemittanceAuditLogs } from "../controllers/auditLogController.js";

import { protect } from "../middleware/authMiddleware.js";

import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

router.get(
  "/remittance/:id",
  protect,
  requireRole("admin", "supervisor"),
  getRemittanceAuditLogs,
);

export default router;