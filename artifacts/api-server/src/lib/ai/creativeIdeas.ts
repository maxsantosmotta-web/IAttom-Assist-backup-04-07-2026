import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer, editImageFromBuffer } from "@workspace/integrations-openai-ai-server/image";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";
import { logAiUsage } from "./logger.js";
import { logger } from "../logger.js";

interface CreativeIdeasInput {
  prompt: string;
  style?: string;
  product?: string;
  targetAudience?: string;
  formatPack?: string;
  platform?: string;
  referenceImageBase64?: string;
}

export interface CreativeConcept {
  id: number;
  label: string;
  format: string;
  concept: string;
  visualDirection: string;
  copyHook: string;
  bodyText: string;
  cta: string;
  emotionalTrigger: string;
  bestPlatform: string;
  imagePrompt: string;
  imageBase64?: string;
}

export interface CreativeIdeasResult {
  concepts: CreativeConcept[];
  overarchingTheme: string;
  colorPalette: string;
  typographyDirection: string;
  brandVoiceNotes: string;
  visualAnchor?: string;
}

type ImageSize = "1024x1024" | "1536x1024" | "1024x1536" | "auto";

function mapFormatToSize(format: string): ImageSize {
  const f = format.toLowerCase();
  if (f.includes("9:16") || f.includes("story") || f.includes("reels") || f.includes("1536")) {
    return "1024x1536";
  }
  if (f.includes("16:9") || f.includes("banner") || f.includes("landscape") || f.includes("1536x1024")) {
    return "1536x1024";
  }
  return "1024x1024";
}

const FORMAT_PACKS: Record<string, string[]> = {
  social:  ["1:1 quadrado", "1:1 quadrado", "9:16 story", "16:9 banner"],
  stories: ["9:16 story",   "9:16 story",   "9:16 story", "9:16 story"],
  ads:     ["16:9 banner",  "16:9 banner",  "1:1 quadrado", "1:1 quadrado"],
};

const PLATFORM_IMAGE_PRESETS: Record<string, string[]> = {
  mercado_livre: ["1:1 quadrado", "1:1 quadrado variação"],
  shopee:        ["1:1 quadrado", "16:9 banner"],
  instagram:     ["1:1 feed", "9:16 story"],
  facebook:      ["1:1 feed", "16:9 banner"],
  tiktok:        ["9:16 vertical", "9:16 vertical variação"],
  hotmart:       ["1:1 thumb/feed", "16:9 banner"],
  kiwify:        ["1:1 thumb/feed", "1:1 thumb/feed variação"],
  whatsapp:      ["1:1 feed", "9:16 status"],
};

function getFormatPack(formatPack?: string, platform?: string): string[] {
  if (platform && PLATFORM_IMAGE_PRESETS[platform]) return PLATFORM_IMAGE_PRESETS[platform];
  if (formatPack && FORMAT_PACKS[formatPack]) return FORMAT_PACKS[formatPack];
  return FORMAT_PACKS.social;
}

function enrichImagePrompt(basePrompt: string, productName: string, visualAnchor: string, style?: string, format?: string): string {
  const anchorPrefix = visualAnchor ? `CAMPAIGN VISUAL ANCHOR — apply consistently across all images: ${visualAnchor}. ` : "";
  const productAnchor = `${productName} — exact product as specified by user, preserve real product appearance, proportions and category`;
  const styleSuffix = style ? ` Visual style: ${style}.` : "";
  const formatSuffix = format ? ` Ad format: ${format}.` : "";
  return `${anchorPrefix}${productAnchor}. ${basePrompt}${styleSuffix}${formatSuffix}`;
}

export async function streamCreativeIdeas(
  params: CreativeIdeasInput,
  res: Response,
  clerkUserId: string,
): Promise<void> {
  setupSSE(res);
  sendSSE(res, { type: "start" });

  const productName = params.product?.trim() || params.prompt.trim();
  if (process.env.NODE_ENV !== "production") {
    logger.info({ productName }, "[creativeIdeas] productName resolved");
  }

  const formats = getFormatPack(params.formatPack, params.platform);
  const numConcepts = formats.length;
  const formatInstruction = `Os ${numConcepts} conceitos devem usar exatamente estes formatos, nesta ordem: ${formats.map((f, i) => `conceito ${i + 1}: "${f}"`).join(", ")}.`;

  const systemPrompt = `Você é um diretor criativo de nível mundial para publicidade digital. Desenvolve conceitos criativos revolucionários que param o scroll, constroem desejo pela marca e geram conversões.

REGRA ABSOLUTA DE FIDELIDADE AO PRODUTO: O produto informado pelo usuário é a referência central e obrigatória de toda a geração. NÃO substitua por categoria genérica, versão aproximada ou produto parecido. Se houver modelo, código, nome comercial ou nome específico, mantenha esse exato nome em todos os conceitos, copies e imagePrompts. Prioridade de execução: fidelidade ao produto > estilo visual > criatividade. Esta regra tem precedência sobre qualquer outra instrução.

REGRA OBRIGATÓRIA DE IDIOMA: Responda SEMPRE em português brasileiro. NUNCA responda em inglês, espanhol ou qualquer outro idioma. Todos os conceitos, textos, hooks, CTAs e direções visuais devem estar integralmente em português brasileiro.

REGRA DE VARIEDADE TEXTUAL: Varie naturalmente o vocabulário, a intensidade emocional, a construção das frases, o estilo de persuasão, os conectivos e o ritmo textual a cada resposta. Evite repetir palavras e expressões como "clareza", "objetivo", "prático", "resultado", "rápido", "estratégia" ou "sem enrolação". Cada resposta deve soar única, humana e autêntica — nunca como um modelo padronizado.

REGRA DE OBJETIVIDADE: Seja direto e escaneável. Comece com o ponto mais relevante. Use blocos curtos, ações concretas e linguagem direta. Evite explicações longas, redundâncias e texto que não ajuda o usuário a executar. Mantenha a qualidade estratégica, mas elimine o excesso — menos é mais quando o conteúdo é denso e acionável.

Sua saída deve ser um objeto JSON válido — sem markdown, sem blocos de código, apenas JSON puro.

REGRA DE FORMATOS OBRIGATÓRIA: O campo "format" de cada conceito deve conter EXATAMENTE um destes valores, sem variação:
- "1:1 quadrado"
- "9:16 story"
- "16:9 banner"
Nunca use outros valores. Nunca invente formatos.

Retorne exatamente esta estrutura:
{
  "concepts": [
    {
      "id": number (1-${numConcepts}),
      "label": string (nome do criativo em PT-BR, ex: "Feed Principal", "Story Emocional", "Banner Conversão", "Destaque do Produto"),
      "format": string (OBRIGATÓRIO: usar exatamente "1:1 quadrado", "9:16 story" ou "16:9 banner"),
      "concept": string (1-2 frases descrevendo o conceito criativo, em PT-BR),
      "visualDirection": string (descrição visual detalhada para o designer, em PT-BR),
      "copyHook": string (headline/gancho de atenção, em PT-BR),
      "bodyText": string (texto de apoio, em PT-BR),
      "cta": string (texto do botão de chamada para ação, em PT-BR),
      "emotionalTrigger": string (emoção central sendo ativada, em PT-BR),
      "bestPlatform": string (onde este criativo funciona melhor, em PT-BR),
      "imagePrompt": string (prompt detalhado para geração de imagem IA — SEMPRE em inglês. REGRA CRÍTICA DE FIDELIDADE AO PRODUTO: Antes de escrever o imagePrompt, verifique se o briefing contém marca, modelo, nome comercial, versão ou produto popular específico. Se houver, preserve OBRIGATORIAMENTE as características físicas reconhecíveis do produto real: formato, proporção, estrutura, cor típica, componentes principais, estilo comercial e aparência de mercado. Use o nome exato do produto e repita o modelo/nome comercial na descrição visual. NÃO substitua por produto genérico parecido. NÃO invente marcas, formatos ou versões. Se o visual exato não for conhecido, gere imagem comercial fiel ao tipo/categoria do produto — sem alterar categoria, formato ou proporção principal. OBRIGATÓRIO para qualidade premium: photorealistic, commercial photography quality, cinematic lighting with soft shadows and highlights, clear visual hierarchy, modern and clean composition, professional depth of field with sharp subject and soft background, premium advertising aesthetic, product or subject centered and well-composed, high-end magazine quality, clean background or contextual lifestyle setting, natural human anatomy if people appear, no extra fingers, no deformities, no text overlays, no logos, no watermarks, no brand names visible, no amateur look, no blurry elements, no distortion, no cluttered composition, ready-to-publish ad quality, aspirational mood)
    }
  ],
  "overarchingTheme": string (tema criativo unificador de todos os conceitos, em PT-BR),
  "colorPalette": string (3-4 cores específicas em hex com nomes em PT-BR),
  "typographyDirection": string (guia de estilo tipográfico e hierarquia, em PT-BR),
  "brandVoiceNotes": string (guia de tom e mensagem da marca, em PT-BR),
  "visualAnchor": string (âncora visual obrigatória do pacote — em inglês, pois será usada em imagePrompts: produto exato + paleta dominante (2-3 cores hex) + estilo visual + iluminação principal. Exemplo: "HydroElite bottle, dominant colors #1a1a2e and #C9A84C gold, photorealistic lifestyle style, soft cinematic side lighting")
}

REGRA DE PACOTE VISUAL COESO (máxima prioridade para imagePrompts):
As ${numConcepts} imagens devem pertencer à MESMA CAMPANHA VISUAL — não a campanhas independentes. Antes de escrever qualquer imagePrompt, defina a âncora visual no campo "visualAnchor" com: produto exato + paleta de cores dominante (2-3 cores hex) + estilo visual + iluminação principal. Todos os ${numConcepts} imagePrompts devem começar referenciando essa âncora. Variações PERMITIDAS entre as ${numConcepts} imagens: ângulo, enquadramento, cenário, composição, posição do produto, contexto de uso. Variações PROIBIDAS: categoria do produto, paleta dominante, estilo visual principal, iluminação central, identidade da marca. Quando houver imagem de referência: preserve estrutura, silhueta, proporções e aparência do produto — não reinvente o produto em nenhum dos ${numConcepts} imagePrompts.

Crie ${numConcepts} conceitos criativos distintos. Cada um deve parecer que saiu de uma agência de ponta.`;

  const userPrompt = `PRODUTO CENTRAL (referência obrigatória para todos os conceitos e imagens): "${productName}"

Gere conceitos criativos premium para anúncios deste produto exato.
Briefing completo: "${params.prompt}"
${params.style ? `Estilo visual: ${params.style}` : ""}
${params.targetAudience ? `Público-alvo: ${params.targetAudience}` : ""}

${formatInstruction}

INSTRUÇÃO OBRIGATÓRIA PARA imagePrompt: Inicie SEMPRE com o nome exato "${productName}". Descreva as características físicas prováveis deste produto específico (formato, proporção, cor, componentes, estilo comercial). NÃO substitua por versão genérica. O nome "${productName}" deve aparecer na primeira frase do imagePrompt.

Crie ${numConcepts} conceitos criativos visualmente impactantes, alinhados ao produto e focados em conversão. Responda integralmente em português brasileiro.`;

  let fullResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        sendSSE(res, { type: "chunk", content });
      }
    }

    const textResult: CreativeIdeasResult = JSON.parse(fullResponse);

    const visualAnchor = textResult.visualAnchor?.trim() ?? "";

    const enrichedConcepts = textResult.concepts.map((concept) => ({
      ...concept,
      imagePrompt: enrichImagePrompt(concept.imagePrompt, productName, visualAnchor, params.style, concept.format),
    }));

    if (process.env.NODE_ENV !== "production") {
      enrichedConcepts.forEach((c, i) => {
        logger.info({ index: i, imagePrompt: c.imagePrompt.slice(0, 300) }, "[creativeIdeas] enriched imagePrompt");
      });
    }

    const referenceBuffer = params.referenceImageBase64
      ? Buffer.from(params.referenceImageBase64, "base64")
      : null;

    const imageResults = await Promise.allSettled(
      enrichedConcepts.map((concept) => {
        if (referenceBuffer) {
          // When reference image is provided, it is the VISUAL ANCHOR for the product.
          // NEVER change the product. Only vary: scene, lighting, background, composition, angle.
          const sceneInstruction = (() => {
            const c = concept.concept ?? "";
            const vd = concept.visualDirection ?? "";
            // Extract only scene/setting/mood — NOT product description
            const combined = `${c} ${vd}`.trim();
            return combined.length > 10 ? combined.slice(0, 300) : "premium lifestyle setting";
          })();
          const styleContext = (params.style ?? "").trim() || "premium commercial";
          const editPrompt = [
            "STRUCTURAL ANCHOR: Use the reference image to extract the product's physical identity only.",
            "PRESERVE — non-negotiable:",
            "- Exact shape, silhouette, geometry and proportions of the product",
            "- All structural components and their spatial relationships",
            "- Product category identity — do NOT replace, simplify or generalize the product",
            "- Do NOT add or remove physical parts that are not present in the reference",
            "DO NOT PRESERVE — free to change:",
            "- Color and surface finish: unless the creative brief explicitly names a specific color, choose a new palette that fits the style",
            "- Background and environment",
            "- Lighting setup",
            "- Camera angle and composition",
            `COLOR RULE: Select a palette coherent with the creative style "${styleContext}".`,
            "Style palette guidance — Luxury/Editorial: matte black, graphite, gold;",
            "Premium Tech: silver, black, electric blue;",
            "Marketplace: white, black, blue;",
            "Sport: red, black, yellow.",
            `CREATIVE CONTEXT: ${sceneInstruction}`,
            "FULL PRODUCT VISIBLE — MANDATORY FRAMING: The entire product must be completely visible inside the frame. Do NOT crop any part of the product. Leave generous safe margins around all sides. Do NOT allow wheels, mirrors, handlebars, seat, antennas, accessories or any structural element to touch or exceed the frame edges. Product must fit entirely within the image with clear space on all sides. Centered composition. Commercial catalog framing. No partial product. No cropped elements.",
            "STRICT PROHIBITIONS: no human body parts, no hands, no arms, no legs, no faces, no partial persons; no objects unrelated to the product; no extra items not present in the reference; no deformations; no distortions; no blurry elements; no text; no logos; no watermarks.",
            "OUTPUT: photorealistic, commercial photography quality, magazine-ready.",
          ].join(" ");
          return editImageFromBuffer(referenceBuffer, editPrompt, mapFormatToSize(concept.format));
        }
        return generateImageBuffer(concept.imagePrompt, mapFormatToSize(concept.format));
      }),
    );

    const hasAtLeastOneImage = imageResults.some((r) => r.status === "fulfilled");

    if (!hasAtLeastOneImage) {
      sendSSEError(
        res,
        "Não foi possível gerar as imagens. Nenhum crédito foi descontado.",
      );
      return;
    }

    const conceptsWithImages = enrichedConcepts.map((concept, i) => {
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
      ...textResult,
      concepts: conceptsWithImages,
    };

    sendSSE(res, { type: "result", data: finalResult });
    await logAiUsage({ clerkUserId, action: `Criativos gerados: ${params.prompt.slice(0, 50)}`, module: "creative" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    sendSSEError(res, msg);
    return;
  }

  sendSSEDone(res);
}
