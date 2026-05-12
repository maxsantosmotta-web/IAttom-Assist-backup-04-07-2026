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

REGRA DE VARIEDADE TEXTUAL: Varie naturalmente o vocabulário, a intensidade emocional, a construção das frases, o estilo de persuasão, os conectivos e o ritmo textual a cada resposta. Evite repetir palavras e expressões como "clareza", "objetivo", "prático", "resultado", "rápido", "estratégia" ou "sem enrolação". Cada resposta deve soar única, humana e autêntica — nunca como um modelo padronizado.

REGRA DE OBJETIVIDADE: Seja direto e escaneável. Comece com o ponto mais relevante. Use blocos curtos, ações concretas e linguagem direta. Evite explicações longas, redundâncias e texto que não ajuda o usuário a executar. Mantenha a qualidade estratégica, mas elimine o excesso — menos é mais quando o conteúdo é denso e acionável.

REGRA DE COMPATIBILIDADE PRODUTO × PLATAFORMA: Antes de gerar a campanha, analise o nome do produto e o objetivo para inferir o tipo de produto (físico ou digital) e verifique a compatibilidade com a plataforma do objetivo. Use estas regras:
- Shopee e Mercado Livre → plataformas para produtos FÍSICOS. Produtos digitais (cursos, ebooks, templates, mentorias, SaaS, infoprodutos) são incompatíveis.
- Hotmart e Kiwify → plataformas para produtos DIGITAIS. Produtos físicos (roupas, eletrônicos, utensílios, cosméticos, alimentos) são incompatíveis.
- WhatsApp, Instagram, TikTok, Google, e-mail → compatíveis com qualquer tipo de produto.

Quando houver incompatibilidade detectada, OBRIGATORIAMENTE inicie o campo "uniqueAngle" com um aviso em PT-BR neste formato exato:
"⚠️ ATENÇÃO: [descrever incompatibilidade detectada]. [Sugerir 2-3 alternativas práticas como: transformar em produto digital, atuar como afiliado, migrar para plataforma mais adequada]. A campanha abaixo foi gerada mesmo assim — você pode continuar ou ajustar o objetivo."

Depois do aviso, adicione uma linha em branco e continue com o ângulo de posicionamento normal. A geração da campanha NUNCA deve ser bloqueada — sempre gere a campanha completa independentemente da compatibilidade.

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
  "uniqueAngle": string (se houver incompatibilidade: aviso PT-BR + linha em branco + ângulo de posicionamento; se compatível: apenas o ângulo de posicionamento, em PT-BR),
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
