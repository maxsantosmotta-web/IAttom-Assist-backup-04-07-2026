/**
 * HeyGen API Client — BLOCO 2B
 * Engine: Avatar IV (padrão — compatível com avatares stock Brandon e Caroline)
 * Endpoint: v3 (único com suporte a avatares modernos)
 *
 * Modo seguro: HEYGEN_CONFIGURED = false → pipeline opera em mock sem erros.
 *
 * Variáveis necessárias para ativar modo real:
 *   HEYGEN_API_KEY           — API key do dashboard HeyGen
 *   HEYGEN_AVATAR_MALE_ID    — avatar_id masculino (GET /v3/avatars/looks)
 *   HEYGEN_AVATAR_FEMALE_ID  — avatar_id feminino  (GET /v3/avatars/looks)
 *   HEYGEN_VOICE_MALE_ID     — voice_id PT-BR masculino (GET /v3/voices)
 *   HEYGEN_VOICE_FEMALE_ID   — voice_id PT-BR feminino  (GET /v3/voices)
 */

import { logger } from "./logger.js";

const HEYGEN_BASE_URL = "https://api.heygen.com";

export const HEYGEN_CONFIGURED =
  !!process.env.HEYGEN_API_KEY &&
  !!process.env.HEYGEN_AVATAR_MALE_ID &&
  !!process.env.HEYGEN_AVATAR_FEMALE_ID &&
  !!process.env.HEYGEN_VOICE_MALE_ID &&
  !!process.env.HEYGEN_VOICE_FEMALE_ID;

export const AVATAR_IDS: Record<"masculino" | "feminino", string> = {
  masculino: process.env.HEYGEN_AVATAR_MALE_ID ?? "",
  feminino:  process.env.HEYGEN_AVATAR_FEMALE_ID ?? "",
};

export const VOICE_IDS: Record<"masculino" | "feminino", string> = {
  masculino: process.env.HEYGEN_VOICE_MALE_ID ?? "",
  feminino:  process.env.HEYGEN_VOICE_FEMALE_ID ?? "",
};

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface HeyGenVideoPayload {
  avatarId: string;
  voiceId: string;
  script: string;
  /** Hex color (ex: "#1c2333") ou URL pública de imagem sem query params */
  background: string;
}

export interface HeyGenVideoStatus {
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}

// ─── Helper: extrai mensagem legível do erro HeyGen ──────────────────────────

function extractHeygenError(body: Record<string, unknown>): string {
  if (body.error && typeof body.error === "object") {
    const e = body.error as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.detail === "string") return e.detail;
  }
  if (typeof body.message === "string") return body.message;
  if (typeof body.detail === "string") return body.detail;
  return "Erro desconhecido da API HeyGen.";
}

// ─── Geração de vídeo (v3 — Avatar IV padrão) ────────────────────────────────
//
// Estrutura confirmada pela documentação oficial HeyGen v3:
//   - background: { type: "color", value: "#hex" } para cor sólida
//   - background: { type: "image", url: "..." } para imagem
//   - aspect_ratio: "16:9"
//   - resolution: "1080p"
//   - engine omitido → usa Avatar IV por padrão (compatível com avatares stock)
//   - Avatar V exige Digital Twin — não usar com avatares de biblioteca

export async function generateVideo(payload: HeyGenVideoPayload): Promise<{ videoId: string }> {
  const apiKey = process.env.HEYGEN_API_KEY!;

  const isColor = payload.background.startsWith("#");

  const body: Record<string, unknown> = {
    type: "avatar",
    avatar_id: payload.avatarId,
    script: payload.script,
    voice_id: payload.voiceId,
    aspect_ratio: "16:9",
    resolution: "1080p",
    background: isColor
      ? { type: "color", value: payload.background }
      : { type: "image", url: payload.background },
  };

  logger.info(
    {
      avatarId: payload.avatarId,
      voiceId: payload.voiceId,
      scriptLength: payload.script.length,
      background: isColor ? "color" : "image",
    },
    "[heygenClient] enviando requisição de geração",
  );

  const res = await fetch(`${HEYGEN_BASE_URL}/v3/videos`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
    const humanMsg = extractHeygenError(errBody);
    logger.error(
      { status: res.status, errBody },
      "[heygenClient] erro na criação do vídeo",
    );
    throw new Error(`Erro HeyGen (${res.status}): ${humanMsg}`);
  }

  const data = await res.json() as {
    data?: { video_id?: string; id?: string };
    video_id?: string;
  };

  const videoId =
    data.data?.video_id ??
    data.data?.id ??
    data.video_id ??
    "";

  if (!videoId) {
    logger.error({ data }, "[heygenClient] resposta sem video_id");
    throw new Error("HeyGen não retornou um video_id válido.");
  }

  logger.info({ videoId }, "[heygenClient] vídeo criado com sucesso");
  return { videoId };
}

// ─── Status do vídeo (v3) ────────────────────────────────────────────────────
//
// GET /v3/videos/{video_id}
// Resposta: { data: { id, status, video_url, failure_message, failure_code } }

export async function getVideoStatus(videoId: string): Promise<HeyGenVideoStatus> {
  const apiKey = process.env.HEYGEN_API_KEY!;

  const res = await fetch(
    `${HEYGEN_BASE_URL}/v3/videos/${encodeURIComponent(videoId)}`,
    { headers: { "X-Api-Key": apiKey } },
  );

  if (!res.ok) {
    throw new Error(`HeyGen status ${res.status} para video_id ${videoId}`);
  }

  const data = await res.json() as {
    data?: {
      status?: string;
      video_url?: string;
      failure_message?: string;
      failure_code?: string;
      error?: string;
    };
  };

  const d = data.data ?? {};
  return {
    status: (d.status ?? "pending") as HeyGenVideoStatus["status"],
    videoUrl: d.video_url,
    error: d.failure_message ?? d.error,
  };
}

// ─── Polling até conclusão ───────────────────────────────────────────────────

export async function pollUntilDone(
  videoId: string,
  onProgress: (status: string) => void,
  maxAttempts = 60,
  intervalMs = 3_000,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusData = await getVideoStatus(videoId);

    if (statusData.status === "completed" && statusData.videoUrl) {
      logger.info({ videoId, attempt }, "[heygenClient] vídeo concluído");
      return statusData.videoUrl;
    }

    if (statusData.status === "failed") {
      const reason = statusData.error ?? "Falha na geração do vídeo.";
      logger.error({ videoId, reason }, "[heygenClient] vídeo falhou");
      throw new Error(reason);
    }

    onProgress(statusData.status);
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    "Tempo esgotado na geração do vídeo. Seus créditos serão devolvidos automaticamente.",
  );
}
