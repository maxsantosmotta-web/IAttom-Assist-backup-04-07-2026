import { Router, type IRouter } from "express";
import { requireExternalAccess } from "../middlewares/requireExternalAccess.js";
import { requirePlan } from "../middlewares/requirePlan.js";

const router: IRouter = Router();

// Read-only readiness check. No generation, debit, refund or database mutation.
// This router is intentionally not mounted until isolated deployment is verified.
router.get("/chatgpt/operations/readiness", requireExternalAccess,
  requirePlan(["pro", "business", "agency"]), (_req, res) => {
    res.json({ authenticated: true, paidPlanAccess: true, executionEnabled: false });
  });

export default router;
