import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";

interface CreativeIdeasInput {
  prompt: string;
  style?: string;
  product?: string;
  targetAudience?: string;
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

export async function streamCreativeIdeas(
  params: CreativeIdeasInput,
  res: Response,
  clerkUserId: string,
): Promise<void> {
  setupSSE(res);
  sendSSE(res, { type: "start" });

  const systemPrompt = `Você é um diretor criativo de nível mundial para publicidade digital. Desenvolve conceitos criativos revolucionários que param o scroll, constroem desejo pela marca e geram conversões.

REGRA OBRIGATÓRIA DE IDIOMA: Responda SEMPRE em português brasileiro. NUNCA responda em inglês, espanhol ou qualquer outro idioma. Todos os conceitos, textos, hooks, CTAs e direções visuais devem estar integralmente em português brasileiro.

REGRA DE VARIEDADE TEXTUAL: Varie naturalmente o vocabulário, a intensidade emocional, a construção das frases, o estilo de persuasão, os conectivos e o ritmo textual a cada resposta. Evite repetir palavras e expressões como "clareza", "objetivo", "prático", "resultado", "rápido", "estratégia" ou "sem enrolação". Cada resposta deve soar única, humana e autêntica — nunca como um modelo padronizado.

REGRA DE OBJETIVIDADE: Seja direto e escaneável. Comece com o ponto mais relevante. Use blocos curtos, ações concretas e linguagem direta. Evite explicações longas, redundâncias e texto que não ajuda o usuário a executar. Mantenha a qualidade estratégica, mas elimine o excesso — menos é mais quando o conteúdo é denso e acionável.

Sua saída deve ser um objeto JSON válido — sem markdown, sem blocos de código, apenas JSON puro.

Retorne exatamente esta estrutura:
{
  "concepts": [
    {
      "id": number (1-4),
      "label": string (nome do criativo em PT-BR, ex: "Banner Principal", "Story", "Produto em Destaque", "Prova Social"),
      "format": string (ex: "1080x1080 quadrado", "9:16 story", "16:9 banner"),
      "concept": string (1-2 frases descrevendo o conceito criativo, em PT-BR),
      "visualDirection": string (descrição visual detalhada para o designer, em PT-BR),
      "copyHook": string (headline/gancho de atenção, em PT-BR),
      "bodyText": string (texto de apoio, em PT-BR),
      "cta": string (texto do botão de chamada para ação, em PT-BR),
      "emotionalTrigger": string (emoção central sendo ativada, em PT-BR),
      "bestPlatform": string (onde este criativo funciona melhor, em PT-BR),
      "imagePrompt": string (prompt detalhado para geração de imagem IA — SEMPRE em inglês para compatibilidade com modelos de imagem. OBRIGATÓRIO: photorealistic, commercial quality, clean background, no text overlays, no logos, no watermarks, no brand names, no English words visible in the image, natural human anatomy, no extra fingers, no deformities, premium Brazilian commercial aesthetic, product-focused, high-end advertising style)
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
        generateImageBuffer(concept.imagePrompt, "1024x1024"),
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
