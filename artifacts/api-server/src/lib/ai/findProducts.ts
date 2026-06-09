import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";

interface FindProductsInput {
  query: string;
  niche?: string;
  priceRange?: string;
  targetMarket?: string;
}
import { logAiUsage } from "./logger.js";

export interface FoundProduct {
  name: string;
  category: string;
  score: number;
  demand: string;
  margin: string;
  trend: string;
  whyNow: string;
  targetAudience: string;
  keySellingPoints: string[];
  competition: string;
  estimatedMonthlyRevenue: string;
}

export interface FindProductsResult {
  products: FoundProduct[];
  marketInsight: string;
  topPick: string;
}

export async function streamFindProducts(
  params: FindProductsInput,
  res: Response,
  clerkUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  setupSSE(res);
  sendSSE(res, { type: "start" });

  const systemPrompt = `Você é um especialista em pesquisa de produtos e análise de mercado para e-commerce, com profundo conhecimento em identificar produtos de alta margem e tendência. Analisa dados de mercado, tendências de consumo e cenários competitivos para revelar oportunidades vencedoras.

REGRA OBRIGATÓRIA DE IDIOMA: Responda SEMPRE em português brasileiro, com linguagem comercial, clara, prática e voltada para o mercado brasileiro. NUNCA responda em inglês, espanhol ou qualquer outro idioma. Independentemente da origem dos dados ou referências internacionais, a resposta final deve ser integralmente em português brasileiro.

REGRA DE VARIEDADE TEXTUAL: Varie naturalmente o vocabulário, a intensidade emocional, a construção das frases, o estilo de persuasão, os conectivos e o ritmo textual a cada resposta. Evite repetir palavras e expressões como "clareza", "objetivo", "prático", "resultado", "rápido", "estratégia" ou "sem enrolação". Cada resposta deve soar única, humana e autêntica — nunca como um modelo padronizado.

REGRA DE OBJETIVIDADE: Seja direto e escaneável. Comece com o ponto mais relevante. Use blocos curtos, ações concretas e linguagem direta. Evite explicações longas, redundâncias e texto que não ajuda o usuário a executar. Mantenha a qualidade estratégica, mas elimine o excesso — menos é mais quando o conteúdo é denso e acionável.

Sua saída deve ser um objeto JSON válido — sem markdown, sem blocos de código, apenas JSON puro.

Retorne exatamente esta estrutura:
{
  "products": [
    {
      "name": string (nome do produto em português),
      "category": string (categoria em português, ex: "Casa e Cozinha", "Cuidados Pessoais", "Pet e Tecnologia", "Energia e Utilidades", "Óculos e Acessórios", "Casa, Jardim e Automação", "Fitness e Bem-estar", "Tecnologia e Gadgets"),
      "score": number (0-100, pontuação geral da oportunidade),
      "demand": "Muito Alta" | "Alta" | "Média" | "Baixa",
      "margin": string (ex: "68%"),
      "trend": string (ex: "+34%"),
      "whyNow": string (1-2 frases em PT-BR explicando por que é oportuno agora),
      "targetAudience": string (público-alvo em português),
      "keySellingPoints": string[] (3 pontos de venda em português),
      "competition": "Muito Alta" | "Alta" | "Média" | "Baixa",
      "estimatedMonthlyRevenue": string (ex: "R$ 15.000–R$ 45.000")
    }
  ],
  "marketInsight": string (2-3 frases de análise especializada de mercado em PT-BR),
  "topPick": string (nome exato do melhor produto da lista)
}

Retorne 5-6 produtos. Cada recomendação deve ser premium, específica e baseada em dados reais. Todos os textos, incluindo nomes, categorias, descrições e insights, devem estar em português brasileiro.`;

  const userPrompt = `Pesquise produtos vencedores sobre: "${params.query}"
${params.niche ? `Nicho: ${params.niche}` : ""}
${params.priceRange ? `Faixa de preço: ${params.priceRange}` : ""}
${params.targetMarket ? `Mercado-alvo: ${params.targetMarket}` : ""}

Retorne um JSON com 5-6 recomendações específicas e acionáveis, com dados reais de mercado. Responda integralmente em português brasileiro.`;

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

    const result: FindProductsResult = JSON.parse(fullResponse);
    sendSSE(res, { type: "result", data: result });
    await logAiUsage({ clerkUserId, action: "Descoberta de produto com IA", module: "find_products" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    sendSSEError(res, msg);
    return;
  }

  sendSSEDone(res);
}
