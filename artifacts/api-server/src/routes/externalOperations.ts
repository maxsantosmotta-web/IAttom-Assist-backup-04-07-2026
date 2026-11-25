import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, users, savedItemsTable, creditsTransactions } from "@workspace/db";
import { AiFindProductsBody, AiValidateProductBody, AiCreateCampaignBody, AiCreateContentBody, AiVideoScriptBody, AiCreativeIdeasBody } from "@workspace/api-zod";
import { streamFindProducts } from "../lib/ai/findProducts.js";
import { streamValidateProduct } from "../lib/ai/validateProduct.js";
import { streamCreateCampaign } from "../lib/ai/createCampaign.js";
import { streamCreateContent } from "../lib/ai/createContent.js";
import { streamVideoScript } from "../lib/ai/videoScript.js";
import { streamCreativeIdeas } from "../lib/ai/creativeIdeas.js";
import { captureExistingStream } from "../lib/chatgpt/captureExistingStream.js";
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
    executionEnabled: process.env.CHATGPT_EXTERNAL_WRITES_ENABLED === "true" && process.env.CHATGPT_EXTERNAL_ISOLATED_DB === "true",
    reserved: false,
  });
});

export default router;


// Operational adapter for existing text and image modules. This is never called by
// the website and is disabled by default even when read-only preflight works.
// The second flag prevents accidental writes against the official database.
const EXECUTABLE_MODULES = new Set(["product_discovery", "product_validation", "campaign", "content", "video_script", "creativeImage1", "creativeImage2", "creativeImage3"] as const);
type TextFeature = "product_discovery" | "product_validation" | "campaign" | "content" | "video_script";
type ExternalFeature = TextFeature | "creativeImage1" | "creativeImage2" | "creativeImage3";
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
          !parsed.data.prompt.trim() || parsed.data.prompt.length > 1800) {
        return { success: false, error: "invalid_image_format_or_quantity" };
      }
      return { success: true, run: (res, uid) => streamCreativeIdeas(parsed.data, res, uid),
        title: parsed.data.prompt.slice(0, 150), type: "creative", imageCount };
    }
  }
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
    // Reserve the operation in the user's existing library, without debit.
    // The unique PK prevents a concurrent duplicate from generating twice.
    // A retry must return the original completed result before checking the
    // now-reduced balance. Never generate or debit twice for the same key.
    const [previousOperation] = await db.select({
      clerkUserId: savedItemsTable.clerkUserId,
      data: savedItemsTable.data,
      content: savedItemsTable.content,
    }).from(savedItemsTable).where(eq(savedItemsTable.id, key));
    if (previousOperation) {
      const state = previousOperation.data ? JSON.parse(previousOperation.data) as { inputHash?: string; status?: string } : {};
      if (previousOperation.clerkUserId !== userId || state.inputHash !== inputHash) {
        res.status(409).json({ error: "operation_conflict" }); return;
      }
      if (state.status === "complete") {
        res.json({ status: "complete", projectId: key, result: JSON.parse(previousOperation.content), chargedAgain: false });
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
    const [reserved] = await db.insert(savedItemsTable).values({
      id: key, clerkUserId: userId, title: parsed.title.slice(0, 150),
      type: "external_pending", content: "", data: JSON.stringify({ status: "pending", feature, inputHash }),
    }).onConflictDoNothing().returning({ id: savedItemsTable.id });
    if (!reserved) {
      const [previous] = await db.select({
        clerkUserId: savedItemsTable.clerkUserId, data: savedItemsTable.data, content: savedItemsTable.content,
      }).from(savedItemsTable).where(eq(savedItemsTable.id, key));
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
      await db.update(savedItemsTable)
        .set({ type: "external_failed", data: JSON.stringify({ status: "failed", feature, inputHash }) })
        .where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId)));
      req.log.warn({ error, feature }, "External generator failed without credit debit");
      res.status(502).json({ error: "generation_failed_no_charge" }); return;
    }

    // Keep generated image bytes in the existing image library asset field.
    const concepts = parsed.imageCount ? (result as { concepts?: Array<{ imageBase64?: string; format?: string; label?: string }> })?.concepts : undefined;
    if (parsed.imageCount && (!Array.isArray(concepts) || !concepts.some(v => typeof v.imageBase64 === "string" && v.imageBase64.length > 0))) {
      await db.update(savedItemsTable).set({ type: "external_failed", data: JSON.stringify({ status: "failed", feature, inputHash }) })
        .where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId)));
      res.status(502).json({ error: "no_images_generated_no_charge" }); return;
    }
    const imageAssets = (concepts ?? []).filter(v => typeof v.imageBase64 === "string" && v.imageBase64.length > 0)
      .map((v, index) => ({ conceptIndex: index, base64: v.imageBase64, label: v.label ?? "", format: v.format ?? "" }));
    const safeResult = parsed.imageCount ? {
      ...(result as Record<string, unknown>),
      concepts: (concepts ?? []).map(({ imageBase64: _imageBase64, ...rest }) => rest),
    } : result;

    // The balance check, debit ledger and library result commit together.
    // This mirrors the existing deductCredits arithmetic but avoids a nested
    // transaction and prohibits the public arbitrary /credits/refund endpoint.
    const payment = await db.transaction(async tx => {
      const locked = await tx.execute(sql`SELECT credits, extra_credits, creative_credits, extra_creative_credits FROM users WHERE clerk_id = ${userId} FOR UPDATE`);
      const row = locked.rows[0] as { credits: number | string; extra_credits: number | string; creative_credits: number | string; extra_creative_credits: number | string } | undefined;
      if (!row) return { error: "user_not_found" as const };
      const creative = CREATIVE_FEATURES.has(feature as ExternalFeature);
      const plan = Number(creative ? row.creative_credits : row.credits);
      const extra = Number(creative ? row.extra_creative_credits ?? 0 : row.extra_credits ?? 0);
      const balance = plan + extra;
      if (balance < cost) return { error: "insufficient_credits" as const };
      const fromPlan = Math.min(cost, plan);
      const [saved] = await tx.update(savedItemsTable).set({
        title: parsed.title.slice(0, 150), type: parsed.type,
        content: JSON.stringify(safeResult),
        imagesData: parsed.imageCount ? JSON.stringify(imageAssets) : null,
        hasImages: imageAssets.length > 0,
        data: JSON.stringify({ status: "complete", feature, inputHash, source: "chatgpt" }),
      }).where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId), eq(savedItemsTable.type, "external_pending")))
        .returning({ id: savedItemsTable.id });
      if (!saved) throw new Error("Reservation lost before charge");
      await tx.update(users).set(creative
        ? { creativeCredits: plan - fromPlan, extraCreativeCredits: extra - (cost - fromPlan), updatedAt: new Date() }
        : { credits: plan - fromPlan, extraCredits: extra - (cost - fromPlan), updatedAt: new Date() })
        .where(eq(users.clerkId, userId));
      await tx.insert(creditsTransactions).values({
        clerkUserId: userId, amount: -cost, type: "debit", feature,
        balanceType: CREATIVE_FEATURES.has(feature as ExternalFeature) ? "creative" : "general", description: `Uso via ChatGPT: ${feature}`,
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
    const [item] = await db.select({
      clerkUserId: savedItemsTable.clerkUserId, type: savedItemsTable.type,
      content: savedItemsTable.content, data: savedItemsTable.data,
      hasImages: savedItemsTable.hasImages,
    }).from(savedItemsTable).where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId)));
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
