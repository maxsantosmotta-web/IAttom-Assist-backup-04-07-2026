import { Router, type IRouter, type NextFunction, type Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { creditsTransactions, db, historyTable, users, videoTransactions } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import {
  FalProviderError,
  getImageMotionResult,
  getImageMotionStatus,
  submitImageMotion,
  type ImageMotionFormat,
} from "../lib/falImageMotionClient.js";

const router: IRouter = Router();
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 1500;
const PAID_PLANS = new Set(["pro", "business", "agency"]);
const DELIVERY_PREFIX = "Vídeo com Efeito entregue • requestId:";
const HISTORY_PREFIX = "Vídeo com Efeito gerado • requestId:";

type CommercialUser = { role: string | null; plan: string | null; videoBalance: number | null };

function decodeImageDataUrl(value: unknown): { dataUrl: string; bytes: number } | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/(?:png|jpe?g));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  const encoded = match[2] ?? "";
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return { dataUrl: value, bytes: Math.floor((encoded.length * 3) / 4) - padding };
}

async function getCommercialUser(clerkUserId: string): Promise<CommercialUser | null> {
  const [user] = await db
    .select({ role: users.role, plan: users.plan, videoBalance: users.videoBalance })
    .from(users)
    .where(eq(users.clerkId, clerkUserId));
  return user ?? null;
}

async function passAdminOrRequirePaid(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): Promise<CommercialUser | null> {
  const user = await getCommercialUser(req.clerkUserId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return null;
  }

  // O administrador também passa pela camada comercial durante os testes reais.
  // Assim o saldo comprado, o desconto e o histórico seguem exatamente o mesmo fluxo do usuário final.
  if (user.role !== "admin" && !PAID_PLANS.has(user.plan ?? "")) {
    res.status(403).json({ error: "Recurso disponível apenas para planos elegíveis." });
    return null;
  }
  return user;
}

function providerError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof FalProviderError) {
    if (error.retryAfterSeconds) res.setHeader("Retry-After", String(error.retryAfterSeconds));
    const status = error.status === 408 || error.status === 504 ? 504 : error.status === 429 ? 429 : 502;
    res.status(status).json({ error: error.message || fallback });
    return;
  }
  const message = error instanceof Error && error.message.trim() ? error.message : fallback;
  res.status(502).json({ error: message });
}

router.post("/image-motion/submit", requireAuth, async (req, res, next): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = await passAdminOrRequirePaid(authReq, res, next);
  if (!user) return;

  if ((user.videoBalance ?? 0) <= 0) {
    res.status(402).json({ error: "insufficient_video_balance", balance: 0 });
    return;
  }

  const body = req.body as { imageDataUrl?: unknown; prompt?: unknown; format?: unknown };
  const image = decodeImageDataUrl(body.imageDataUrl);
  if (!image) { res.status(400).json({ error: "Envie uma imagem PNG, JPG ou JPEG válida." }); return; }
  if (image.bytes > MAX_IMAGE_BYTES) { res.status(413).json({ error: "A imagem deve ter no máximo 8 MB." }); return; }
  if (typeof body.prompt !== "string" || !body.prompt.trim()) { res.status(400).json({ error: "Descreva o efeito em movimento desejado." }); return; }
  const prompt = body.prompt.trim();
  if (prompt.length > MAX_PROMPT_LENGTH) { res.status(400).json({ error: `A descrição deve ter no máximo ${MAX_PROMPT_LENGTH} caracteres.` }); return; }
  if (body.format !== "vertical" && body.format !== "horizontal" && body.format !== "automatic") {
    res.status(400).json({ error: "Formato inválido. Escolha Vertical, Horizontal ou Automático." });
    return;
  }

  try {
    const format = body.format as ImageMotionFormat;
    const submission = await submitImageMotion({ imageDataUrl: image.dataUrl, prompt, format, duration: "6s" });
    res.status(202).json({ requestId: submission.requestId, duration: 6, format });
  } catch (error) {
    req.log.error({ err: error }, "commercial image-motion submit failed");
    providerError(res, error, "Não foi possível enviar a imagem para processamento.");
  }
});

router.get("/image-motion/status/:requestId", requireAuth, async (req, res, next): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = await passAdminOrRequirePaid(authReq, res, next);
  if (!user) return;
  try {
    res.json(await getImageMotionStatus(String(req.params.requestId ?? "")));
  } catch (error) {
    req.log.error({ err: error }, "commercial image-motion status failed");
    providerError(res, error, "Não foi possível consultar o processamento.");
  }
});

router.get("/image-motion/result/:requestId", requireAuth, async (req, res, next): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = await passAdminOrRequirePaid(authReq, res, next);
  if (!user) return;

  const requestId = String(req.params.requestId ?? "");
  try {
    const result = await getImageMotionResult(requestId);
    if (!result.videoUrl) {
      res.status(502).json({ error: "O vídeo final ainda não está disponível." });
      return;
    }

    const description = `${DELIVERY_PREFIX}${requestId}`;
    const historyAction = `${HISTORY_PREFIX}${requestId}`;
    const charged = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${authReq.clerkUserId}:${requestId}`}))`);

      const [historyEvent] = await tx
        .select({ id: historyTable.id })
        .from(historyTable)
        .where(and(
          eq(historyTable.clerkUserId, authReq.clerkUserId),
          eq(historyTable.action, historyAction),
        ))
        .limit(1);

      if (!historyEvent) {
        await tx.insert(historyTable).values({
          clerkUserId: authReq.clerkUserId,
          action: historyAction,
          module: "video_effect",
          projectName: "Vídeo com Efeito",
        });
      }

      const [existing] = await tx
        .select({ id: videoTransactions.id, balanceAfter: videoTransactions.balanceAfter })
        .from(videoTransactions)
        .where(and(
          eq(videoTransactions.clerkUserId, authReq.clerkUserId),
          eq(videoTransactions.description, description),
        ))
        .limit(1);
      if (existing) return { alreadyCharged: true, newBalance: existing.balanceAfter };

      const lockedResult = await tx.execute(
        sql`SELECT video_balance FROM users WHERE clerk_id = ${authReq.clerkUserId} FOR UPDATE`,
      );
      const locked = lockedResult.rows[0] as { video_balance?: unknown } | undefined;
      if (!locked) return { error: "user_not_found" as const };
      const balanceBefore = Number(locked.video_balance ?? 0);
      if (balanceBefore <= 0) return { error: "insufficient_video_balance" as const, balance: 0 };

      const newBalance = balanceBefore - 1;
      await tx
        .update(users)
        .set({ videoBalance: newBalance, updatedAt: new Date() })
        .where(eq(users.clerkId, authReq.clerkUserId));
      await tx.insert(videoTransactions).values({
        clerkUserId: authReq.clerkUserId,
        amount: -1,
        type: "use",
        description,
        balanceBefore,
        balanceAfter: newBalance,
      });
      await tx.insert(creditsTransactions).values({
        clerkUserId: authReq.clerkUserId,
        amount: -1,
        type: "debit",
        balanceType: "video",
        description,
        balanceBefore,
        balanceAfter: newBalance,
      });
      return { alreadyCharged: false, newBalance };
    });

    if ("error" in charged) {
      const status = charged.error === "user_not_found" ? 404 : 402;
      res.status(status).json({ error: charged.error, balance: "balance" in charged ? charged.balance : undefined });
      return;
    }

    res.json({ ...result, videoCharged: !charged.alreadyCharged, newVideoBalance: charged.newBalance });
  } catch (error) {
    req.log.error({ err: error }, "commercial image-motion result failed");
    providerError(res, error, "Não foi possível recuperar o vídeo gerado.");
  }
});

export default router;