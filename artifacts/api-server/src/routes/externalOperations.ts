import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Response } from "express";
import { db, users, savedItemsTable, creditsTransactions } from "@workspace/db";
import { AiFindProductsBody, AiValidateProductBody, AiCreateCampaignBody, AiCreateContentBody, AiVideoScriptBody } from "@workspace/api-zod";
import { streamFindProducts } from "../lib/ai/findProducts.js";
import { streamValidateProduct } from "../lib/ai/validateProduct.js";
import { streamCreateCampaign } from "../lib/ai/createCampaign.js";
import { streamCreateContent } from "../lib/ai/createContent.js";
import { streamVideoScript } from "../lib/ai/videoScript.js";
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


// Operational adapter for existing text modules only. This is never called by
// the website and is disabled by default even when read-only preflight works.
// The second flag prevents accidental writes against the official database.
const TEXT_MODULES = new Set(["product_discovery", "product_validation", "campaign", "content", "video_script"] as const);
type TextFeature = "product_discovery" | "product_validation" | "campaign" | "content" | "video_script";

function parseTextRequest(feature: TextFeature, input: unknown):
  | { success: true; run: (res: Response, userId: string) => Promise<void>; title: string; type: string }
  | { success: false; error: string } {
  switch (feature) {
    case "product_discovery": {
      const parsed = AiFindProductsBody.safeParse(input);
      return parsed.success
        ? { success: true, run: (res, uid) => streamFindProducts(parsed.data, res, uid), title: parsed.data.query, type: "product_discovery" }
        : { success: false, error: parsed.error.message };
    }
    case "product_validation": {
      const parsed = AiValidateProductBody.safeParse(input);
      return parsed.success
        ? { success: true, run: (res, uid) => streamValidateProduct(parsed.data, res, uid), title: parsed.data.productName, type: "product_validation" }
        : { success: false, error: parsed.error.message };
    }
    case "campaign": {
      const parsed = AiCreateCampaignBody.safeParse(input);
      return parsed.success
        ? { success: true, run: (res, uid) => streamCreateCampaign(parsed.data, res, uid), title: parsed.data.product, type: "campaign" }
        : { success: false, error: parsed.error.message };
    }
    case "content": {
      const parsed = AiCreateContentBody.safeParse(input);
      return parsed.success
        ? { success: true, run: (res, uid) => streamCreateContent(parsed.data, res, uid), title: parsed.data.topic, type: "content" }
        : { success: false, error: parsed.error.message };
    }
    case "video_script": {
      const parsed = AiVideoScriptBody.safeParse(input);
      return parsed.success
        ? { success: true, run: (res, uid) => streamVideoScript(parsed.data, res, uid), title: parsed.data.product, type: "video_script" }
        : { success: false, error: parsed.error.message };
    }
  }
}

// Compatibility sink for pre-existing SSE generators. We reuse their actual
// model logic, but never expose a partial response before debit + save commit.
async function captureExistingStream(run: (res: Response) => Promise<void>): Promise<unknown> {
  const events: Array<Record<string, unknown>> = [];
  let bytes = 0;
  let ended = false;
  const sink = {
    setHeader: () => sink,
    write(chunk: unknown) {
      if (ended) throw new Error("Stream already ended");
      const text = String(chunk);
      bytes += Buffer.byteLength(text);
      if (bytes > 3_000_000) throw new Error("Generated response too large");
      for (const event of text.split("\n\n")) {
        if (!event.startsWith("data: ")) continue;
        const parsed = JSON.parse(event.slice(6)) as Record<string, unknown>;
        if (parsed.type === "result" || parsed.type === "done" || parsed.type === "error") events.push(parsed);
      }
      return true;
    },
    end() { ended = true; return sink; },
  };
  await run(sink as unknown as Response);
  const failure = events.find(event => event.type === "error");
  if (failure) throw new Error("Existing generator returned an error");
  const result = events.find(event => event.type === "result");
  if (!ended || !events.some(event => event.type === "done") || !result || result.data === undefined) {
    throw new Error("Existing generator did not finish successfully");
  }
  return result.data;
}

// Request key is mandatory and owned by an authenticated Clerk identity.
// saved_items_v2 primary key provides durable duplicate suppression without a
// new table/migration; pending requests never charge. Failed requests cannot
// silently regenerate under the same key.
router.post("/chatgpt/operations/execute", requireExternalAccess, async (req, res): Promise<void> => {
  if (process.env.CHATGPT_EXTERNAL_WRITES_ENABLED !== "true" ||
      process.env.CHATGPT_EXTERNAL_ISOLATED_DB !== "true") {
    res.status(503).json({ error: "isolated_external_writes_disabled" });
    return;
  }
  const body = req.body as { feature?: unknown; input?: unknown; requestId?: unknown } | undefined;
  const feature = body?.feature;
  const requestId = body?.requestId;
  if (typeof feature !== "string" || !TEXT_MODULES.has(feature as TextFeature)) {
    res.status(404).json({ error: "unsupported_external_feature" });
    return;
  }
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{16,72}$/.test(requestId)) {
    res.status(400).json({ error: "invalid_idempotency_key" });
    return;
  }
  const parsed = parseTextRequest(feature as TextFeature, body?.input);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const userId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  const allowedPlans = PREFLIGHT_PLANS[feature as FeatureKey] ?? [];
  const key = "chatgpt-" + createHash("sha256").update(userId).update(":").update(requestId).digest("hex");
  const inputHash = createHash("sha256").update(JSON.stringify(body?.input)).digest("hex");
  const cost = FEATURE_COSTS[feature as TextFeature];

  try {
    // Reserve the operation in the user's existing library, without debit.
    // The unique PK prevents a concurrent duplicate from generating twice.
    const [existingUser] = await db.select({ plan: users.plan, role: users.role,
      credits: users.credits, extraCredits: users.extraCredits }).from(users).where(eq(users.clerkId, userId));
    if (!existingUser) { res.status(404).json({ error: "user_not_found" }); return; }
    if (existingUser.role !== "admin" && !allowedPlans.includes(existingUser.plan)) {
      res.status(403).json({ error: "plan_required" }); return;
    }
    if (existingUser.credits + (existingUser.extraCredits ?? 0) < cost) {
      res.status(402).json({ error: "insufficient_credits", required: cost }); return;
    }
    const [reserved] = await db.insert(savedItemsTable).values({
      id: key, clerkUserId: userId, title: parsed.title.slice(0, 150),
      type: "external_pending", content: "", data: JSON.stringify({ status: "pending", feature, inputHash }),
    }).onConflictDoNothing().returning({ id: savedItemsTable.id });
    if (!reserved) {
      const [previous] = await db.select({ clerkUserId: savedItemsTable.clerkUserId, data: savedItemsTable.data })
        .from(savedItemsTable).where(eq(savedItemsTable.id, key));
      if (!previous || previous.clerkUserId !== userId) { res.status(409).json({ error: "operation_conflict" }); return; }
      const state = previous.data ? JSON.parse(previous.data) as { inputHash?: string; status?: string } : {};
      if (state.inputHash !== inputHash || state.status !== "complete") {
        res.status(409).json({ error: "operation_already_reserved", status: state.status ?? "unknown" }); return;
      }
      res.json({ status: "complete", projectId: key, chargedAgain: false }); return;
    }

    let result: unknown;
    try {
      result = await captureExistingStream(sink => parsed.run(sink, userId));
    } catch (error) {
      await db.update(savedItemsTable)
        .set({ type: "external_failed", data: JSON.stringify({ status: "failed", feature, inputHash }) })
        .where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId)));
      req.log.warn({ error, feature }, "External generator failed without credit debit");
      res.status(502).json({ error: "generation_failed_no_charge" }); return;
    }

    // The balance check, debit ledger and library result commit together.
    // This mirrors the existing deductCredits arithmetic but avoids a nested
    // transaction and prohibits the public arbitrary /credits/refund endpoint.
    const payment = await db.transaction(async tx => {
      const locked = await tx.execute(sql`SELECT credits, extra_credits FROM users WHERE clerk_id = ${userId} FOR UPDATE`);
      const row = locked.rows[0] as { credits: number | string; extra_credits: number | string } | undefined;
      if (!row) return { error: "user_not_found" as const };
      const plan = Number(row.credits);
      const extra = Number(row.extra_credits ?? 0);
      const balance = plan + extra;
      if (balance < cost) return { error: "insufficient_credits" as const };
      const fromPlan = Math.min(cost, plan);
      const [saved] = await tx.update(savedItemsTable).set({
        title: parsed.title.slice(0, 150), type: parsed.type,
        content: JSON.stringify(result),
        data: JSON.stringify({ status: "complete", feature, inputHash, source: "chatgpt" }),
      }).where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId), eq(savedItemsTable.type, "external_pending")))
        .returning({ id: savedItemsTable.id });
      if (!saved) throw new Error("Reservation lost before charge");
      await tx.update(users).set({ credits: plan - fromPlan,
        extraCredits: extra - (cost - fromPlan), updatedAt: new Date() }).where(eq(users.clerkId, userId));
      await tx.insert(creditsTransactions).values({
        clerkUserId: userId, amount: -cost, type: "debit", feature,
        balanceType: "general", description: `Uso via ChatGPT: ${feature}`,
        balanceBefore: balance, balanceAfter: balance - cost,
      });
      return { projectId: saved.id, charged: cost, balance: balance - cost };
    });
    if ("error" in payment) {
      await db.update(savedItemsTable).set({ type: "external_failed",
        data: JSON.stringify({ status: "failed", feature, inputHash, reason: payment.error }) })
        .where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId)));
      res.status(payment.error === "insufficient_credits" ? 402 : 404).json({ error: payment.error, charged: 0 });
      return;
    }
    res.json({ status: "complete", feature, result, ...payment });
  } catch (error) {
    req.log.error({ error }, "External execution transaction failed");
    res.status(500).json({ error: "external_operation_failed" });
  }
});
