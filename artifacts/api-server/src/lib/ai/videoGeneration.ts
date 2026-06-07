/**
 * Pipeline de Geração de Vídeo — BLOCO 2A
 *
 * Hierarquia obrigatória (imutável):
 *   Prompt do Usuário → Motor de Interpretação → Roteiro Interno → Vídeo Final
 *
 * O prompt do usuário é a fonte principal e nunca pode ser substituído.
 * O Motor de Interpretação organiza, estrutura e refina — nunca transforma o assunto central.
 *
 * Se HEYGEN_CONFIGURED = false → opera em modo mock (sem consumir créditos HeyGen).
 */

import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";
import { logAiUsage } from "./logger.js";
import { logger } from "../logger.js";
import { buildRefinedContext } from "./interpretationEngine.js";
import {
  HEYGEN_CONFIGURED,
  AVATAR_IDS,
  VOICE_IDS,
  generateVideo,
  pollUntilDone,
} from "../heygenClient.js";

// ─── Input / Output ──────────────────────────────────────────────────────────

export interface VideoGenerationInput {
  videoType: "executivo" | "casual";
  videoAvatar: "masculino" | "feminino";
  videoAmbiente: string;
  videoPrompt: string;
}

export interface VideoGenerationResult {
  videoUrl: string;
  durationSeconds: number;
  videoType: "executivo" | "casual";
  videoAvatar: "masculino" | "feminino";
  videoAmbiente: string;
  prompt: string;
  generatedAt: string;
  isMock: boolean;
}

// ─── Backgrounds por ambiente ────────────────────────────────────────────────
// BLOCO 2B: substituir hex colors por URLs de imagem reais para cada ambiente.
// Requisito HeyGen: URLs públicas, estáticas, sem query params.

const SCENE_BACKGROUNDS: Record<string, string> = {
  executivo:   "#1c2333",
  loja:        "#2a1f1a",
  shopping:    "#1a1f2a",
  restaurante: "#2a1a0f",
  rua:         "#0f1f0f",
  casa:        "#1f1a1f",
  livre:       "#111111",
};

function resolveBackground(videoType: "executivo" | "casual", ambiente: string): string {
  if (videoType === "executivo") return SCENE_BACKGROUNDS.executivo;
  return SCENE_BACKGROUNDS[ambiente.toLowerCase()] ?? SCENE_BACKGROUNDS.livre;
}

// ─── Roteiro interno via GPT ─────────────────────────────────────────────────

async function buildVideoScript(
  params: VideoGenerationInput,
  signal?: AbortSignal,
): Promise<string> {
  const prompt = params.videoPrompt.trim();

  // Motor de Interpretação: estrutura o contexto sem substituir o assunto
  const refinedCtx = buildRefinedContext(prompt, `video_${params.videoType}`);

  const cenarioDesc =
    params.videoType === "executivo"
      ? "escritório corporativo com mesa, notebook, ambiente profissional e postura executiva"
      : params.videoAmbiente === "livre"
      ? `cenário natural sugerido pelo contexto do produto ou tema: ${prompt}`
      : `ambiente de ${params.videoAmbiente}`;

  const personagemDesc =
    params.videoAvatar === "masculino"
      ? "apresentador masculino com boa aparência e postura confiante"
      : "apresentadora feminina com boa aparência e postura confiante";

  const systemPrompt = `Você é especialista em roteiros de vídeos de marketing e vendas em português do Brasil.

REGRA ABSOLUTA — HIERARQUIA DE CONTEÚDO:
O assunto central do vídeo DEVE ser exatamente o produto ou tema informado pelo usuário.
Nenhuma instrução interna, nenhum contexto de especialista e nenhuma regra de estilo pode substituir ou reduzir a importância do assunto principal.
Se o usuário informou "Scooter elétrica", o vídeo é sobre Scooter elétrica — não sobre mobilidade genérica, não sobre tecnologia, não sobre outro produto.
O prompt do usuário SEMPRE vence sobre qualquer instrução interna.

CONTEXTO DO MOTOR DE INTERPRETAÇÃO (apoio estrutural — não substitui o assunto):
${refinedCtx.systemEnhancement}

PARÂMETROS DO VÍDEO:
- Personagem: ${personagemDesc}
- Cenário: ${cenarioDesc}
- Duração: 20 segundos de fala (50 a 60 palavras)
- Idioma: português do Brasil natural e fluente
- Tom: direto, envolvente, humano — sem sotaque artificial de TTS
- Estrutura: gancho impactante (3-4s) → benefício principal do produto (12s) → chamada para ação clara (5-6s)

REGRAS DE FORMATO:
- Retornar APENAS o texto que o personagem irá falar
- Sem títulos, introduções, explicações, tópicos ou marcadores
- Sem menção a câmera, edição, duração ou produção
- Fala contínua, natural, como uma pessoa falando de verdade`;

  const userPrompt = `Crie o roteiro de 20 segundos para o seguinte produto ou tema:

"${prompt}"

${refinedCtx.userEnhancement}

REGRA FINAL: "${prompt}" é o protagonista absoluto. O roteiro não pode desviar para outro assunto.
Retorne apenas o texto da fala em português do Brasil.`;

  const stream = await openai.chat.completions.create(
    {
      model: "gpt-5-mini",
      max_completion_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    },
    { signal },
  );

  let script = "";
  let chunkCount = 0;
  for await (const chunk of stream) {
    chunkCount++;
    const content = chunk.choices[0]?.delta?.content;
    if (content) script += content;
  }

  logger.info(
    { chunkCount, scriptLength: script.length, scriptPreview: script.slice(0, 80) },
    "[videoGeneration:diag] script collected",
  );

  if (!script.trim()) throw new Error("Não foi possível gerar o roteiro interno.");
  return script.trim();
}

// ─── Mock ────────────────────────────────────────────────────────────────────

function buildMockResult(params: VideoGenerationInput): VideoGenerationResult {
  return {
    videoUrl: "",
    durationSeconds: 20,
    videoType: params.videoType,
    videoAvatar: params.videoAvatar,
    videoAmbiente:
      params.videoType === "executivo" ? "executivo" : params.videoAmbiente,
    prompt: params.videoPrompt.trim(),
    generatedAt: new Date().toISOString(),
    isMock: true,
  };
}

// ─── Pipeline principal (SSE) ────────────────────────────────────────────────

export async function streamVideoGeneration(
  params: VideoGenerationInput,
  res: Response,
  clerkUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  // Timeout estendido: geração HeyGen pode levar 1-3 minutos
  const socket = (
    res as unknown as { socket?: { setTimeout: (ms: number) => void } }
  ).socket;
  socket?.setTimeout(300_000);

  setupSSE(res);
  sendSSE(res, { type: "start" });

  const prompt = params.videoPrompt.trim();
  if (!prompt) {
    sendSSEError(res, "O prompt é obrigatório para gerar o vídeo.");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    logger.info(
      {
        videoType: params.videoType,
        videoAvatar: params.videoAvatar,
        videoAmbiente: params.videoAmbiente,
        heygenConfigured: HEYGEN_CONFIGURED,
      },
      "[videoGeneration] iniciando pipeline",
    );
  }

  try {
    // Passo 1: Roteiro interno via GPT + Motor de Interpretação
    sendSSE(res, { type: "progress", message: "Preparando roteiro..." });
    const script = await buildVideoScript(params, signal);

    if (process.env.NODE_ENV !== "production") {
      logger.info({ words: script.split(" ").length }, "[videoGeneration] roteiro gerado");
    }

    // ── Modo mock (sem HEYGEN_API_KEY configurada) ───────────────────────────
    if (!HEYGEN_CONFIGURED) {
      sendSSE(res, { type: "progress", message: "Preparando personagem..." });
      await new Promise<void>((r) => setTimeout(r, 700));
      sendSSE(res, { type: "progress", message: "Preparando vídeo..." });
      await new Promise<void>((r) => setTimeout(r, 900));
      sendSSE(res, { type: "progress", message: "Aguardando processamento..." });
      await new Promise<void>((r) => setTimeout(r, 600));

      const mockResult = buildMockResult(params);
      sendSSE(res, { type: "result", data: mockResult });
      await logAiUsage({
        clerkUserId,
        action: `Vídeo mock: ${prompt.slice(0, 50)} (${params.videoType}, ${params.videoAvatar})`,
        module: "creative",
      });
      sendSSEDone(res);
      return;
    }

    // ── Modo real via HeyGen (BLOCO 2B) ─────────────────────────────────────
    sendSSE(res, { type: "progress", message: "Preparando personagem..." });

    const avatarId = AVATAR_IDS[params.videoAvatar];
    const voiceId = VOICE_IDS[params.videoAvatar];
    const background = resolveBackground(params.videoType, params.videoAmbiente);

    if (!avatarId || !voiceId) {
      sendSSEError(res, "Configuração de avatar incompleta. Entre em contato com o suporte.");
      return;
    }

    sendSSE(res, { type: "progress", message: "Preparando vídeo..." });
    const { videoId } = await generateVideo({ avatarId, voiceId, script, background });

    sendSSE(res, { type: "progress", message: "Aguardando processamento..." });
    const videoUrl = await pollUntilDone(
      videoId,
      () => sendSSE(res, { type: "progress", message: "Processando vídeo..." }),
      60,
      3_000,
    );

    const finalResult: VideoGenerationResult = {
      videoUrl,
      durationSeconds: 20,
      videoType: params.videoType,
      videoAvatar: params.videoAvatar,
      videoAmbiente:
        params.videoType === "executivo" ? "executivo" : params.videoAmbiente,
      prompt,
      generatedAt: new Date().toISOString(),
      isMock: false,
    };

    sendSSE(res, { type: "result", data: finalResult });
    await logAiUsage({
      clerkUserId,
      action: `Vídeo gerado: ${prompt.slice(0, 50)} (${params.videoType}, ${params.videoAvatar})`,
      module: "creative",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      res.end();
      return;
    }
    logger.error(
      {
        errName: err instanceof Error ? err.name : typeof err,
        errMsg: err instanceof Error ? err.message : String(err),
        errStack: err instanceof Error ? err.stack?.slice(0, 400) : undefined,
      },
      "[videoGeneration:diag] pipeline error",
    );
    const msg =
      err instanceof Error
        ? err.message
        : "Erro inesperado na geração de vídeo. Seus créditos serão devolvidos automaticamente.";
    sendSSEError(res, msg);
    return;
  }

  sendSSEDone(res);
}
