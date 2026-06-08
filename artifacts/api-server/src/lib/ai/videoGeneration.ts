/**
 * Pipeline de Geração de Vídeo — BLOCO 2B
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
import {
  HEYGEN_CONFIGURED,
  AVATAR_IDS,
  VOICE_IDS,
  getOfficialAvatarId,
  generateVideo,
  pollUntilDone,
} from "../heygenClient.js";

// ─── Input / Output ──────────────────────────────────────────────────────────

export interface VideoGenerationInput {
  videoEstilo: "executivo" | "consultor" | "criador";
  videoAvatar: "masculino" | "feminino";
  videoAmbiente: string;
  videoFormato: "9:16" | "1:1" | "16:9";
  videoDuration: 20 | 40 | 60;
  videoPrompt: string;
}

export interface VideoGenerationResult {
  videoUrl: string;
  durationSeconds: number;
  videoEstilo: "executivo" | "consultor" | "criador";
  videoAvatar: "masculino" | "feminino";
  videoAmbiente: string;
  videoFormato: "9:16" | "1:1" | "16:9";
  prompt: string;
  generatedAt: string;
  isMock: boolean;
}

// ─── Backgrounds reais por ambiente ─────────────────────────────────────────
//
// Imagens de fundo via Unsplash CDN (sem autenticação — CDN público).
// Formato adaptado ao aspect ratio do vídeo para evitar distorção.
// Fallback: cor sólida escura (#111111) se o ambiente não for mapeado.

function resolveBackground(ambiente: string, aspectRatio: string): string {
  // Dimensões por aspect ratio
  let w = "1920", h = "1080";
  if (aspectRatio === "9:16") { w = "1080"; h = "1920"; }
  if (aspectRatio === "1:1")  { w = "1080"; h = "1080"; }

  const photoIds: Record<string, string> = {
    corporativo:  "photo-1497366216548-37526070297c", // modern office open space
    casa:         "photo-1586023492125-27b2c045efd7", // bright modern living room
    loja:         "photo-1441986300917-64674bd600d8", // retail clothing store interior
    shopping:     "photo-1555529902-5261145633bf",    // shopping mall concourse
    restaurante:  "photo-1517248135467-4c7edcad34c4", // restaurant ambient dining
    rua:          "photo-1477959858617-67f85cf4f1df",  // city street urban bokeh
    praia:        "photo-1507525428034-b723cf961d3e",  // tropical beach turquoise
    parque:       "photo-1500534314209-a25ddb2bd429",  // green park pathway trees
    veiculo:      "photo-1485291571150-772bcfc10da5",  // car interior dashboard
    consultorio:  "photo-1576091160399-112ba8d25d1d",  // clean medical clinic
    estudio:      "photo-1478737270239-2f02b77fc618",  // podcast radio studio
  };

  const photoId = photoIds[ambiente.toLowerCase()];
  if (!photoId) return "#111111";

  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

// ─── Contexto do ambiente para o roteiro ─────────────────────────────────────

function ambienteContexto(ambiente: string): string {
  const ctx: Record<string, string> = {
    corporativo:  "escritório corporativo moderno",
    casa:         "ambiente doméstico, tom acolhedor e próximo",
    loja:         "loja física, clima de atendimento e varejo",
    shopping:     "shopping center, contexto de consumo e movimento",
    restaurante:  "restaurante, ambiente de gastronomia e hospitalidade",
    rua:          "ambiente externo urbano, tom dinâmico e real",
    praia:        "ambiente praiano, clima leve e descontraído",
    parque:       "espaço ao ar livre, tom tranquilo e saudável",
    veiculo:      "dentro de um veículo em movimento, tom prático e direto",
    consultorio:  "consultório profissional, tom técnico e confiável",
    estudio:      "estúdio de gravação ou podcast, tom especialista",
  };
  return ctx[ambiente.toLowerCase()] ?? "ambiente profissional";
}

// ─── Formato → aspect ratio ──────────────────────────────────────────────────

const FORMATO_TO_ASPECT: Record<string, string> = {
  "9:16": "9:16",
  "1:1":  "1:1",
  "16:9": "16:9",
};

// ─── Palavras por segundo (estimativa TTS PT-BR) ──────────────────────────────

function wordsForDuration(seconds: number): { min: number; max: number } {
  const base = Math.round(seconds * 2.5);
  return { min: Math.round(base * 0.85), max: Math.round(base * 1.1) };
}

// ─── Descritores por estilo ──────────────────────────────────────────────────

function estiloDescriptor(estilo: "executivo" | "consultor" | "criador"): {
  tom: string;
  abertura: string;
  cta: string;
} {
  switch (estilo) {
    case "executivo":
      return {
        tom: "direto, confiante e profissional — fala com autoridade sem ser arrogante",
        abertura: "começa com uma afirmação forte ou uma pergunta que gera reflexão imediata",
        cta: "termina com uma chamada para ação clara e direta",
      };
    case "consultor":
      return {
        tom: "empático e explicativo — fala como quem orienta e resolve, com calma e clareza",
        abertura: "abre identificando um problema real que o espectador reconhece na própria vida",
        cta: "termina convidando a dar o próximo passo, com segurança e sem pressão",
      };
    case "criador":
      return {
        tom: "próximo, autêntico e entusiasmado — fala como numa conversa real com o espectador",
        abertura: "abre de forma surpreendente, engraçada ou curiosa — algo que faz parar o scroll",
        cta: "termina de forma natural e animada, sem soar forçado",
      };
  }
  const _: never = estilo;
  return _;
}

// ─── Helper: uma tentativa de geração via OpenAI (streaming) ─────────────────

interface ScriptAttemptResult {
  script: string;
  refusal: string | null;
  finishReason: string | null;
  chunkCount: number;
}

async function attemptScriptGeneration(
  messages: { role: "system" | "user"; content: string }[],
  signal?: AbortSignal,
): Promise<ScriptAttemptResult> {
  const stream = await openai.chat.completions.create(
    {
      model: "gpt-5-mini",
      max_completion_tokens: 1500,
      messages,
      stream: true,
    },
    { signal },
  );

  let script = "";
  let refusal: string | null = null;
  let finishReason: string | null = null;
  let chunkCount = 0;

  for await (const chunk of stream) {
    chunkCount++;
    const delta = chunk.choices[0]?.delta as {
      content?: string | null;
      refusal?: string | null;
    } | undefined;
    const fr = chunk.choices[0]?.finish_reason;
    if (fr) finishReason = fr;
    if (delta?.content) script += delta.content;
    if (delta?.refusal) refusal = (refusal ?? "") + delta.refusal;
  }

  return { script: script.trim(), refusal, finishReason, chunkCount };
}

// ─── Roteiro interno via GPT (com retry automático) ──────────────────────────

async function buildVideoScript(
  params: VideoGenerationInput,
  signal?: AbortSignal,
): Promise<string> {
  const prompt = params.videoPrompt.trim();
  const { min: minWords, max: maxWords } = wordsForDuration(params.videoDuration);
  const { tom, abertura, cta } = estiloDescriptor(params.videoEstilo);
  const ambiente = ambienteContexto(params.videoAmbiente);

  // ── Tentativa 1: prompt completo e contextualizado ───────────────────────
  const systemPrompt = `Você escreve roteiros de vídeos de marketing em português do Brasil.

TAREFA: escrever apenas o texto que o personagem fala. Nada mais. Sem títulos, sem numeração, sem marcações.

ESTILO DO PERSONAGEM:
Tom: ${tom}
Como abrir: ${abertura}
Como fechar: ${cta}

AMBIENTE DO VÍDEO: ${ambiente}
O personagem está num ${ambiente}. A linguagem e o clima devem combinar com esse contexto.

DURAÇÃO: ${params.videoDuration} segundos → entre ${minWords} e ${maxWords} palavras

REGRAS DE ESCRITA PARA VOZ NATURAL:
- Frases curtas. Máximo 10 palavras por frase.
- Pausas com vírgulas e reticências — o personagem respira.
- Sem listas. Sem bullet points. Fala contínua.
- Voz ativa. "Você resolve" — nunca "é possível resolver".
- Linguagem acessível. Sem jargão técnico desnecessário.
- Sem mencionar câmera, duração, edição, gravação ou roteiro.
- O personagem não lê um texto — ele fala de verdade.

RETORNAR: somente o texto da fala. Em português. Nada mais.`;

  const userPrompt = `Sobre o que falar: "${prompt}"

Escreva o roteiro de ${params.videoDuration} segundos.
Entre ${minWords} e ${maxWords} palavras. Apenas a fala, sem nenhum outro texto.`;

  const attempt1 = await attemptScriptGeneration(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    signal,
  );

  logger.info(
    {
      attempt: 1,
      chunkCount: attempt1.chunkCount,
      scriptLength: attempt1.script.length,
      scriptPreview: attempt1.script.slice(0, 100),
      refusal: attempt1.refusal,
      finishReason: attempt1.finishReason,
      estilo: params.videoEstilo,
      ambiente: params.videoAmbiente,
    },
    "[videoGeneration:diag] tentativa 1 de roteiro",
  );

  if (attempt1.script) return attempt1.script;

  // Log da causa do script vazio
  if (attempt1.refusal) {
    logger.warn(
      { refusal: attempt1.refusal, finishReason: attempt1.finishReason },
      "[videoGeneration] recusa detectada na tentativa 1 — iniciando retry",
    );
  } else {
    logger.warn(
      { chunkCount: attempt1.chunkCount, finishReason: attempt1.finishReason },
      "[videoGeneration] roteiro vazio sem recusa — iniciando retry",
    );
  }

  // ── Tentativa 2: prompt mínimo (retry de segurança) ──────────────────────
  const simpleSystem = `Escreva roteiros de marketing em português do Brasil. Retorne apenas o texto falado.`;
  const simpleUser = `Roteiro de ${params.videoDuration} segundos sobre: "${prompt}". Entre ${minWords} e ${maxWords} palavras. Só a fala, em português.`;

  const attempt2 = await attemptScriptGeneration(
    [
      { role: "system", content: simpleSystem },
      { role: "user", content: simpleUser },
    ],
    signal,
  );

  logger.info(
    {
      attempt: 2,
      chunkCount: attempt2.chunkCount,
      scriptLength: attempt2.script.length,
      scriptPreview: attempt2.script.slice(0, 100),
      refusal: attempt2.refusal,
      finishReason: attempt2.finishReason,
    },
    "[videoGeneration:diag] tentativa 2 de roteiro (retry)",
  );

  if (attempt2.script) {
    logger.info({}, "[videoGeneration] roteiro obtido no retry simplificado");
    return attempt2.script;
  }

  if (attempt2.refusal) {
    logger.error(
      { refusal1: attempt1.refusal, refusal2: attempt2.refusal },
      "[videoGeneration] recusa em ambas as tentativas",
    );
  }

  throw new Error("Não foi possível gerar o roteiro. Tente simplificar o prompt.");
}

// ─── Duração efetiva (com promoção) ─────────────────────────────────────────

function effectiveDuration(script: string, requested: number): number {
  const words = script.trim().split(/\s+/).length;
  const estimated = Math.round(words / 2.5);
  if (requested === 20 && estimated > 22) return 40;
  if (requested === 40 && estimated > 44) return 60;
  return requested;
}

// ─── Mock ────────────────────────────────────────────────────────────────────

function buildMockResult(params: VideoGenerationInput): VideoGenerationResult {
  return {
    videoUrl: "",
    durationSeconds: params.videoDuration,
    videoEstilo: params.videoEstilo,
    videoAvatar: params.videoAvatar,
    videoAmbiente: params.videoAmbiente,
    videoFormato: params.videoFormato,
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

  const aspectRatio = FORMATO_TO_ASPECT[params.videoFormato] ?? "16:9";
  const background = resolveBackground(params.videoAmbiente, aspectRatio);

  logger.info(
    {
      videoEstilo: params.videoEstilo,
      videoAvatar: params.videoAvatar,
      videoAmbiente: params.videoAmbiente,
      videoFormato: params.videoFormato,
      aspectRatio,
      backgroundType: background.startsWith("#") ? "color" : "image",
      backgroundUrl: background.startsWith("#") ? background : background.slice(0, 80),
      videoDuration: params.videoDuration,
      heygenConfigured: HEYGEN_CONFIGURED,
    },
    "[videoGeneration] iniciando pipeline",
  );

  try {
    sendSSE(res, { type: "progress", message: "Preparando roteiro..." });
    const script = await buildVideoScript(params, signal);

    if (!script || script.trim().length === 0) {
      sendSSEError(res, "Não foi possível gerar o roteiro. Tente simplificar o prompt.");
      return;
    }

    const duration = effectiveDuration(script, params.videoDuration);

    // ── Modo mock ────────────────────────────────────────────────────────────
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
        action: `Vídeo mock: ${prompt.slice(0, 50)} (${params.videoEstilo}, ${params.videoAvatar})`,
        module: "creative",
      });
      sendSSEDone(res);
      return;
    }

    // ── Modo real via HeyGen ─────────────────────────────────────────────────
    sendSSE(res, { type: "progress", message: "Preparando personagem..." });

    // Seleção blindada: estilo × gênero → avatar_id da biblioteca oficial
    // executivo+masculino → Armando_Suit_Front_public
    // consultor+masculino → Colin_Business_Front_public
    // criador+masculino   → August_Cool_Style_public
    // executivo+feminino  → Annie_expressive_public   (9:16 nativo)
    // consultor+feminino  → Imelda_Business_Front_public
    // criador+feminino    → Judith_expressive_2024120201 (9:16 nativo)
    const avatarId = AVATAR_IDS[params.videoAvatar] || getOfficialAvatarId(params.videoEstilo, params.videoAvatar);
    const voiceId = VOICE_IDS[params.videoAvatar];

    if (!voiceId) {
      sendSSEError(res, "Configuração de voz incompleta. Entre em contato com o suporte.");
      return;
    }

    logger.info(
      {
        avatarId,
        videoEstilo: params.videoEstilo,
        videoAvatar: params.videoAvatar,
        voiceId,
        aspectRatio,
        ambiente: params.videoAmbiente,
        backgroundType: background.startsWith("#") ? "color" : "image",
        scriptLength: script.length,
        scriptPreview: script.slice(0, 80),
      },
      "[videoGeneration] roteiro válido — enviando para HeyGen",
    );

    sendSSE(res, { type: "progress", message: "Preparando vídeo..." });
    const { videoId } = await generateVideo({ avatarId, voiceId, script, background, aspectRatio });

    sendSSE(res, { type: "progress", message: "Aguardando processamento..." });
    const videoUrl = await pollUntilDone(
      videoId,
      () => sendSSE(res, { type: "progress", message: "Processando vídeo..." }),
      60,
      3_000,
    );

    const finalResult: VideoGenerationResult = {
      videoUrl,
      durationSeconds: duration,
      videoEstilo: params.videoEstilo,
      videoAvatar: params.videoAvatar,
      videoAmbiente: params.videoAmbiente,
      videoFormato: params.videoFormato,
      prompt,
      generatedAt: new Date().toISOString(),
      isMock: false,
    };

    sendSSE(res, { type: "result", data: finalResult });
    await logAiUsage({
      clerkUserId,
      action: `Vídeo gerado: ${prompt.slice(0, 50)} (${params.videoEstilo}, ${params.videoAvatar}, ${params.videoFormato}, ${duration}s)`,
      module: "creative",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      res.end();
      return;
    }
    const rawMsg = err instanceof Error ? err.message : String(err);
    logger.error(
      {
        errName: err instanceof Error ? err.name : typeof err,
        errMsg: rawMsg,
        errStack: err instanceof Error ? err.stack?.slice(0, 400) : undefined,
      },
      "[videoGeneration] pipeline error",
    );
    const userMsg =
      rawMsg.startsWith("Não foi possível") ||
      rawMsg.startsWith("Tempo esgotado") ||
      rawMsg.startsWith("Configuração de avatar") ||
      rawMsg.startsWith("Erro HeyGen")
        ? rawMsg
        : "Não foi possível gerar o vídeo. Seus créditos serão devolvidos automaticamente.";
    sendSSEError(res, userMsg);
    return;
  }

  sendSSEDone(res);
}
