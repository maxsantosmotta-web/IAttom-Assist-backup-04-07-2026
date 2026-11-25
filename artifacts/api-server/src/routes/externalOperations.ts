import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { requireExternalAccess } from "../middlewares/requireExternalAccess.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import { FEATURE_COSTS, CREATIVE_FEATURES, type FeatureKey } from "../lib/credits.js";

const router: IRouter = Router();

// Read-only readiness check. No generation, debit, refund or database mutation.
router.get("/chatgpt/operations/readiness", requireExternalAccess,
  requirePlan(["pro", "business", "agency"]), (_req, res) => {
    res.json({ authenticated: true, paidPlanAccess: true, executionEnabled: false });
  });

// These gates are identical to the existing /ai module route guards. Do not
// substitute this list for the original requirePlan middleware during execution.
const PREFLIGHT_PLANS: Partial<Record<FeatureKey, string[]>> = {
  product_discovery: ["agency"],
  product_validation: ["business", "agency"],
  campaign: ["pro", "business", "agency"],
  content: ["agency"],
  video_script: ["business", "agency"],
  creativeImage1: ["pro", "business", "agency"],
  creativeImage2: ["pro", "business", "agency"],
  creativeImage3: ["pro", "business", "agency"],
};

// Preflight is explicitly read-only. A positive response is never a payment
// authorization and does not reserve credits; real execution stays disabled.
router.get("/chatgpt/operations/preflight/:feature", requireExternalAccess, async (req, res): Promise<void> => {
  const feature = String(req.params.feature ?? "") as FeatureKey;
  const allowedPlans = PREFLIGHT_PLANS[feature];
  if (!allowedPlans || !(feature in FEATURE_COSTS)) {
    res.status(404).json({ error: "unsupported_external_feature" });
    return;
  }
  const clerkId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  const [user] = await db.select({
    plan: users.plan,
    role: users.role,
    credits: users.credits,
    extraCredits: users.extraCredits,
    creativeCredits: users.creativeCredits,
    extraCreativeCredits: users.extraCreativeCredits,
  }).from(users).where(eq(users.clerkId, clerkId));
  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  const planAllowed = user.role === "admin" || allowedPlans.includes(user.plan);
  const isCreative = CREATIVE_FEATURES.has(feature);
  const balance = isCreative
    ? user.creativeCredits + (user.extraCreativeCredits ?? 0)
    : user.credits + (user.extraCredits ?? 0);
  const required = FEATURE_COSTS[feature];
  // Unlike the website beta/owner bypass, external execution can never be free.
  res.json({
    feature,
    planAllowed,
    balanceType: isCreative ? "creative" : "general",
    balance,
    required,
    sufficientBalance: balance >= required,
    canRequestExecution: planAllowed && balance >= required,
    executionEnabled: false,
    reserved: false,
  });
});

export default router;
