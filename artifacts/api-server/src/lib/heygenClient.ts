/**
 * HeyGen API Client — IAttom Assist
 *
 * Endpoint: POST /v3/videos — payload obrigatório: video_inputs + dimension
 *
 * Modo seguro: HEYGEN_CONFIGURED = false → pipeline opera em mock sem erros.
 *
 * Variáveis para ativar modo real:
 *   HEYGEN_API_KEY           — API key do dashboard HeyGen
 *   HEYGEN_VOICE_MALE_ID     — voice_id PT-BR masculino (GET /v3/voices)
 *   HEYGEN_VOICE_FEMALE_ID   — voice_id PT-BR feminino  (GET /v3/voices)
 *
 * Avatares padrão (confirmados via v2/avatars na conta ativa):
 *   masculino → Marcus_expressive_2024120201 (Marcus Upper Body)
 *   feminino  → candace_expressive_20240910  (Candace in Pink Blazer Upper Body)
 */

import { logger } from "./logger.js";

const HEYGEN_BASE_URL = "https://api.heygen.com";

export const HEYGEN_CONFIGURED =
  !!process.env.HEYGEN_API_KEY &&
  !!process.env.HEYGEN_VOICE_MALE_ID &&
  !!process.env.HEYGEN_VOICE_FEMALE_ID;

// ─── Biblioteca Oficial de Avatares IAttom ────────────────────────────────────
//
// Todos os avatar_ids abaixo foram confirmados via API HeyGen v2/avatars.
// São avatares stock públicos (premium: false), compatíveis com engine Avatar IV.
//
// Estrutura:
//   estilo     — executivo | consultor | criador
//   genero     — masculino | feminino
//   avatar_id  — ID real confirmado na API HeyGen
//   nome       — nome do personagem
//   categoria  — rótulo da biblioteca IAttom
//   nativo916  — true quando a variante foi filmada em portrait (sem letterbox em 9:16)
//
// NOTA sobre 9:16:
//   avatares com nativo916 = false ainda funcionam em 9:16 via API — o HeyGen
//   centraliza o avatar e preenche laterais com a cor/imagem de fundo configurada.
//   Para 9:16 totalmente nativo sem padding, use Annie ou Judith.

export interface OfficialAvatar {
  estilo: "executivo" | "consultor" | "criador";
  genero: "masculino" | "feminino";
  avatarId: string;
  nome: string;
  categoria: string;
  nativo916: boolean;
}

export const OFFICIAL_AVATAR_CATALOG: OfficialAvatar[] = [
  {
    estilo:    "executivo",
    genero:    "masculino",
    avatarId:  "Armando_Suit_Front_public",
    nome:      "Armando",
    categoria: "Executivo Masculino",
    nativo916: false,
  },
  {
    estilo:    "consultor",
    genero:    "masculino",
    avatarId:  "Colin_Business_Front_public",
    nome:      "Colin",
    categoria: "Consultor Masculino",
    nativo916: false,
  },
  {
    estilo:    "criador",
    genero:    "masculino",
    avatarId:  "August_Cool_Style_public",
    nome:      "August",
    categoria: "Criador Masculino",
    nativo916: false,
  },
  {
    estilo:    "executivo",
    genero:    "feminino",
    avatarId:  "Annie_expressive_public",
    nome:      "Annie",
    categoria: "Executiva Feminina",
    nativo916: true,
  },
  {
    estilo:    "consultor",
    genero:    "feminino",
    avatarId:  "Imelda_Business_Front_public",
    nome:      "Imelda",
    categoria: "Consultora Feminina",
    nativo916: false,
  },
  {
    estilo:    "criador",
    genero:    "feminino",
    avatarId:  "Judith_expressive_2024120201",
    nome:      "Judith",
    categoria: "Criadora Feminina",
    nativo916: true,
  },
];

// ─── Seleção por estilo + gênero ─────────────────────────────────────────────
//
// Retorna o avatar_id oficial para a combinação estilo × gênero.
// Preparado para futura seleção manual no módulo de vídeo.
// Fallback: avatar padrão do gênero quando a combinação não for encontrada.

export function getOfficialAvatarId(
  estilo: "executivo" | "consultor" | "criador",
  genero: "masculino" | "feminino",
): string {
  const found = OFFICIAL_AVATAR_CATALOG.find(
    (a) => a.estilo === estilo && a.genero === genero,
  );
  if (found) return found.avatarId;

  // Fallback por gênero caso a combinação não exista no catálogo
  const fallback = OFFICIAL_AVATAR_CATALOG.find((a) => a.genero === genero);
  return fallback?.avatarId ?? OFFICIAL_AVATAR_CATALOG[0].avatarId;
}

// ─── Mapeamento: gênero → avatar_id ──────────────────────────────────────────
//
// Avatares confirmados via GET /v2/avatars na conta ativa.
// IDs são do tipo "expressive upper body" — compatíveis com POST /v3/videos.
//
//   masculino → Marcus_expressive_2024120201   (Marcus Upper Body)
//   feminino  → candace_expressive_20240910    (Candace in Pink Blazer Upper Body)

const DEFAULT_AVATAR_MALE   = "Marcus_expressive_2024120201";  // Marcus — Upper Body Masculino
const DEFAULT_AVATAR_FEMALE = "candace_expressive_20240910";   // Candace — Upper Body Feminino

export const AVATAR_IDS: Record<"masculino" | "feminino", string> = {
  masculino: DEFAULT_AVATAR_MALE,
  feminino:  DEFAULT_AVATAR_FEMALE,
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
  /** Aspect ratio do vídeo: "16:9" | "1:1" | "9:16" */
  aspectRatio?: string;
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

// ─── Dimensões por aspect ratio ──────────────────────────────────────────────

function dimensionForAspect(aspectRatio: string): { width: number; height: number } {
  if (aspectRatio === "9:16") return { width: 1080, height: 1920 };
  if (aspectRatio === "1:1")  return { width: 1080, height: 1080 };
  return { width: 1920, height: 1080 }; // 16:9 default
}

// ─── Geração de vídeo (POST /v3/videos) ──────────────────────────────────────
//
// Payload flat — "type" na raiz, sem video_inputs/character/dimension:
//
//   {
//     "type":         "avatar",
//     "avatar_id":    "...",
//     "script":       "...",
//     "voice_id":     "...",
//     "aspect_ratio": "16:9" | "9:16" | "1:1",
//     "resolution":   "1080p",
//     "background":   { "type": "color", "value": "#hex" }
//   }

export async function generateVideo(payload: HeyGenVideoPayload): Promise<{ videoId: string }> {
  const apiKey = process.env.HEYGEN_API_KEY!;

  const aspectRatio = payload.aspectRatio ?? "16:9";

  const background = { type: "color", value: "#111111" };

  const body = {
    type:         "avatar",
    avatar_id:    payload.avatarId,
    script:       payload.script,
    voice_id:     payload.voiceId,
    aspect_ratio: aspectRatio,
    resolution:   "1080p",
    background,
  };

  // Log temporário para diagnóstico
  console.log("[HEYGEN_FINAL_PAYLOAD]", JSON.stringify(body, null, 2));

  logger.info(
    {
      HEYGEN_FINAL_PAYLOAD: {
        avatar_id:        payload.avatarId,
        voice_id:         payload.voiceId,
        aspect_ratio:     aspectRatio,
        background_type:  "color",
        background_value: "#111111",
        script_length:    payload.script.length,
        script_preview:   payload.script.slice(0, 60),
      },
    },
    "[heygenClient] HEYGEN_FINAL_PAYLOAD enviado para v3/videos",
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

  logger.info({ videoId, aspectRatio, avatarId: payload.avatarId }, "[heygenClient] vídeo criado com sucesso");
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
      width?: number;
      height?: number;
    };
  };

  const d = data.data ?? {};

  // Log dimensões reais quando disponíveis (útil para diagnóstico de 9:16)
  if (d.status === "completed" && (d.width ?? d.height)) {
    logger.info(
      { videoId, width: d.width, height: d.height, videoUrl: d.video_url?.slice(0, 80) },
      "[heygenClient] dimensões reais do vídeo gerado",
    );
  }

  return {
    status: (d.status ?? "pending") as HeyGenVideoStatus["status"],
    videoUrl: d.video_url,
    error: d.failure_message ?? d.error,
  };
}

// ─── Polling até conclusão ────────────────────────────────────────────────────

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
