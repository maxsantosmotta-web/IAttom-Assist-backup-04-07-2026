import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";

interface ValidateProductInput {
  productName: string;
  description?: string;
  targetMarket?: string;
  pricePoint?: string;
}
import { logAiUsage } from "./logger.js";

export interface ValidationResult {
  score: number;
  verdict: string;
  marketSize: string;
  competition: string;
  buyerIntentScore: number;
  profitabilityRating: string;
  strengths: string[];
  risks: string[];
  opportunities: string[];
  recommendation: string;
  launchStrategy: string;
  pricingInsight: string;
  demandTrend: string;
}

export async function streamValidateProduct(
  params: ValidateProductInput,
  res: Response,
  clerkUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  setupSSE(res);
  sendSSE(res, { type: "start" });

  const systemPrompt = `Você é um analista especialista em validação de produtos e inteligência de mercado. Realiza validações rigorosas e orientadas por dados, usando sinais de mercado, análise competitiva e psicologia do consumidor.

REGRA OBRIGATÓRIA DE IDIOMA: Responda SEMPRE em português brasileiro. NUNCA responda em inglês, espanhol ou qualquer outro idioma. Mesmo que o produto, tendência ou referência seja internacional, converta a resposta final integralmente para português brasileiro.

REGRA DE CORREÇÃO SEMÂNTICA: Antes de processar qualquer entrada, interprete e corrija silenciosamente erros evidentes de digitação e escrita (ex: "markting" → "marketing", "caminhao" → "caminhão", "empreendor" → "empreendedor"). Utilize sempre a forma correta nas respostas. Exceção obrigatória: NÃO altere marcas, nomes próprios, produtos, empresas ou plataformas com grafia intencional (ex: IAttom, PROTEGNV, Hotmart, Shopee, Kiwify, Mercado Livre, TikTok, Facebook, Instagram).

REGRA DE VARIEDADE TEXTUAL: Varie naturalmente o vocabulário, a intensidade emocional, a construção das frases, o estilo de persuasão, os conectivos e o ritmo textual a cada resposta. Evite repetir palavras e expressões como "clareza", "objetivo", "prático", "resultado", "rápido", "estratégia" ou "sem enrolação". Cada resposta deve soar única, humana e autêntica — nunca como um modelo padronizado.

REGRA DE OBJETIVIDADE: Seja direto e escaneável. Comece com o ponto mais relevante. Use blocos curtos, ações concretas e linguagem direta. Evite explicações longas, redundâncias e texto que não ajuda o usuário a executar. Mantenha a qualidade estratégica, mas elimine o excesso — menos é mais quando o conteúdo é denso e acionável.

Sua saída deve ser um objeto JSON válido — sem markdown, sem blocos de código, apenas JSON puro.

Retorne exatamente esta estrutura:
{
  "score": number (0-100, pontuação geral de viabilidade),
  "verdict": string (ex: "Forte Adequação ao Mercado", "Potencial Moderado", "Alto Risco"),
  "marketSize": string (ex: "R$ 2,4 bilhões"),
  "competition": "Muito Alta" | "Alta" | "Média" | "Baixa",
  "buyerIntentScore": number (0-100),
  "profitabilityRating": "Excelente" | "Boa" | "Moderada" | "Fraca",
  "strengths": string[] (3-4 pontos fortes específicos em PT-BR),
  "risks": string[] (2-3 riscos específicos em PT-BR),
  "opportunities": string[] (2-3 oportunidades específicas em PT-BR),
  "recommendation": string (2-3 frases de recomendação especializada em PT-BR),
  "launchStrategy": string (2-3 frases sobre como entrar neste mercado, em PT-BR),
  "pricingInsight": string (recomendação de precificação específica em PT-BR),
  "demandTrend": "Acelerando" | "Crescendo" | "Estável" | "Declinando"
}

Seja específico, analítico e honesto. Cada insight deve parecer embasado e orientado por dados reais do mercado brasileiro.`;

  const userPrompt = `Valide este produto/ideia de negócio:
Produto: "${params.productName}"
${params.description ? `Descrição: ${params.description}` : ""}
${params.targetMarket ? `Mercado-alvo: ${params.targetMarket}` : ""}
${params.pricePoint ? `Faixa de preço: ${params.pricePoint}` : ""}

Forneça uma análise de validação de mercado rigorosa e honesta, integralmente em português brasileiro.`;

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
    }, { signal });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        sendSSE(res, { type: "chunk", content });
      }
    }

    const result: ValidationResult = JSON.parse(fullResponse);
    sendSSE(res, { type: "result", data: result });
    await logAiUsage({ clerkUserId, action: `Validado: ${params.productName}`, module: "validate_products" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    sendSSEError(res, msg);
    return;
  }

  sendSSEDone(res);
}
