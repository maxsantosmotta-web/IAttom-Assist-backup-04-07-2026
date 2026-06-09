import type { Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "./stream.js";

interface VideoScriptInput {
  product: string;
  format?: string;
  duration?: string;
  hook?: string;
  style?: string;
}
import { logAiUsage } from "./logger.js";

export interface ScriptScene {
  time: string;
  visual: string;
  script: string;
  emotion: string;
  direction: string;
}

export interface VideoScriptResult {
  title: string;
  duration: string;
  hooks: string[];
  scenes: ScriptScene[];
  voiceoverStyle: string;
  musicMood: string;
  editingPace: string;
  captionStyle: string;
  viralTrigger: string;
  distributionTips: string[];
}

export async function streamVideoScript(
  params: VideoScriptInput,
  res: Response,
  clerkUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  setupSSE(res);
  sendSSE(res, { type: "start" });

  const duration = params.duration ?? "30s";
  const format = params.format ?? "anúncio padrão";

  const systemPrompt = `Você é um roteirista de vídeo de elite especializado em conteúdo viral e anúncios de alta conversão. Cria roteiros que capturam a atenção nos primeiros 3 segundos e geram ação ao final.

REGRA OBRIGATÓRIA DE IDIOMA: Responda SEMPRE em português brasileiro. NUNCA responda em inglês, espanhol ou qualquer outro idioma. Todos os roteiros, ganchos, cenas, direções e textos devem estar integralmente em português brasileiro.

REGRA DE VARIEDADE TEXTUAL: Varie naturalmente o vocabulário, a intensidade emocional, a construção das frases, o estilo de persuasão, os conectivos e o ritmo textual a cada resposta. Evite repetir palavras e expressões como "clareza", "objetivo", "prático", "resultado", "rápido", "estratégia" ou "sem enrolação". Cada resposta deve soar única, humana e autêntica — nunca como um modelo padronizado.

REGRA DE OBJETIVIDADE: Seja direto e escaneável. Comece com o ponto mais relevante. Use blocos curtos, ações concretas e linguagem direta. Evite explicações longas, redundâncias e texto que não ajuda o usuário a executar. Mantenha a qualidade estratégica, mas elimine o excesso — menos é mais quando o conteúdo é denso e acionável.

Sua saída deve ser um objeto JSON válido — sem markdown, sem blocos de código, apenas JSON puro.

Retorne exatamente esta estrutura:
{
  "title": string (nome criativo do roteiro, em PT-BR),
  "duration": string (ex: "30s", "60s"),
  "hooks": string[] (3 ganchos alternativos de abertura — os primeiros 3 segundos que param o scroll, em PT-BR),
  "scenes": [
    {
      "time": string (ex: "0-3s", "3-8s"),
      "visual": string (descrição detalhada do plano/cena, em PT-BR),
      "script": string (narração exata ou texto na tela, em PT-BR),
      "emotion": string (emoção a evocar neste momento, em PT-BR),
      "direction": string (notas de direção de atuação/filmagem, em PT-BR)
    }
  ],
  "voiceoverStyle": string (tom, ritmo e caráter da narração, em PT-BR),
  "musicMood": string (estilo musical e guia de andamento, em PT-BR),
  "editingPace": string (ritmo de corte e estilo de edição, em PT-BR),
  "captionStyle": string (estilo de legenda para acessibilidade/retenção, em PT-BR),
  "viralTrigger": string (o elemento-chave para gerar compartilhamentos/salvamentos, em PT-BR),
  "distributionTips": string[] (2-3 dicas de distribuição por plataforma, em PT-BR)
}

Escreva roteiros que pareçam produzidos para uma grande campanha de marca. Cada cena deve ter propósito claro e impacto emocional.`;

  const userPrompt = `Escreva um roteiro de vídeo para:
Produto/Marca: "${params.product}"
Formato: ${format}
Duração: ${duration}
${params.hook ? `Ideia de gancho: ${params.hook}` : ""}
${params.style ? `Estilo: ${params.style}` : ""}

Crie um roteiro completo e pronto para produção, com 4-6 cenas que maximizem a retenção do espectador e gerem conversões. Responda integralmente em português brasileiro.`;

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

    const result: VideoScriptResult = JSON.parse(fullResponse);
    sendSSE(res, { type: "result", data: result });
    await logAiUsage({ clerkUserId, action: `Script criado: ${params.product}`, module: "video_script" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    sendSSEError(res, msg);
    return;
  }

  sendSSEDone(res);
}
