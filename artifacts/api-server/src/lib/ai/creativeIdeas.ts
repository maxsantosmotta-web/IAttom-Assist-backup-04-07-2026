import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";
import { logAiUsage } from "./logger.js";
import { semanticNormalize } from "./semanticNormalize.js";
import { logger } from "../logger.js";
import { buildRefinedContext } from "./interpretationEngine.js";

interface CreativeIdeasInput {
  prompt: string;
  platform: string;
  selectedFormats: string[];
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

const FORMAT_SIZES: Record<string, Record<string, ImageSize>> = {
  instagram:     { feed: "1024x1024", stories: "1024x1536" },
  facebook:      { feed: "1024x1024", stories: "1024x1536", banner: "1536x1024" },
  tiktok:        { feed: "1024x1024", stories: "1024x1536" },
  mercado_livre: { produto: "1024x1024", banner: "1536x1024" },
  shopee:        { produto: "1024x1024", banner: "1536x1024" },
  hotmart:       { capa: "1024x1024", banner: "1536x1024" },
  kiwify:        { capa: "1024x1024", banner: "1536x1024" },
  perfil:        { perfil: "1024x1024" },
};

const FORMAT_LABELS: Record<string, Record<string, string>> = {
  instagram:     { feed: "Instagram Feed", stories: "Instagram Stories" },
  facebook:      { feed: "Facebook Feed", stories: "Facebook Stories", banner: "Facebook Banner" },
  tiktok:        { feed: "TikTok Feed", stories: "TikTok Stories" },
  mercado_livre: { produto: "Mercado Livre Produto", banner: "Mercado Livre Banner" },
  shopee:        { produto: "Shopee Produto", banner: "Shopee Banner" },
  hotmart:       { capa: "Hotmart Capa", banner: "Hotmart Banner" },
  kiwify:        { capa: "Kiwify Capa", banner: "Kiwify Banner" },
  perfil:        { perfil: "Foto de Perfil" },
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram:     "Instagram",
  facebook:      "Facebook",
  tiktok:        "TikTok",
  mercado_livre: "Mercado Livre",
  shopee:        "Shopee",
  hotmart:       "Hotmart",
  kiwify:        "Kiwify",
  perfil:        "Perfil",
};

function getImageSize(platform: string, format: string): ImageSize {
  return FORMAT_SIZES[platform]?.[format] ?? "1024x1024";
}

function getFormatLabel(platform: string, format: string): string {
  return FORMAT_LABELS[platform]?.[format] ?? format;
}

function getCompositionHint(platform: string, format: string): string {
  const size = getImageSize(platform, format);
  if (size === "1024x1536") return "vertical 9:16 composition — tall portrait framing, prominent central subject, ample space above and below";
  if (size === "1536x1024") return "horizontal 16:9 composition — wide landscape framing, product positioned center or left, generous negative space";
  return "square 1:1 composition — centered product, balanced framing, equal visual weight on all sides";
}

function enrichImagePrompt(
  basePrompt: string,
  productName: string,
  visualAnchor: string,
  platform: string,
  format: string,
): string {
  const anchorPrefix = visualAnchor
    ? `CAMPAIGN VISUAL ANCHOR — apply consistently: ${visualAnchor}. `
    : "";
  const productAnchor = `${productName} — exact product as specified, preserve real appearance, proportions and category`;
  const compositionSuffix = ` ${getCompositionHint(platform, format)}.`;
  return `${anchorPrefix}${productAnchor}. ${basePrompt}${compositionSuffix}`;
}

interface LLMConceptRaw {
  id?: number;
  imagePrompt?: string;
}

interface LLMOutputRaw {
  concepts?: LLMConceptRaw[];
  visualAnchor?: string;
}

interface ParsedCreativeInput {
  productName: string;
  creativeBrief: string;
  isProfessionalBrief: boolean;
}

const PROFESSIONAL_BRIEF_MARKERS = /(?:^|\n)\s*(?:contexto|instruções? de imagem|instrucoes? de imagem|critérios? de qualidade|criterios? de qualidade|paleta|composição|composicao|iluminação|iluminacao)\s*:/i;

function parseCreativeInput(rawPrompt: string): ParsedCreativeInput {
  const normalized = semanticNormalize(rawPrompt).trim();
  const isProfessionalBrief = normalized.length > 320 || PROFESSIONAL_BRIEF_MARKERS.test(normalized);

  if (!isProfessionalBrief) {
    return {
      productName: normalized,
      creativeBrief: "",
      isProfessionalBrief: false,
    };
  }

  const firstMeaningfulLine = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? normalized;

  const separatorMatch = firstMeaningfulLine.match(/(?:—|–|\||:)\s*(.+)$/);
  let productName = (separatorMatch?.[1] ?? firstMeaningfulLine)
    .replace(/^(?:imagem|foto|criativo|anúncio|anuncio)\s+(?:publicitária|publicitaria|publicitário|publicitario)?\s*(?:premium)?\s*[-—–:]?\s*/i, "")
    .replace(/[.!;]+$/, "")
    .trim();

  if (!productName) productName = firstMeaningfulLine.trim();
  if (productName.length > 140) productName = productName.slice(0, 140).trim();

  return {
    productName,
    creativeBrief: normalized,
    isProfessionalBrief: true,
  };
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

  const parsedInput = parseCreativeInput(params.prompt);
  const productName = parsedInput.productName;
  const creativeBrief = parsedInput.creativeBrief;
  const platform = params.platform;
  const selectedFormats = params.selectedFormats.slice(0, 3);
  const numConcepts = selectedFormats.length;
  const platformLabel = PLATFORM_LABELS[platform] ?? platform;

  if (numConcepts === 0) {
    sendSSEError(res, "Nenhum formato selecionado.");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    logger.info(
      {
        productName,
        professionalBrief: parsedInput.isProfessionalBrief,
        briefLength: creativeBrief.length,
        platform,
        selectedFormats,
      },
      "[creativeIdeas] generating",
    );
  }

  // Motor de Interpretação e Especialistas (BLOCO 1.5)
  // Recebe somente o nome curto do produto para preservar a lógica atual de qualidade.
  const refinedCtx = buildRefinedContext(productName, platform);

  const formatList = selectedFormats
    .map((fmt, i) => `- Conceito ${i + 1}: ${getFormatLabel(platform, fmt)} (${getCompositionHint(platform, fmt)})`)
    .join("\n");

  const cohesionRule = numConcepts > 1
    ? `\nREGRA DE COESÃO VISUAL: As ${numConcepts} imagens devem pertencer à MESMA campanha visual. O visualAnchor deve garantir consistência de paleta + estilo + iluminação. Variações permitidas: ângulo, cenário, composição de layout.`
    : "";

  const systemPrompt = `Você é um diretor de criação visual de nível mundial para publicidade digital.

PRODUTO: "${productName}"
PLATAFORMA: ${platformLabel}
QUANTIDADE: ${numConcepts} imagem${numConcepts === 1 ? "" : "ns"}

${refinedCtx.systemEnhancement}

FORMATOS SOLICITADOS:
${formatList}

REGRA ABSOLUTA DE FIDELIDADE AO PRODUTO: O produto informado é a referência central e obrigatória. NÃO substitua por versão genérica ou produto parecido. Preserve o nome exato, aparência, proporções e categoria do produto.

REGRA DE IDIOMA: imagePrompt SEMPRE em inglês.

REGRA DE COMPOSIÇÃO: Cada conceito deve ter a composição exata especificada para seu formato. Adapte enquadramento, proporção e layout ao formato de cada conceito.

REGRA DE QUALIDADE: photorealistic, commercial photography quality, cinematic lighting, soft shadows and highlights, clear visual hierarchy, modern clean composition, professional depth of field, premium advertising aesthetic, high-end magazine quality, no text overlays, no logos, no watermarks, ready-to-publish ad quality, aspirational mood, natural anatomy if people appear.${cohesionRule}

Retorne APENAS JSON puro sem markdown:
{
  "concepts": [
    {
      "id": number (1-${numConcepts}),
      "imagePrompt": string (prompt detalhado em inglês para o formato específico — mínimo 60 palavras. Inclua: nome exato do produto, composição específica do formato, iluminação, ângulo, cenário, mood, estilo fotográfico premium)
    }
  ],
  "visualAnchor": string (âncora visual interna — produto exato + paleta dominante 2-3 cores hex + estilo visual + iluminação, em inglês)
}`;

  const formatDetails = selectedFormats
    .map((fmt, i) => `Conceito ${i + 1}: ${getFormatLabel(platform, fmt)} — ${getCompositionHint(platform, fmt)}`)
    .join("\n");

  const briefSection = creativeBrief
    ? `\nBRIEFING PROFISSIONAL DO USUÁRIO — preserve as instruções relevantes sem repetir o texto literalmente:\n${creativeBrief}\n`
    : "";

  const userPrompt = `PRODUTO: "${productName}"
${refinedCtx.userEnhancement}
${briefSection}
Gere ${numConcepts} criativo${numConcepts === 1 ? "" : "s"} visual${numConcepts === 1 ? "" : "is"} premium para ${platformLabel}.

Formatos e composições obrigatórias:
${formatDetails}

INSTRUÇÃO: O imagePrompt de cada conceito deve iniciar com "${productName}". Aplique as diretrizes do especialista, preserve o briefing profissional quando fornecido e adapte a composição ao enquadramento de cada formato.`;

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

    if (!llmOutput || !llmOutput.concepts || !llmOutput.concepts.length) {
      sendSSEError(res, `${lastError}. Seus créditos serão devolvidos automaticamente. Tente novamente em instantes.`);
      return;
    }

    const llmConcepts = llmOutput.concepts;
    const visualAnchor = llmOutput.visualAnchor?.trim() ?? "";

    const enrichedConcepts: CreativeConcept[] = selectedFormats.map((fmt, i) => {
      const llmConcept = llmConcepts[i] ?? llmConcepts[0]!;
      return {
        id: i + 1,
        label: getFormatLabel(platform, fmt),
        format: fmt,
        imagePrompt: enrichImagePrompt(llmConcept.imagePrompt ?? productName, productName, visualAnchor, platform, fmt),
      };
    });

    if (process.env.NODE_ENV !== "production") {
      enrichedConcepts.forEach((c, i) => {
        logger.info({ index: i, format: c.format, imagePrompt: c.imagePrompt.slice(0, 200) }, "[creativeIdeas] imagePrompt");
      });
    }

    const imageResults = await Promise.allSettled(
      enrichedConcepts.map((concept) =>
        generateImageBuffer(concept.imagePrompt, getImageSize(platform, concept.format), signal),
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
        imageBase64: imgResult.status === "fulfilled" ? imgResult.value.toString("base64") : undefined,
      };
    });

    const finalResult: CreativeIdeasResult = {
      visualAnchor,
      concepts: conceptsWithImages,
    };

    sendSSE(res, { type: "result", data: finalResult });
    await logAiUsage({
      clerkUserId,
      action: `Criativo gerado: ${productName.slice(0, 50)} (${numConcepts}x ${platformLabel})`,
      module: "creative",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro inesperado na geração. Seus créditos serão devolvidos automaticamente.";
    sendSSEError(res, msg);
    return;
  }

  sendSSEDone(res);
}
