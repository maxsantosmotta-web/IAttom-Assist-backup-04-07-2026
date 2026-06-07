import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";
import { logAiUsage } from "./logger.js";
import { logger } from "../logger.js";

interface CreativeIdeasInput {
  prompt: string;
  quantity?: number;
  format?: string;
}

export interface CreativeConcept {
  id: number;
  label: string;
  format: string;
  imagePrompt: string;
  imageBase64?: string;
}

export interface CreativeIdeasResult {
  concepts: CreativeConcept[];
  visualAnchor?: string;
}

type ImageSize = "1024x1024" | "1536x1024" | "1024x1536" | "auto";

const FORMAT_SIZES: Record<string, ImageSize> = {
  feed:        "1024x1024",
  story:       "1024x1536",
  banner:      "1536x1024",
  profile:     "1024x1024",
  marketplace: "1024x1024",
};

const FORMAT_LABELS: Record<string, string> = {
  feed:        "Feed",
  story:       "Story / Reels",
  banner:      "Banner",
  profile:     "Perfil",
  marketplace: "Marketplace",
};

const FORMAT_DIMENSIONS: Record<string, string> = {
  feed:        "1:1 quadrado",
  story:       "9:16 vertical",
  banner:      "16:9 horizontal",
  profile:     "1:1 quadrado",
  marketplace: "1:1 quadrado",
};

function getImageSize(format?: string): ImageSize {
  if (!format) return "1024x1024";
  return FORMAT_SIZES[format] ?? "1024x1024";
}

function getFormatLabel(format?: string, index?: number, total?: number): string {
  const base = format ? (FORMAT_LABELS[format] ?? "Imagem") : "Imagem";
  if (total && total > 1 && index !== undefined) {
    return `${base} ${index + 1}`;
  }
  return base;
}

function enrichImagePrompt(
  basePrompt: string,
  productName: string,
  visualAnchor: string,
  format?: string,
): string {
  const anchorPrefix = visualAnchor
    ? `CAMPAIGN VISUAL ANCHOR — apply consistently: ${visualAnchor}. `
    : "";
  const productAnchor = `${productName} — exact product as specified by user, preserve real product appearance, proportions and category`;
  const dim = format ? FORMAT_DIMENSIONS[format] : undefined;
  const formatSuffix = dim ? ` Ad format: ${dim}.` : "";
  return `${anchorPrefix}${productAnchor}. ${basePrompt}${formatSuffix}`;
}

interface LLMConceptRaw {
  id?: number;
  imagePrompt?: string;
}

interface LLMOutputRaw {
  concepts?: LLMConceptRaw[];
  visualAnchor?: string;
}

function safeParseJson(raw: string): LLMOutputRaw | null {
  if (!raw?.trim()) return null;
  try { return JSON.parse(raw.trim()) as LLMOutputRaw; } catch { /* try next */ }
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned) as LLMOutputRaw; } catch { /* try next */ }
  const cs = cleaned.indexOf("{"); const ce = cleaned.lastIndexOf("}");
  if (cs !== -1 && ce !== -1 && ce > cs) {
    try { return JSON.parse(cleaned.slice(cs, ce + 1)) as LLMOutputRaw; } catch { /* noop */ }
  }
  return null;
}

export async function streamCreativeIdeas(
  params: CreativeIdeasInput,
  res: Response,
  clerkUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  setupSSE(res);
  sendSSE(res, { type: "start" });

  const productName = params.prompt.trim();
  const numConcepts = params.quantity === 1 ? 1 : 2;
  const format = params.format ?? "feed";
  const formatLabel = FORMAT_LABELS[format] ?? "Feed";
  const formatDim = FORMAT_DIMENSIONS[format] ?? "1:1 quadrado";

  if (process.env.NODE_ENV !== "production") {
    logger.info({ productName, numConcepts, format }, "[creativeIdeas] generating");
  }

  const compositionRule =
    format === "story"
      ? "Composição vertical 9:16 — produto em destaque central, espaço superior e inferior limpos."
      : format === "banner"
      ? "Composição horizontal 16:9 — produto à esquerda ou centralizado, espaço amplo para layout de anúncio."
      : "Composição quadrada 1:1 — produto centralizado, fundo clean ou lifestyle contextual.";

  const variationRule =
    numConcepts > 1
      ? `\nREGRA DE VARIAÇÃO: As ${numConcepts} imagens devem ser composições DISTINTAS do mesmo produto — variações de ângulo, cenário ou contexto de uso. Mesma paleta visual e estilo.`
      : "";

  const systemPrompt = `Você é um diretor de criação visual de nível mundial para publicidade digital.

FORMATO: ${formatLabel} (${formatDim})
QUANTIDADE: ${numConcepts} ${numConcepts === 1 ? "imagem" : "imagens"}

REGRA ABSOLUTA DE FIDELIDADE AO PRODUTO: O produto informado é a referência central e obrigatória. NÃO substitua por versão genérica ou produto parecido. Preserve o nome exato, aparência, proporções e categoria.

REGRA DE IDIOMA: imagePrompt SEMPRE em inglês.

REGRA DE COMPOSIÇÃO: ${compositionRule}${variationRule}

REGRA DE QUALIDADE OBRIGATÓRIA: photorealistic, commercial photography quality, cinematic lighting, soft shadows and highlights, clear visual hierarchy, modern clean composition, professional depth of field, premium advertising aesthetic, high-end magazine quality, no text overlays, no logos, no watermarks, ready-to-publish ad quality, aspirational mood, natural anatomy if people appear.

Retorne APENAS JSON puro sem markdown:
{
  "concepts": [
    {
      "id": number (1-${numConcepts}),
      "imagePrompt": string (prompt detalhado em inglês — mínimo 60 palavras. Inclua: nome exato do produto, características físicas, iluminação, ângulo, cenário, mood, estilo fotográfico, composição)
    }
  ],
  "visualAnchor": string (âncora visual interna — produto exato + paleta dominante 2-3 cores hex + estilo visual + iluminação, em inglês)
}`;

  const userPrompt = `PRODUTO: "${productName}"

Gere ${numConcepts} criativo${numConcepts === 1 ? "" : "s"} visual${numConcepts === 1 ? "" : "is"} premium para este produto no formato ${formatLabel} (${formatDim}).

INSTRUÇÃO: O imagePrompt deve iniciar com o nome exato "${productName}". Descreva características físicas prováveis do produto. Garanta composição ideal para ${formatDim}.`;

  try {
    let llmOutput: LLMOutputRaw | null = null;
    let lastError = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 2048,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          stream: false,
        }, { signal });
        const raw = response.choices[0]?.message?.content ?? "";
        llmOutput = safeParseJson(raw);
        if (llmOutput?.concepts?.length) break;
        lastError = "Resposta inválida da IA";
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Erro interno na geração";
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
    }

    if (!llmOutput?.concepts?.length) {
      sendSSEError(res, `${lastError}. Seus créditos serão devolvidos automaticamente. Tente novamente em instantes.`);
      return;
    }

    const visualAnchor = llmOutput.visualAnchor?.trim() ?? "";

    const enrichedConcepts: CreativeConcept[] = llmOutput.concepts
      .slice(0, numConcepts)
      .map((c, i) => ({
        id: c.id ?? i + 1,
        label: getFormatLabel(format, i, numConcepts),
        format,
        imagePrompt: enrichImagePrompt(c.imagePrompt ?? productName, productName, visualAnchor, format),
      }));

    if (process.env.NODE_ENV !== "production") {
      enrichedConcepts.forEach((c, i) => {
        logger.info({ index: i, imagePrompt: c.imagePrompt.slice(0, 300) }, "[creativeIdeas] enriched imagePrompt");
      });
    }

    const imageResults = await Promise.allSettled(
      enrichedConcepts.map((concept) =>
        generateImageBuffer(concept.imagePrompt, getImageSize(concept.format), signal),
      ),
    );

    const hasAtLeastOneImage = imageResults.some((r) => r.status === "fulfilled");
    if (!hasAtLeastOneImage) {
      sendSSEError(res, "Não foi possível gerar as imagens desta vez. Seus créditos serão devolvidos automaticamente. Tente novamente.");
      return;
    }

    const conceptsWithImages: CreativeConcept[] = enrichedConcepts.map((concept, i) => {
      const imgResult = imageResults[i];
      return {
        ...concept,
        imageBase64:
          imgResult.status === "fulfilled"
            ? imgResult.value.toString("base64")
            : undefined,
      };
    });

    const finalResult: CreativeIdeasResult = {
      visualAnchor,
      concepts: conceptsWithImages,
    };

    sendSSE(res, { type: "result", data: finalResult });
    await logAiUsage({
      clerkUserId,
      action: `Criativo gerado: ${productName.slice(0, 50)} (${numConcepts}x ${formatLabel})`,
      module: "creative",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro inesperado na geração. Seus créditos serão devolvidos automaticamente.";
    sendSSEError(res, msg);
    return;
  }

  sendSSEDone(res);
}
