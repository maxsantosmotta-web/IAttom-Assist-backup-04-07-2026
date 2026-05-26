import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";

interface CreativeIdeasInput {
  prompt: string;
  style?: string;
  product?: string;
  targetAudience?: string;
  formatPack?: string;
}
import { logAiUsage } from "./logger.js";

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

function getFormatPack(formatPack?: string): string[] {
  if (formatPack && FORMAT_PACKS[formatPack]) return FORMAT_PACKS[formatPack];
  return FORMAT_PACKS.social;
}

export async function streamCreativeIdeas(
  params: CreativeIdeasInput,
  res: Response,
  clerkUserId: string,
): Promise<void> {
  setupSSE(res);
  sendSSE(res, { type: "start" });

  const formats = getFormatPack(params.formatPack);
  const formatInstruction = `Os 4 conceitos devem usar exatamente estes formatos, nesta ordem: ${formats.map((f, i) => `conceito ${i + 1}: "${f}"`).join(", ")}.`;

  const systemPrompt = `Você é um diretor criativo de nível mundial para publicidade digital. Desenvolve conceitos criativos revolucionários que param o scroll, constroem desejo pela marca e geram conversões.

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
      "id": number (1-4),
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
  "brandVoiceNotes": string (guia de tom e mensagem da marca, em PT-BR)
}

Crie 4 conceitos criativos distintos. Cada um deve parecer que saiu de uma agência de ponta.`;

  const userPrompt = `Gere conceitos criativos premium para anúncios:
Briefing: "${params.prompt}"
${params.product ? `Produto: ${params.product}` : ""}
${params.style ? `Estilo visual: ${params.style}` : ""}
${params.targetAudience ? `Público-alvo: ${params.targetAudience}` : ""}

${formatInstruction}

INSTRUÇÃO CRÍTICA PARA imagePrompt: Se o briefing ou produto acima contiver nome de marca, modelo, nome comercial ou produto popular específico, use esse nome exato no imagePrompt e repita-o na descrição visual. Preserve as características físicas reconhecíveis do produto real. Não substitua por versão genérica. Use o nome comercial exato na frase de abertura do imagePrompt.

Crie 4 conceitos criativos visualmente impactantes, alinhados à marca e focados em conversão. Responda integralmente em português brasileiro.`;

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

    const imageResults = await Promise.allSettled(
      textResult.concepts.map((concept) =>
        generateImageBuffer(concept.imagePrompt, mapFormatToSize(concept.format)),
      ),
    );

    const hasAtLeastOneImage = imageResults.some((r) => r.status === "fulfilled");

    if (!hasAtLeastOneImage) {
      sendSSEError(
        res,
        "Não foi possível gerar as imagens. Nenhum crédito foi descontado.",
      );
      return;
    }

    const conceptsWithImages = textResult.concepts.map((concept, i) => {
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
