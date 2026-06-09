import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";

interface CreateContentInput {
  topic: string;
  tone?: string;
  contentTypes?: string[];
  additionalContext?: string;
}
import { logAiUsage } from "./logger.js";

export interface ContentResult {
  blog: string;
  social: string;
  email: string;
  tweetThread: string;
  smsText: string;
  seoTitle: string;
  seoDescription: string;
}

export async function streamCreateContent(
  params: CreateContentInput,
  res: Response,
  clerkUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  setupSSE(res);
  sendSSE(res, { type: "start" });

  const toneInstruction = params.tone
    ? `Tom: ${params.tone}`
    : "Tom: direto, denso e humano — com autoridade sem frieza";

  const systemPrompt = `Você é um copywriter de elite e estrategista de conteúdo para marcas e negócios digitais no Brasil. Cria conteúdo que converte visitantes em compradores, usando storytelling, prova social e gatilhos psicológicos.

REGRA OBRIGATÓRIA DE IDIOMA: Responda SEMPRE em português brasileiro. NUNCA responda em inglês, espanhol ou qualquer outro idioma. Todo o conteúdo — blog, redes sociais, e-mail, SMS e SEO — deve estar integralmente em português brasileiro.

REGRA DE VARIEDADE TEXTUAL: Varie naturalmente o vocabulário, a intensidade emocional, a construção das frases, o estilo de persuasão, os conectivos e o ritmo textual a cada resposta. Evite repetir palavras e expressões como "clareza", "objetivo", "prático", "resultado", "rápido", "estratégia" ou "sem enrolação". Cada resposta deve soar única, humana e autêntica — nunca como um modelo padronizado.

REGRA DE OBJETIVIDADE: Seja direto e escaneável. Comece com o ponto mais relevante. Use blocos curtos, ações concretas e linguagem direta. Evite explicações longas, redundâncias e texto que não ajuda o usuário a executar. Mantenha a qualidade estratégica, mas elimine o excesso — menos é mais quando o conteúdo é denso e acionável.

Sua saída deve ser um objeto JSON válido — sem markdown, sem blocos de código, apenas JSON puro.

Retorne exatamente esta estrutura:
{
  "blog": string (artigo de blog completo, 400-600 palavras, com seções, envolvente e otimizado para SEO, em PT-BR),
  "social": string (legenda para Instagram/Facebook com gancho, corpo, CTA e hashtags, em PT-BR),
  "email": string (e-mail completo: assunto, pré-texto e corpo completo com abertura, meio e CTA, em PT-BR),
  "tweetThread": string (thread de 3-5 tweets, cada um em nova linha começando com número, em PT-BR),
  "smsText": string (mensagem de SMS marketing, máx 160 caracteres, em PT-BR),
  "seoTitle": string (título SEO da página, máx 60 caracteres, em PT-BR),
  "seoDescription": string (meta descrição, máx 155 caracteres, em PT-BR)
}

Escreva conteúdo que pareça criado por um copywriter veterano — específico, persuasivo e humano.`;

  const userPrompt = `Crie um conjunto completo de conteúdo para:
Tema/Produto: "${params.topic}"
${toneInstruction}
${params.additionalContext ? `Contexto: ${params.additionalContext}` : ""}
${params.contentTypes?.length ? `Conteúdo prioritário: ${params.contentTypes.join(", ")}` : ""}

Cada peça deve parecer premium, específica para a marca e pronta para publicação. Responda integralmente em português brasileiro.`;

  let fullResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 6000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      stream: true,
    }, { signal });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        sendSSE(res, { type: "chunk", content });
      }
    }

    const result: ContentResult = JSON.parse(fullResponse);
    sendSSE(res, { type: "result", data: result });
    await logAiUsage({ clerkUserId, action: `Conteúdo criado: ${params.topic}`, module: "content" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    sendSSEError(res, msg);
    return;
  }

  sendSSEDone(res);
}
