import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";

interface CreateCampaignInput {
  product: string;
  audience?: string;
  goal?: string;
  platforms?: string[];
  budget?: string;
}
import { logAiUsage } from "./logger.js";

export interface CampaignResult {
  headline: string;
  subheadline: string;
  cta: string;
  audience: string;
  channels: string[];
  budget: string;
  copy: {
    facebook: string;
    instagram: string;
    google: string;
    email: string;
    tiktok: string;
  };
  keyMessages: string[];
  launchTimeline: string;
  uniqueAngle: string;
  objectionHandling: string;
}

export async function streamCreateCampaign(
  params: CreateCampaignInput,
  res: Response,
  clerkUserId: string,
): Promise<void> {
  setupSSE(res);
  sendSSE(res, { type: "start" });

  const systemPrompt = `Você é um estrategista de marketing de resposta direta de nível mundial. Cria campanhas que geram ROI mensurável, combinando gatilhos psicológicos com segmentação precisa para o mercado brasileiro.

REGRA OBRIGATÓRIA DE IDIOMA: Responda SEMPRE em português brasileiro. NUNCA responda em inglês, espanhol ou qualquer outro idioma. Todo o copy, títulos, CTAs, mensagens e textos de campanha devem estar integralmente em português brasileiro.

Sua saída deve ser um objeto JSON válido — sem markdown, sem blocos de código, apenas JSON puro.

Retorne exatamente esta estrutura:
{
  "headline": string (título impactante e focado em benefício, em PT-BR),
  "subheadline": string (declaração de apoio ao título, em PT-BR),
  "cta": string (chamada para ação convincente, em PT-BR),
  "audience": string (descrição precisa do público-alvo, em PT-BR),
  "channels": string[] (3-5 canais recomendados, em PT-BR),
  "budget": string (orçamento realista para o mercado brasileiro, curto e direto. Siga esta lógica obrigatória: pequenos negócios, afiliados, creators e iniciantes → R$300 a R$3.000/mês; negócios intermediários → R$3.000 a R$10.000/mês; operações agressivas/escaláveis → acima de R$10.000 somente se o objetivo justificar claramente. NUNCA sugira budgets enterprise sem justificativa. Priorize validação antes de escala. Explicação simples, sem excesso de detalhamento financeiro.),
  "copy": {
    "facebook": string (copy para anúncio no Facebook, 2-3 frases em PT-BR),
    "instagram": string (legenda para Instagram com gancho, em PT-BR),
    "google": string (título + descrição para Google Ads, em PT-BR),
    "email": string (assunto + pré-texto + abertura do e-mail, em PT-BR),
    "tiktok": string (gancho + direção de roteiro para TikTok, em PT-BR)
  },
  "keyMessages": string[] (3 mensagens principais da campanha, em PT-BR),
  "launchTimeline": string (sequência de lançamento recomendada, em PT-BR),
  "uniqueAngle": string (o ângulo de posicionamento único, em PT-BR),
  "objectionHandling": string (como lidar com a principal objeção, em PT-BR)
}

Todo o copy deve ser direto, focado em conversão e psicologicamente persuasivo. Sem linguagem genérica de marketing.`;

  const userPrompt = `Crie uma campanha de marketing completa para:
Produto/Marca: "${params.product}"
${params.audience ? `Público-alvo: ${params.audience}` : ""}
${params.goal ? `Objetivo da campanha: ${params.goal}` : "Gerar vendas"}
${params.platforms?.length ? `Plataformas preferidas: ${params.platforms.join(", ")}` : ""}
${params.budget ? `Orçamento: ${params.budget}` : ""}

Crie uma campanha completa e de alta conversão com copy específico para cada plataforma, integralmente em português brasileiro.`;

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

    const result: CampaignResult = JSON.parse(fullResponse);
    sendSSE(res, { type: "result", data: result });
    await logAiUsage({ clerkUserId, action: `Campaign created: ${params.product}`, module: "campaign" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    sendSSEError(res, msg);
    return;
  }

  sendSSEDone(res);
}
