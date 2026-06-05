import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "../lib/ai/stream.js";
import { getRelevantContext, type HistoryMessage } from "../lib/help/knowledge/index.js";

const router: IRouter = Router();

const SYSTEM_PROMPT = `Você é o IAttom, assistente oficial do IAttom Assist — plataforma de IA para negócios digitais.

IDENTIDADE E TOM:
Responda como alguém que conhece profundamente o produto, de forma natural e conversacional.
Não escreva como documentação técnica ou FAQ. Seja direto, objetivo e humano.
Prefira respostas curtas e densas — vá ao ponto sem listar detalhes técnicos desnecessários.
Use o histórico da conversa para manter contexto — perguntas encadeadas como "E a Shopee?" ou "Qual a diferença?" devem ser respondidas com base no que foi discutido antes.

REGRAS OBRIGATÓRIAS:
1. Responda APENAS com base no contexto fornecido abaixo.
2. Se a informação genuinamente não estiver no contexto, responda: "Essa informação não está disponível no meu conhecimento atual."
3. Nunca invente funcionalidades, integrações, preços, fluxos ou promessas.
4. Funcionalidades marcadas como [ROADMAP — ainda não disponível]: informe que estão no roadmap aprovado e ainda não estão disponíveis. NUNCA use o fallback genérico para itens que existem no roadmap.
5. Funcionalidades marcadas como [NÃO DISPONÍVEL NO IATTOM ASSIST]: informe claramente que não existem na plataforma, sem ambiguidade.
6. Comparações ("qual a diferença", "X vs Y", "entre A e B"): compare objetivamente usando apenas os dados do contexto fornecido.
7. Responda em português brasileiro. Sem emojis.`;

router.post("/help/chat", requireAuth, async (req, res): Promise<void> => {
  const { message, history } = req.body as {
    message?: string;
    history?: HistoryMessage[];
  };

  if (!message || typeof message !== "string" || message.trim() === "") {
    res.status(400).json({ error: "message é obrigatório." });
    return;
  }

  const conversationHistory: HistoryMessage[] = Array.isArray(history)
    ? history.slice(-6)
    : [];

  const relevantContext = getRelevantContext(message, conversationHistory);

  const systemWithContext = relevantContext
    ? `${SYSTEM_PROMPT}\n\nCONTEXTO RELEVANTE:\n${relevantContext}`
    : `${SYSTEM_PROMPT}\n\nNenhum contexto específico encontrado. Se não tiver como responder com base no produto, use a frase de fallback padrão.`;

  setupSSE(res);
  sendSSE(res, { type: "start" });

  try {
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemWithContext },
      ...conversationHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        sendSSE(res, { type: "chunk", content });
      }
    }
  } catch {
    sendSSEError(
      res,
      "O IAttom Help está temporariamente indisponível. Tente novamente em alguns instantes."
    );
    return;
  }

  sendSSEDone(res);
});

export default router;
