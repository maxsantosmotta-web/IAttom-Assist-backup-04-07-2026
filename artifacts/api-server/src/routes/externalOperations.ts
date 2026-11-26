import { Router, type IRouter, type Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, users, savedItemsTable } from "@workspace/db";
import { AiFindProductsBody, AiValidateProductBody, AiCreateCampaignBody, AiCreateContentBody, AiVideoScriptBody, AiCreativeIdeasBody } from "@workspace/api-zod";
import { streamFindProducts } from "../lib/ai/findProducts.js";
import { streamValidateProduct } from "../lib/ai/validateProduct.js";
import { streamCreateCampaign } from "../lib/ai/createCampaign.js";
import { streamCreateContent } from "../lib/ai/createContent.js";
import { streamVideoScript } from "../lib/ai/videoScript.js";
import { streamCreativeIdeas } from "../lib/ai/creativeIdeas.js";
import { invokeExistingPromptGenerator, PROMPT_MODULE_PLANS } from "./prompts.js";
import { captureExistingStream } from "../lib/chatgpt/captureExistingStream.js";
import { deliveredCreativeAssets } from "../lib/chatgpt/creativeDelivery.js";
import { requireExternalAccess } from "../middlewares/requireExternalAccess.js";
import { isolatedExternalWritesEnabled } from "../lib/chatgpt/isolation.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import { AI_MODULE_PLANS, compactCreativePrompt } from "./ai.js";
import { FEATURE_COSTS, CREATIVE_FEATURES, deductCreditsInTransaction, type FeatureKey } from "../lib/credits.js";

const router: IRouter = Router();

// Read-only readiness check. No generation, debit, refund or database mutation.
router.get("/chatgpt/operations/readiness", requireExternalAccess,
  requirePlan(["pro", "business", "agency"]), (_req, res) => {
    res.json({ authenticated: true, paidPlanAccess: true, executionEnabled: isolatedExternalWritesEnabled() });
  });

// Reference the canonical module permission definitions for preflight and execution.
const PREFLIGHT_PLANS: Partial<Record<FeatureKey, string[]>> = {
  product_discovery: AI_MODULE_PLANS.product_discovery,
  product_validation: AI_MODULE_PLANS.product_validation,
  campaign: AI_MODULE_PLANS.campaign,
  content: AI_MODULE_PLANS.content,
  video_script: AI_MODULE_PLANS.video_script,
  prompt_creation: PROMPT_MODULE_PLANS,
  creativeImage1: AI_MODULE_PLANS.creative,
  creativeImage2: AI_MODULE_PLANS.creative,
  creativeImage3: AI_MODULE_PLANS.creative,
};

// Preflight is explicitly read-only. A positive response is never a payment
// authorization and does not reserve credits.
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
    res.status(404).json({ error: "user_not_found" }); return;
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
    executionEnabled: isolatedExternalWritesEnabled(),
    reserved: false,
  });
});

export default router;


// Operational adapter for existing text and image modules. This is never called by
// the website and is disabled by default even when read-only preflight works.
// The second flag prevents accidental writes against the official database.
const EXECUTABLE_MODULES = new Set(["product_discovery", "product_validation", "campaign", "content", "video_script", "prompt_creation", "creativeImage1", "creativeImage2", "creativeImage3"] as const);
type TextFeature = "product_discovery" | "product_validation" | "campaign" | "content" | "video_script";
type ExternalFeature = TextFeature | "prompt_creation" | "creativeImage1" | "creativeImage2" | "creativeImage3";
const IMAGE_FORMATS: Record<string, string[]> = {
  instagram: ["feed", "stories"], facebook: ["feed", "stories", "banner"],
  tiktok: ["feed", "stories"], mercado_livre: ["produto", "banner"],
  shopee: ["produto", "banner"], hotmart: ["capa", "banner"],
  kiwify: ["capa", "banner"], perfil: ["perfil"],
};

function parseExternalRequest(feature: ExternalFeature, input: unknown):
  | { success: true; run: (res: Response, userId: string) => Promise<void>; title: string; type: string; imageCount: number }
  | { success: false; error: string } {
  switch (feature) {
    case "product_discovery": {
      const parsed = AiFindProductsBody.safeParse(input);
      return parsed.success
        ? { success: true, run: (res, uid) => streamFindProducts(parsed.data, res, uid), title: parsed.data.query, type: "product_discovery", imageCount: 0 }
        : { success: false, error: parsed.error.message };
    }
    case "product_validation": {
      const parsed = AiValidateProductBody.safeParse(input);
      return parsed.success
        ? { success: true, run: (res, uid) => streamValidateProduct(parsed.data, res, uid), title: parsed.data.productName, type: "product_validation", imageCount: 0 }
        : { success: false, error: parsed.error.message };
    }
    case "campaign": {
      const parsed = AiCreateCampaignBody.safeParse(input);
      return parsed.success
        ? { success: true, run: (res, uid) => streamCreateCampaign(parsed.data, res, uid), title: parsed.data.product, type: "campaign", imageCount: 0 }
        : { success: false, error: parsed.error.message };
    }
    case "content": {
      const parsed = AiCreateContentBody.safeParse(input);
      return parsed.success
        ? { success: true, run: (res, uid) => streamCreateContent(parsed.data, res, uid), title: parsed.data.topic, type: "content", imageCount: 0 }
        : { success: false, error: parsed.error.message };
    }
    case "video_script": {
      const parsed = AiVideoScriptBody.safeParse(input);
      return parsed.success
        ? { success: true, run: (res, uid) => streamVideoScript(parsed.data, res, uid), title: parsed.data.product, type: "video_script", imageCount: 0 }
        : { success: false, error: parsed.error.message };
    }
    case "prompt_creation": {
      const params = input as { tipo?: unknown; subject?: unknown } | null;
      if (!params || typeof params.tipo !== "string" || typeof params.subject !== "string" ||
          !params.tipo.trim() || !params.subject.trim() || params.tipo.length > 50 || params.subject.length > 3000) {
        return { success: false, error: "invalid_prompt_request" };
      }
      const checked = { tipo: params.tipo, subject: params.subject };
      return { success: true, run: async (res, userId) => {
        res.setHeader("Content-Type", "text/event-stream");
        const data = await invokeExistingPromptGenerator(userId, checked);
        res.write(`data: ${JSON.stringify({ type: "result", data })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      }, title: checked.subject.slice(0, 150), type: "prompt", imageCount: 0 };
    }
    case "creativeImage1":
    case "creativeImage2":
    case "creativeImage3": {
      const parsed = AiCreativeIdeasBody.safeParse(input);
      if (!parsed.success) return { success: false, error: parsed.error.message };
      const imageCount = Number(feature.slice(-1));
      const formats = parsed.data.selectedFormats;
      const supported = IMAGE_FORMATS[parsed.data.platform] ?? [];
      if (formats.length !== imageCount || new Set(formats).size !== formats.length ||
          formats.some(format => !supported.includes(format)) ||
          !parsed.data.prompt.trim()) {
        return { success: false, error: "invalid_image_format_or_quantity" };
      }
      return { success: true, run: (res, uid) => streamCreativeIdeas({ ...parsed.data, prompt: compactCreativePrompt(parsed.data.prompt) }, res, uid),
        title: parsed.data.prompt.slice(0, 150), type: "creative", imageCount };
    }
  }
}

// Dedicated technical storage, initialized only inside the verified sandbox.
import { pgTable, text, boolean } from "drizzle-orm/pg-core";
const operationsTable = pgTable("chatgpt_external_operations", {
  id: text("id").primaryKey(), clerkUserId: text("clerk_user_id").notNull(),
  title: text("title").notNull(), type: text("type").notNull(),
  content: text("content").notNull().default(""), data: text("data"),
  imagesData: text("images_data"), hasImages: boolean("has_images").notNull().default(false),
});
async function ensureOperationsTable() {
  if (!isolatedExternalWritesEnabled()) throw new Error("Isolated writes disabled");
  await db.execute(sql`CREATE TABLE IF NOT EXISTS chatgpt_external_operations (
    id text PRIMARY KEY, clerk_user_id text NOT NULL, title text NOT NULL,
    type text NOT NULL, content text NOT NULL DEFAULT '', data text,
    images_data text, has_images boolean NOT NULL DEFAULT false
  )`);
}
// Request key is mandatory and owned by an authenticated Clerk identity.
// Technical operation primary key provides durable duplicate suppression without a
// new table/migration; pending requests never charge. Failed requests cannot
// silently regenerate under the same key.
router.post("/chatgpt/operations/execute", requireExternalAccess, async (req, res): Promise<void> => {
  if (!isolatedExternalWritesEnabled()) {
    res.status(503).json({ error: "isolated_external_writes_disabled" });
    return;
  }
  const body = req.body as { feature?: unknown; input?: unknown; requestId?: unknown } | undefined;
  const feature = body?.feature;
  const requestId = body?.requestId;
  if (typeof feature !== "string" || !EXECUTABLE_MODULES.has(feature as ExternalFeature)) {
    res.status(404).json({ error: "unsupported_external_feature" });
    return;
  }
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{16,72}$/.test(requestId)) {
    res.status(400).json({ error: "invalid_idempotency_key" });
    return;
  }
  const parsed = parseExternalRequest(feature as ExternalFeature, body?.input);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const userId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  const allowedPlans = PREFLIGHT_PLANS[feature as FeatureKey] ?? [];
  const key = "chatgpt-" + createHash("sha256").update(userId).update(":").update(requestId).digest("hex");
  const inputHash = createHash("sha256").update(JSON.stringify({ feature, input: body?.input })).digest("hex");
  const cost = FEATURE_COSTS[feature as ExternalFeature];

  try {
    await ensureOperationsTable();
    // Reserve the operation in dedicated technical storage, without debit.
    // The unique PK prevents a concurrent duplicate from generating twice.
    // A retry must return the original completed result before checking the
    // now-reduced balance. Never generate or debit twice for the same key.
    const [previousOperation] = await db.select({
      clerkUserId: operationsTable.clerkUserId,
      data: operationsTable.data,
      content: operationsTable.content,
    }).from(operationsTable).where(eq(operationsTable.id, key));
    if (previousOperation) {
      const state = previousOperation.data ? JSON.parse(previousOperation.data) as { inputHash?: string; status?: string } : {};
      if (previousOperation.clerkUserId !== userId || state.inputHash !== inputHash) {
        res.status(409).json({ error: "operation_conflict" }); return;
      }
      if (state.status === "complete") {
        res.json({ status: "complete", operationId: key, result: JSON.parse(previousOperation.content), chargedAgain: false });
        return;
      }
      res.status(409).json({ error: "operation_already_reserved", status: state.status ?? "unknown" });
      return;
    }
    const [existingUser] = await db.select({ plan: users.plan, role: users.role,
      credits: users.credits, extraCredits: users.extraCredits,
      creativeCredits: users.creativeCredits, extraCreativeCredits: users.extraCreativeCredits })
      .from(users).where(eq(users.clerkId, userId));
    if (!existingUser) { res.status(404).json({ error: "user_not_found" }); return; }
    if (existingUser.role !== "admin" && !allowedPlans.includes(existingUser.plan)) {
      res.status(403).json({ error: "plan_required" }); return;
    }
    const preflightBalance = CREATIVE_FEATURES.has(feature as ExternalFeature)
      ? existingUser.creativeCredits + (existingUser.extraCreativeCredits ?? 0)
      : existingUser.credits + (existingUser.extraCredits ?? 0);
    if (preflightBalance < cost) {
      res.status(402).json({ error: "insufficient_credits", required: cost }); return;
    }
    const [reserved] = await db.insert(operationsTable).values({
      id: key, clerkUserId: userId, title: parsed.title.slice(0, 150),
      type: "external_pending", content: "", data: JSON.stringify({ status: "pending", feature, inputHash }),
    }).onConflictDoNothing().returning({ id: operationsTable.id });
    if (!reserved) {
      const [previous] = await db.select({
        clerkUserId: operationsTable.clerkUserId, data: operationsTable.data, content: operationsTable.content,
      }).from(operationsTable).where(eq(operationsTable.id, key));
      const state = previous?.data ? JSON.parse(previous.data) as { inputHash?: string; status?: string } : {};
      if (!previous || previous.clerkUserId !== userId || state.inputHash !== inputHash) {
        res.status(409).json({ error: "operation_conflict" }); return;
      }
      if (state.status !== "complete") {
        res.status(409).json({ error: "operation_already_reserved", status: state.status ?? "unknown" }); return;
      }
      res.json({ status: "complete", projectId: key, result: JSON.parse(previous.content), chargedAgain: false }); return;
    }

    let result: unknown;
    try {
      result = await captureExistingStream(sink => parsed.run(sink, userId), parsed.imageCount ? 60_000_000 : 3_000_000);
    } catch (error) {
      await db.update(operationsTable)
        .set({ type: "external_failed", data: JSON.stringify({ status: "failed", feature, inputHash }) })
        .where(and(eq(operationsTable.id, key), eq(operationsTable.clerkUserId, userId)));
      req.log.warn({ error, feature }, "External generator failed without credit debit");
      res.status(502).json({ error: "generation_failed_no_charge" }); return;
    }

    // Never charge the price of multiple images for a partial delivery.
    let imageAssets: ReturnType<typeof deliveredCreativeAssets>["assets"] = [];
    let safeResult: unknown = result;
    if (parsed.imageCount) {
      try {
        const validated = deliveredCreativeAssets(result, parsed.imageCount);
        imageAssets = validated.assets;
        safeResult = validated.safeResult;
      } catch (error) {
        await db.update(operationsTable).set({
          type: "external_failed", data: JSON.stringify({ status: "failed", feature, inputHash }),
        }).where(and(eq(operationsTable.id, key), eq(operationsTable.clerkUserId, userId)));
        req.log.warn({ error, feature }, "Partial creative delivery rejected without debit");
        res.status(502).json({ error: "incomplete_images_no_charge" });
        return;
      }
    }

    // The balance check, debit ledger and library result commit together.
    // Use the canonical debit inside the same transaction as the result.
    const payment = await db.transaction(async tx => {
      const locked = await tx.execute(sql`SELECT credits, extra_credits, creative_credits, extra_creative_credits, plan, role FROM users WHERE clerk_id = ${userId} FOR UPDATE`);
      const row = locked.rows[0] as { credits: number | string; extra_credits: number | string; creative_credits: number | string; extra_creative_credits: number | string; plan: string; role: string } | undefined;
      if (!row) return { error: "user_not_found" as const };
      // The plan can change while an external provider is generating. Verify
      // eligibility again under the same row lock as the final debit.
      if (row.role !== "admin" && !allowedPlans.includes(row.plan)) return { error: "plan_required" as const };
      const debit = await deductCreditsInTransaction(tx, userId, feature as ExternalFeature);
      if (!debit.success) return { error: debit.error };
      const [saved] = await tx.update(operationsTable).set({
        title: parsed.title.slice(0, 150), type: parsed.type,
        content: JSON.stringify(safeResult),
        imagesData: parsed.imageCount ? JSON.stringify(imageAssets) : null,
        hasImages: imageAssets.length > 0,
        data: JSON.stringify({ status: "complete", feature, inputHash, source: "chatgpt" }),
      }).where(and(eq(operationsTable.id, key), eq(operationsTable.clerkUserId, userId), eq(operationsTable.type, "external_pending")))
        .returning({ id: operationsTable.id });
      if (!saved) throw new Error("Reservation lost before charge");
      return { operationId: saved.id, charged: debit.creditsUsed, balance: debit.newBalance };
    });
    if ("error" in payment) {
      await db.update(operationsTable).set({ type: "external_failed",
        data: JSON.stringify({ status: "failed", feature, inputHash, reason: payment.error }) })
        .where(and(eq(operationsTable.id, key), eq(operationsTable.clerkUserId, userId)));
      res.status(payment.error === "insufficient_credits" ? 402 : payment.error === "plan_required" ? 403 : 404).json({ error: payment.error, charged: 0 });
      return;
    }
    res.json({ status: "complete", feature, result: safeResult, imageCount: imageAssets.length, ...payment });
  } catch (error) {
    req.log.error({ error }, "External execution transaction failed");
    res.status(500).json({ error: "external_operation_failed" });
  }
});

// Safe recovery for network timeouts: do not issue a new generation key.
router.get("/chatgpt/operations/status/:requestId", requireExternalAccess, async (req, res): Promise<void> => {
  const requestId = String(req.params.requestId ?? "");
  if (!/^[A-Za-z0-9_-]{16,72}$/.test(requestId)) {
    res.status(400).json({ error: "invalid_idempotency_key" }); return;
  }
  const userId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  const key = "chatgpt-" + createHash("sha256").update(userId).update(":").update(requestId).digest("hex");
  try {
    await ensureOperationsTable();
    const [item] = await db.select({
      clerkUserId: operationsTable.clerkUserId, type: operationsTable.type,
      content: operationsTable.content, data: operationsTable.data,
      hasImages: operationsTable.hasImages,
    }).from(operationsTable).where(and(eq(operationsTable.id, key), eq(operationsTable.clerkUserId, userId)));
    if (!item) { res.status(404).json({ error: "operation_not_found" }); return; }
    const state = item.data ? JSON.parse(item.data) as { status?: string; feature?: string } : {};
    res.json({
      status: state.status ?? "unknown", feature: state.feature, projectId: key,
      hasImages: item.hasImages,
      ...(state.status === "complete" ? { result: JSON.parse(item.content) } : {}),
    });
  } catch (error) {
    req.log.error({ error }, "External status lookup failed");
    res.status(500).json({ error: "operation_status_unavailable" });
  }
});

router.post("/chatgpt/operations/save", requireExternalAccess, async (req, res): Promise<void> => {
  if (!isolatedExternalWritesEnabled()) { res.status(503).json({ error: "isolated_external_writes_disabled" }); return; }
  const requestId = req.body?.requestId;
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{16,72}$/.test(requestId)) {
    res.status(400).json({ error: "invalid_idempotency_key" }); return;
  }
  const userId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  const key = "chatgpt-" + createHash("sha256").update(userId).update(":").update(requestId).digest("hex");
  try {
    await ensureOperationsTable();
    const outcome = await db.transaction(async tx => {
      const [item] = await tx.select().from(operationsTable).where(and(eq(operationsTable.id, key), eq(operationsTable.clerkUserId, userId))).for("update");
      if (!item || !item.data || JSON.parse(item.data).status !== "complete") return "not_complete";
      const [existing] = await tx.select().from(savedItemsTable).where(eq(savedItemsTable.id, key));
      if (existing) return existing.clerkUserId === userId && !existing.deletedAt ? "saved" : "conflict";
      await tx.insert(savedItemsTable).values({ id: key, clerkUserId: userId, title: item.title, type: item.type, content: item.content, data: item.data, imagesData: item.imagesData, hasImages: item.hasImages });
      return "saved";
    });
    if (outcome !== "saved") { res.status(outcome === "conflict" ? 409 : 404).json({ error: outcome }); return; }
    res.json({ status: "saved", projectId: key, charged: 0 });
  } catch (error) {
    req.log.error({ error }, "External save failed");
    res.status(500).json({ error: "external_save_failed" });
  }
});
