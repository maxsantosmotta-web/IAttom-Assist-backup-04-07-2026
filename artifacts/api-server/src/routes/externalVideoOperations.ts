import { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { creditsTransactions, db, historyTable, savedItemsTable, users, videoTransactions } from "@workspace/db";
import { requireExternalAccess } from "../middlewares/requireExternalAccess.js";
import { isolatedExternalWritesEnabled } from "../lib/chatgpt/isolation.js";
import { getImageMotionResult, getImageMotionStatus, submitImageMotion, type ImageMotionFormat } from "../lib/falImageMotionClient.js";

const router: IRouter = Router();
const PAID = new Set(["pro", "business", "agency"]);
const REQUEST_ID = /^[A-Za-z0-9_-]{16,72}$/;
const DELIVERY_PREFIX = "Vídeo com Efeito entregue • requestId:";
const HISTORY_PREFIX = "Vídeo com Efeito gerado • requestId:";

function keyFor(user: string, id: string): string {
  return "chatgpt-video-" + createHash("sha256").update(user).update(":").update(id).digest("hex");
}
function imageInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^data:image\/(?:png|jpe?g);base64,([A-Za-z0-9+/=]+)$/i.exec(value);
  if (!match) return null;
  const base64 = match[1];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  if (Math.floor(base64.length * 3 / 4) - padding > 8 * 1024 * 1024) return null;
  return value;
}
function readState(value: string | null): {
  status?: string; inputHash?: string; providerId?: string; prompt?: string; format?: ImageMotionFormat;
} {
  if (!value) return {};
  return JSON.parse(value) as ReturnType<typeof readState>;
}
async function ownedProject(userId: string, id: string) {
  const [record] = await db.select({
    id: savedItemsTable.id,
    data: savedItemsTable.data,
    content: savedItemsTable.content,
  }).from(savedItemsTable).where(and(eq(savedItemsTable.id, keyFor(userId, id)), eq(savedItemsTable.clerkUserId, userId)));
  return record ?? null;
}

router.post("/chatgpt/video/submit", requireExternalAccess, async (req, res): Promise<void> => {
  if (!isolatedExternalWritesEnabled()) { res.status(503).json({ error: "isolated_external_writes_disabled" }); return; }
  const body = req.body as { requestId?: unknown; imageDataUrl?: unknown; sourceProjectId?: unknown; conceptIndex?: unknown; prompt?: unknown; format?: unknown } | undefined;
  const requestId = body?.requestId;
  const directImage = imageInput(body?.imageDataUrl);
  const sourceProjectId = body?.sourceProjectId;
  const conceptIndex = body?.conceptIndex;
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId) ||
      (!directImage && (typeof sourceProjectId !== "string" || !Number.isInteger(conceptIndex) || Number(conceptIndex) < 0)) ||
      typeof body?.prompt !== "string" || body.prompt.trim().length === 0 ||
      body.prompt.length > 1200 ||
      (body.format !== "vertical" && body.format !== "horizontal" && body.format !== "automatic")) {
    res.status(400).json({ error: "invalid_video_request" }); return;
  }
  const userId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  let image = directImage;
  if (!image && typeof sourceProjectId === "string" && Number.isInteger(conceptIndex)) {
    const [source] = await db.select({ imagesData: savedItemsTable.imagesData })
      .from(savedItemsTable).where(and(
        eq(savedItemsTable.id, sourceProjectId), eq(savedItemsTable.clerkUserId, userId),
        isNull(savedItemsTable.deletedAt),
      ));
    if (!source?.imagesData) { res.status(404).json({ error: "source_image_not_found" }); return; }
    try {
      const images = JSON.parse(source.imagesData) as Array<{ conceptIndex?: number; base64?: string }>;
      const asset = images.find(asset => asset.conceptIndex === Number(conceptIndex));
      const raw = asset?.base64;
      image = imageInput(typeof raw === "string" && raw.startsWith("data:")
        ? raw : `data:image/png;base64,${raw ?? ""}`);
    } catch {
      image = null;
    }
    if (!image) { res.status(400).json({ error: "source_image_invalid" }); return; }
  }
  if (!image) { res.status(400).json({ error: "source_image_invalid" }); return; }
  const format = body.format as ImageMotionFormat;
  const prompt = body.prompt.trim();
  const inputHash = createHash("sha256").update(JSON.stringify({ image, prompt, format })).digest("hex");
  const key = keyFor(userId, requestId);
  try {
    const previous = await ownedProject(userId, requestId);
    if (previous) {
      const state = readState(previous.data);
      if (state.inputHash !== inputHash) { res.status(409).json({ error: "operation_conflict" }); return; }
      res.json({ status: state.status, projectId: key, chargedAgain: false }); return;
    }
    const [user] = await db.select({ plan: users.plan, role: users.role, videoBalance: users.videoBalance })
      .from(users).where(eq(users.clerkId, userId));
    if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
    if (user.role !== "admin" && !PAID.has(user.plan)) {
      res.status(403).json({ error: "plan_required" }); return;
    }
    if ((user.videoBalance ?? 0) <= 0) { res.status(402).json({ error: "insufficient_video_balance" }); return; }
    const [created] = await db.insert(savedItemsTable).values({
      id: key, clerkUserId: userId, title: "Vídeo com Efeito", type: "external_video_pending",
      content: "", data: JSON.stringify({ status: "submitting", inputHash, prompt, format }),
    }).onConflictDoNothing().returning({ id: savedItemsTable.id });
    if (!created) { res.status(409).json({ error: "operation_already_reserved" }); return; }
    try {
      const submitted = await submitImageMotion({ imageDataUrl: image, prompt, format, duration: "6s" });
      await db.update(savedItemsTable).set({
        type: "external_video_processing",
        data: JSON.stringify({ status: "processing", inputHash, providerId: submitted.requestId, prompt, format }),
      }).where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId)));
      res.status(202).json({ status: "processing", projectId: key, duration: 6, charged: 0 });
    } catch (error) {
      req.log.warn({ error }, "External video provider submit failed");
      await db.update(savedItemsTable).set({
        type: "external_video_failed", data: JSON.stringify({ status: "failed", inputHash }),
      }).where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId)));
      res.status(502).json({ error: "video_submission_failed_no_charge" });
    }
  } catch (error) {
    req.log.error({ error }, "External video submit failed");
    res.status(500).json({ error: "external_video_submit_unavailable" });
  }
});

router.get("/chatgpt/video/status/:requestId", requireExternalAccess, async (req, res): Promise<void> => {
  const requestId = String(req.params.requestId ?? "");
  if (!REQUEST_ID.test(requestId)) { res.status(400).json({ error: "invalid_idempotency_key" }); return; }
  const userId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  try {
    const record = await ownedProject(userId, requestId);
    if (!record) { res.status(404).json({ error: "operation_not_found" }); return; }
    const state = readState(record.data);
    if (state.status !== "processing" || !state.providerId) {
      res.json({ status: state.status ?? "unknown", projectId: record.id,
        ...(state.status === "complete" ? { result: JSON.parse(record.content) } : {}) });
      return;
    }
    const provider = await getImageMotionStatus(state.providerId);
    res.json({ status: provider.status, projectId: record.id, readyToCollect: provider.status === "COMPLETED" });
  } catch (error) {
    req.log.warn({ error }, "External video status unavailable");
    res.status(502).json({ error: "external_video_status_unavailable" });
  }
});

router.post("/chatgpt/video/collect", requireExternalAccess, async (req, res): Promise<void> => {
  if (!isolatedExternalWritesEnabled()) { res.status(503).json({ error: "isolated_external_writes_disabled" }); return; }
  const requestId = (req.body as { requestId?: unknown } | undefined)?.requestId;
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId)) {
    res.status(400).json({ error: "invalid_idempotency_key" }); return;
  }
  const userId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  const key = keyFor(userId, requestId);
  try {
    const record = await ownedProject(userId, requestId);
    if (!record) { res.status(404).json({ error: "operation_not_found" }); return; }
    const state = readState(record.data);
    if (state.status === "complete") {
      res.json({ status: "complete", projectId: key, result: JSON.parse(record.content), chargedAgain: false });
      return;
    }
    if (state.status !== "processing" || !state.providerId) {
      res.status(409).json({ error: "operation_not_ready" }); return;
    }
    const delivered = await getImageMotionResult(state.providerId);
    if (!delivered.videoUrl) { res.status(502).json({ error: "video_not_ready" }); return; }
    const description = DELIVERY_PREFIX + state.providerId;
    const charged = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId + ":" + state.providerId}))`);
      const [current] = await tx.select({ data: savedItemsTable.data, content: savedItemsTable.content })
        .from(savedItemsTable).where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId)));
      if (!current) return { error: "operation_not_found" as const };
      if (readState(current.data).status === "complete") {
        return { alreadyCharged: true, result: JSON.parse(current.content) as object };
      }
      const [oldCharge] = await tx.select({ balanceAfter: videoTransactions.balanceAfter })
        .from(videoTransactions).where(and(eq(videoTransactions.clerkUserId, userId),
          eq(videoTransactions.description, description))).limit(1);
      const locked = await tx.execute(sql`SELECT video_balance FROM users WHERE clerk_id = ${userId} FOR UPDATE`);
      const balance = Number((locked.rows[0] as { video_balance?: unknown } | undefined)?.video_balance ?? 0);
      if (!oldCharge && balance <= 0) return { error: "insufficient_video_balance" as const };
      const item = {
        type: "video_effect",
        prompt: state.prompt,
        format: state.format,
        videoUrl: delivered.videoUrl,
      };
      const [saved] = await tx.update(savedItemsTable).set({
        type: "creative",
        content: JSON.stringify(item),
        data: JSON.stringify({ ...state, status: "complete" }),
        videosData: JSON.stringify([{
          videoUrl: delivered.videoUrl, title: "Vídeo com Efeito",
          durationSeconds: 6, savedAt: new Date().toISOString(), provider: "fal",
        }]),
      }).where(and(eq(savedItemsTable.id, key), eq(savedItemsTable.clerkUserId, userId),
        eq(savedItemsTable.type, "external_video_processing"))).returning({ id: savedItemsTable.id });
      if (!saved) throw new Error("Video reservation lost before delivery");
      if (!oldCharge) {
        await tx.update(users).set({ videoBalance: balance - 1, updatedAt: new Date() })
          .where(eq(users.clerkId, userId));
        await tx.insert(videoTransactions).values({
          clerkUserId: userId, amount: -1, type: "use", description, balanceBefore: balance, balanceAfter: balance - 1,
        });
        await tx.insert(creditsTransactions).values({
          clerkUserId: userId, amount: -1, type: "debit", balanceType: "video",
          description, balanceBefore: balance, balanceAfter: balance - 1,
        });
      }
      const historyAction = HISTORY_PREFIX + state.providerId;
      const [historyEvent] = await tx.select({ id: historyTable.id }).from(historyTable)
        .where(and(eq(historyTable.clerkUserId, userId), eq(historyTable.action, historyAction))).limit(1);
      if (!historyEvent) await tx.insert(historyTable).values({
        clerkUserId: userId, action: historyAction, module: "video_effect", projectName: "Vídeo com Efeito",
      });
      return { alreadyCharged: !!oldCharge, result: item };
    });
    if ("error" in charged) {
      res.status(charged.error === "insufficient_video_balance" ? 402 : 404)
        .json({ error: charged.error, charged: 0 }); return;
    }
    res.json({ status: "complete", projectId: key, result: charged.result, chargedAgain: !!charged.alreadyCharged });
  } catch (error) {
    req.log.warn({ error }, "External video result unavailable");
    res.status(502).json({ error: "external_video_collect_unavailable" });
  }
});

export default router;
