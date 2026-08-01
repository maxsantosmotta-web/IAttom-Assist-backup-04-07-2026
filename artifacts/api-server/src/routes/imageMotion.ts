import { Router, type IRouter, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
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

function decodeImageDataUrl(value: unknown): { dataUrl: string; bytes: number } | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/(?:png|jpe?g));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  const encoded = match[2] ?? "";
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((encoded.length * 3) / 4) - padding;
  return { dataUrl: value, bytes };
}

async function requireAdminTestAccess(req: AuthenticatedRequest): Promise<boolean> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.clerkId, req.clerkUserId));
  return user?.role === "admin";
}

function adminTestError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  return message || fallback;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || /timeout|timed out|tempo de espera/i.test(error.message);
}

function sendImageMotionError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof FalProviderError) {
    if (error.status === 429) {
      if (error.retryAfterSeconds) res.setHeader("Retry-After", String(error.retryAfterSeconds));
      res.status(429).json({ error: adminTestError(error, "O serviço está temporariamente ocupado. Tente novamente em instantes.") });
      return;
    }
    if (error.status === 408 || error.status === 504) {
      res.status(504).json({ error: adminTestError(error, "O provedor demorou para responder. Tente novamente em instantes.") });
      return;
    }
    res.status(502).json({ error: adminTestError(error, fallback) });
    return;
  }

  if (isTimeoutError(error)) {
    res.status(504).json({ error: "O provedor demorou para responder. Tente novamente em instantes." });
    return;
  }

  res.status(502).json({ error: adminTestError(error, fallback) });
}

router.post("/image-motion/submit", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  if (!(await requireAdminTestAccess(authReq))) {
    res.status(403).json({ error: "Fluxo disponível apenas para teste administrativo." });
    return;
  }

  const image = decodeImageDataUrl((req.body as { imageDataUrl?: unknown }).imageDataUrl);
  if (!image) {
    res.status(400).json({ error: "Envie uma imagem PNG, JPG ou JPEG válida." });
    return;
  }
  if (image.bytes > MAX_IMAGE_BYTES) {
    res.status(413).json({ error: "A imagem deve ter no máximo 8 MB." });
    return;
  }

  const rawPrompt = (req.body as { prompt?: unknown }).prompt;
  if (typeof rawPrompt !== "string" || !rawPrompt.trim()) {
    res.status(400).json({ error: "Descreva o efeito em movimento desejado." });
    return;
  }
  const prompt = rawPrompt.trim();
  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ error: `A descrição deve ter no máximo ${MAX_PROMPT_LENGTH} caracteres.` });
    return;
  }

  const rawFormat = (req.body as { format?: unknown }).format;
  if (rawFormat !== "vertical" && rawFormat !== "horizontal" && rawFormat !== "automatic") {
    res.status(400).json({ error: "Formato inválido. Escolha Vertical, Horizontal ou Automático." });
    return;
  }
  const format = rawFormat as ImageMotionFormat;

  try {
    const submission = await submitImageMotion({
      imageDataUrl: image.dataUrl,
      prompt,
      format,
      duration: "6s",
    });
    res.status(202).json({ requestId: submission.requestId, duration: 6, format });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    req.log.error({ err: error }, "image-motion submit failed");
    if (message === "FAL_KEY_NOT_CONFIGURED") {
      res.status(503).json({ error: "A chave da nova IA ainda não foi configurada no servidor." });
      return;
    }
    sendImageMotionError(res, error, "Não foi possível enviar a imagem para processamento.");
  }
});

router.get("/image-motion/status/:requestId", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  if (!(await requireAdminTestAccess(authReq))) {
    res.status(403).json({ error: "Fluxo disponível apenas para teste administrativo." });
    return;
  }

  try {
    const status = await getImageMotionStatus(String(req.params.requestId ?? ""));
    res.json(status);
  } catch (error) {
    req.log.error({ err: error }, "image-motion status failed");
    sendImageMotionError(res, error, "Não foi possível consultar o processamento.");
  }
});

router.get("/image-motion/result/:requestId", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  if (!(await requireAdminTestAccess(authReq))) {
    res.status(403).json({ error: "Fluxo disponível apenas para teste administrativo." });
    return;
  }

  try {
    const result = await getImageMotionResult(String(req.params.requestId ?? ""));
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "image-motion result failed");
    sendImageMotionError(res, error, "Não foi possível recuperar o vídeo gerado.");
  }
});

export default router;