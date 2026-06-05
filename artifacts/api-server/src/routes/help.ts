import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from "../lib/ai/stream.js";
import { getRelevantContext, type HistoryMessage } from "../lib/help/knowledge/index.js";
import { db, helpMessages } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o IAttom, assistente especialista do IAttom Assist — plataforma de IA para negócios digitais.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMO PROCESSAR CADA PERGUNTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Antes de responder, identifique internamente o que o usuário quer alcançar. Nunca escreva essa identificação na resposta.

Quando o usuário quer entender algo:
Comece pelo para que serve e qual problema resolve. Só detalhe o que for relevante.

Quando o usuário quer comparar opções:
Diferenças práticas + quando usar cada um + recomendação objetiva.

Quando o usuário quer saber o que fazer:
Resposta direta com justificativa concisa.

Quando o usuário quer um passo a passo:
Sequência natural — o que ele faz em cada momento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOM E ESTILO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Responda como alguém que conhece profundamente o produto e está conversando.

PROIBIDO NO OUTPUT:
- Rótulos de intenção: "Intenção: ORIENTAÇÃO" etc.
- Títulos de estrutura: "Propósito/benefício", "Mecanismo"
- Cabeçalhos que pareçam de documento ou relatório
- Siglas ou nomenclaturas técnicas inventadas que não façam parte da documentação oficial do IAttom Assist
  (exemplos proibidos: "MITS", "MITs", "MIT" como framework, "OKR", "PDCA" ou qualquer sigla não citada no contexto)
- Para expressar priorização ou tarefas importantes: escreva SEMPRE por extenso —
  "tarefas mais importantes", "prioridades do dia", "ações de maior impacto", "itens prioritários"
  NUNCA use siglas inventadas para isso

INÍCIO DE RESPOSTA:
Comece diretamente pelo conteúdo. Nunca pela descrição técnica do módulo.

CONVERSAÇÃO CONTÍNUA:
Use o histórico naturalmente. Perguntas como "E a Shopee?", "Qual a diferença?", "E o TikTok?" devem ser respondidas sem pedir que o usuário repita o contexto anterior.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPRIMENTO E FORMATO (OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Seja conciso. Respostas curtas e diretas são SEMPRE preferidas.

- Pergunta direta → 2 a 4 linhas. Nunca mais que isso sem necessidade real.
- Orientação ("o que faço?", "por onde começo?") → 2 a 3 passos práticos, sem introdução.
- Comparação → 3 a 4 linhas por opção + recomendação direta.
- Caminho/sequência → máximo 5 etapas numeradas, uma linha cada.
- Não repita o que o usuário disse. Não parafraseie. Vá direto ao ponto.
- Use listas apenas quando há 3+ itens distintos que se beneficiam de listagem.
- Se a resposta passar de 8 linhas, foi longa demais — revise antes de responder.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROADMAP E INDISPONÍVEIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ROADMAP — ainda não disponível]: explique o que será e informe que ainda não está disponível.
[NÃO DISPONÍVEL NO IATTOM ASSIST]: informe diretamente e oriente para alternativa próxima.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS ABSOLUTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Responda APENAS com base no contexto fornecido.
2. Nunca invente funcionalidades, integrações, preços, fluxos ou promessas.
3. Nunca use informações de fora da base oficial do IAttom Assist.
4. Se a informação genuinamente não existir no contexto: "Esse assunto não faz parte do foco do IAttom Assist. Posso ajudar com negócios, vendas, marketing, campanhas, conteúdo, produtos digitais, marketplaces, automações e uso da plataforma."
5. Responda em português brasileiro. Sem emojis.`;

const OUT_OF_SCOPE_INSTRUCTION = `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ESPECIAL — FORA DO ESCOPO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esta pergunta não está relacionada ao foco do IAttom Assist.
Responda educadamente, em UMA frase, redirecionando o usuário:
"Esse assunto não faz parte do foco do IAttom Assist. Posso ajudar com negócios, vendas, marketing, criação de conteúdo, campanhas, produtos digitais, marketplaces, automações e uso da plataforma."
Não elabore. Apenas redirecione.`;

// ── Helper: continuation detection ───────────────────────────────────────────

const CONTINUATION_RE =
  /^(continua|continue|continuar|segue|seguir|e aí|o que mais|mais\b|e depois|incompleto|cortou|ficou incompleto|resposta incompleta|não completou|pode continuar|prossiga|faltou|faltou parte|faltou algo|termina|terminar|completa|completar)\b/i;

function detectContinuation(message: string): boolean {
  return CONTINUATION_RE.test(message.trim());
}

function buildContinuationPrompt(lastAssistantContent: string): string {
  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO CONTINUAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário quer que você continue a resposta anterior. Continue diretamente do ponto onde parou, sem repetir o que já foi dito, sem introdução. Comece com "Continuando..." e prossiga a partir daqui:

${lastAssistantContent}`;
}

// ── Helper: significant term extractor (Correção 3A) ────────────────────────
// Keeps: uppercase siglas ≥2 chars (MIT, MITS, API, URL, OAuth).
// Keeps: words ≥6 chars that aren't Portuguese stopwords.
// Filters: short common words ("não", "que", "uma") that caused false positives.

const STOPWORDS_PT = new Set([
  "não", "que", "uma", "uns", "umas", "como", "mais", "isso", "esta", "este",
  "para", "por", "com", "sem", "mas", "seu", "sua", "tem", "são", "foi", "pode",
  "vai", "ser", "ter", "nos", "era", "ele", "ela", "você", "voce", "sabe", "qual",
  "quando", "onde", "quem", "esse", "essa", "dos", "das", "aos", "sobre", "muito",
  "algum", "alguma", "nunca", "sempre", "ainda", "aqui", "apenas", "sim", "então",
  "agora", "depois", "antes", "bem", "tudo", "cada", "outro", "outra", "mesmo",
  "mesma", "todo", "toda", "todos", "todas", "tinha", "fazer", "feito", "veio",
  "disse", "disso", "nesse", "nessa", "pelos", "pelas", "desse", "dessa", "fosse",
]);

function extractSignificantTerms(query: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of query.split(/\s+/)) {
    const word = raw.replace(/[^\wÀ-ÿA-Z]/g, "");
    if (!word) continue;
    // Uppercase siglas (MIT, MITS, API, URL …)
    if (/^[A-Z]{2,}$/.test(word)) {
      if (!seen.has(word)) { seen.add(word); result.push(word); }
      continue;
    }
    // Long meaningful words (≥6 chars, not a stopword)
    const lower = word.toLowerCase();
    if (word.length >= 6 && !STOPWORDS_PT.has(lower) && !seen.has(lower)) {
      seen.add(lower);
      result.push(lower);
    }
  }
  return result;
}

// ── Helper: detect "asking about term from history" patterns (Correção 3A) ──
// Catches: "o que significa X", "o que é X", "esse termo", "o que você quis dizer", etc.

const ASK_ABOUT_TERM_RE =
  /\b(o que (significa|é|quer dizer|quis dizer|se refere)|essa palavra|esse termo|esses termos|que palavra|que termo|significado|definição|define|não entendi|o que você quis|o que quer dizer|quis dizer|quer dizer|pode explicar|me explica|me explicar|explica isso|explica esse|explica essa)\b/i;

function isAskingAboutTerm(query: string): boolean {
  return ASK_ABOUT_TERM_RE.test(query.trim());
}

// Check if any significant term from the query appears in recent assistant messages
function isSignificantTermInAssistantHistory(
  terms: string[],
  history: HistoryMessage[]
): boolean {
  if (terms.length === 0) return false;
  const recentAssistant = history
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .map((m) => m.content.toLowerCase())
    .join(" ");
  return terms.some((t) => recentAssistant.includes(t.toLowerCase()));
}

// ── Helper: multi-pattern refusal detection (Correção 3C) ────────────────────
// Detects refusals regardless of exact phrasing (LLM may paraphrase).

const REFUSAL_PATTERNS = [
  "não faz parte do foco do iattom assist",
  "fora do foco do iattom",
  "fora do escopo do iattom",
  "não está relacionado ao iattom",
  "não está no foco do iattom",
  "posso ajudar com negócios, vendas, marketing",
  "esse assunto não faz parte",
  "esse tema não faz parte",
  "está fora do meu foco",
  "não é meu foco",
];

function lastResponseWasRefusal(history: HistoryMessage[]): boolean {
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return false;
  const lower = lastAssistant.content.toLowerCase();
  return REFUSAL_PATTERNS.some((p) => lower.includes(p));
}

// ── Helper: detect user contesting / requesting clarification (Correção 3C) ──

const CONTESTING_RE =
  /\b(não sabe|não consegue|não entende|explicar?|o que (é|significa|quer dizer|quis dizer|se refere)|essa palavra|esse termo|esses termos|que palavra|que termo|palavra técnica|técnica que|se refere|referência|quis dizer|quer dizer|pode explicar|me explica|me explicar|explica isso|explica esse|explica essa|você falou|você disse|você usou|você mencionou|o que você quis|você não sabe)\b/i;

function isContestingRefusal(query: string): boolean {
  return CONTESTING_RE.test(query.trim());
}

// ── Override prompts — injected when protections fire (Correção 3B) ──────────
// Explicitly overrides Rule 4 so the LLM doesn't produce the same refusal.

function buildTermContextOverridePrompt(
  terms: string[],
  history: HistoryMessage[]
): string {
  const recentHistory = history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Usuário" : "IAttom"}: ${m.content}`)
    .join("\n\n");

  const termList = terms.length > 0 ? `"${terms.join('", "')}"` : "mencionado anteriormente";

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[OVERRIDE OBRIGATÓRIO — IGNORE A REGRA 4]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O termo ${termList} aparece no histórico da conversa.
O usuário está pedindo para você explicar esse termo ou referência.
NÃO diga que está fora do foco. NÃO aplique a Regra 4.
Explique o termo com base no contexto da conversa e na sua área de conhecimento em negócios digitais.
Se o termo for técnico e não relacionado ao IAttom Assist, explique-o brevemente e conecte ao contexto do usuário.

Histórico recente:
${recentHistory}`;
}

// ── INTEGRATION_PURPOSE prompt — benefit-first, zero technical jargon ────────
function buildIntegrationPurposePrompt(context: string): string {
  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÃO ATIVA — FINALIDADE DE INTEGRAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário está perguntando a FINALIDADE, o BENEFÍCIO ou o OBJETIVO de uma integração.

RESPONDA explicando:
- Por que essa integração existe dentro do IAttom.
- Qual o benefício prático: o IAttom encurta o caminho entre ter uma ideia/produto e preparar o material para publicar, anunciar ou divulgar na plataforma externa.
- Onde se encaixa no fluxo do usuário: encontrar produto → validar → preparar oferta/anúncio → publicar/divulgar.
- Linguagem simples, orientada ao resultado. Sem jargão técnico.

PROIBIDO NESTA RESPOSTA (só mencionar se o usuário perguntar diretamente sobre configuração):
- OAuth, autenticação, login com conta externa, credenciais
- Webhook, endpoint, callback, token, API
- Roadmap, disponível em breve, ainda não disponível
- Rota /dashboard/..., nome de módulo interno (Criar Campanha, Criar Conteúdo, Gerador Criativo)
- Status técnico da integração, integração indisponível
- Lista técnica de funcionalidades
- Qualquer sigla ou framework inventado (MITS, MITs, MIT, etc.)

CONTEXTO DO IATTOM ASSIST:
${context}`;
}

function buildRefusalLoopOverridePrompt(history: HistoryMessage[]): string {
  const recentHistory = history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Usuário" : "IAttom"}: ${m.content}`)
    .join("\n\n");

  return `${SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[OVERRIDE OBRIGATÓRIO — IGNORE A REGRA 4]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O usuário está contestando ou pedindo esclarecimento sobre a última resposta.
NÃO repita a recusa anterior. NÃO aplique a Regra 4 nesta resposta.

Opções (escolha a mais adequada ao contexto):
1. Se o usuário perguntou sobre um termo que você usou ou mencionou: explique esse termo.
2. Se a pergunta tem alguma relação com negócios, marketing, produtos, vendas ou automações: tente ajudar com o que sabe.
3. Se genuinamente não houver como ajudar: faça UMA pergunta curta e objetiva para entender melhor o contexto — ex: "Pode me contar em que contexto você encontrou esse termo?"

Histórico recente:
${recentHistory}`;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

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

  // ── Continuation detection ────────────────────────────────────────────────
  const isContinuation = detectContinuation(message);
  const lastAssistantContent =
    conversationHistory
      .filter((m) => m.role === "assistant")
      .slice(-1)[0]?.content ?? "";

  // ── Retrieval ──────────────────────────────────────────────────────────────
  let { context: relevantContext, outOfScope, intent } = getRelevantContext(
    message,
    conversationHistory
  );

  // ── Correção 3: Context + refusal loop protections ────────────────────────

  // Extract significant terms from query (siglas ≥2 UPPERCASE, words ≥6 non-stopword)
  const significantTerms = extractSignificantTerms(message);

  // Bloco 7 (improved): term used by assistant OR user is asking about a term
  const termInHistory = isSignificantTermInAssistantHistory(significantTerms, conversationHistory);
  const askingAboutTerm = isAskingAboutTerm(message);
  const isTermContext = outOfScope && (termInHistory || (askingAboutTerm && conversationHistory.length > 0));

  // Bloco 8 (improved): last response was refusal AND user is contesting it
  const wasRefusal = lastResponseWasRefusal(conversationHistory);
  const isContesting = isContestingRefusal(message);
  const isRefusalLoop = outOfScope && wasRefusal && (isContesting || askingAboutTerm);

  // ── Build system prompt ────────────────────────────────────────────────────
  let systemWithContext: string;

  if (isContinuation && lastAssistantContent) {
    // Continuation takes highest priority
    systemWithContext = buildContinuationPrompt(lastAssistantContent);
  } else if (isTermContext) {
    // Correção 3B: explicit override — do NOT apply Rule 4, explain the term
    systemWithContext = buildTermContextOverridePrompt(significantTerms, conversationHistory);
  } else if (isRefusalLoop) {
    // Correção 3C: explicit override — do NOT repeat the refusal
    systemWithContext = buildRefusalLoopOverridePrompt(conversationHistory);
  } else if (intent === "INTEGRATION_PURPOSE" && !outOfScope && relevantContext) {
    // Benefit-first response — technical details explicitly suppressed
    systemWithContext = buildIntegrationPurposePrompt(relevantContext);
  } else if (outOfScope) {
    systemWithContext = OUT_OF_SCOPE_INSTRUCTION;
  } else if (relevantContext) {
    systemWithContext = `${SYSTEM_PROMPT}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCONTEXTO OFICIAL DISPONÍVEL:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${relevantContext}`;
  } else {
    systemWithContext = `${SYSTEM_PROMPT}\n\nNenhum contexto específico encontrado. Use a regra 4 das regras absolutas.`;
  }

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

    let chunkCount = 0;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        sendSSE(res, { type: "chunk", content });
        chunkCount++;
      }
    }

    if (chunkCount === 0) {
      req.log.warn({ msg: "LLM returned empty response", path: req.path });
      sendSSEError(
        res,
        "Não consegui concluir essa resposta agora. Tente reformular a pergunta ou me diga seu objetivo dentro do IAttom Assist."
      );
      return;
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

// ── History: load ─────────────────────────────────────────────────────────────

router.get("/help/history", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Não autenticado." }); return; }

  try {
    const rows = await db
      .select()
      .from(helpMessages)
      .where(eq(helpMessages.clerkUserId, userId))
      .orderBy(asc(helpMessages.createdAt))
      .limit(100);

    res.json(rows.map((r) => ({ id: r.id, role: r.role, content: r.content })));
  } catch {
    req.log.error({ msg: "Error loading help history", userId });
    res.status(500).json({ error: "Erro ao carregar histórico." });
  }
});

// ── History: save exchange ────────────────────────────────────────────────────

router.post("/help/save", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Não autenticado." }); return; }

  const { userMessage, assistantMessage } = req.body as {
    userMessage?: string;
    assistantMessage?: string;
  };

  if (
    !userMessage || typeof userMessage !== "string" ||
    !assistantMessage || typeof assistantMessage !== "string"
  ) {
    res.status(400).json({ error: "userMessage e assistantMessage são obrigatórios." });
    return;
  }

  try {
    await db.insert(helpMessages).values([
      { clerkUserId: userId, role: "user",      content: userMessage.trim() },
      { clerkUserId: userId, role: "assistant", content: assistantMessage.trim() },
    ]);
    res.json({ ok: true });
  } catch {
    req.log.error({ msg: "Error saving help messages", userId });
    res.status(500).json({ error: "Erro ao salvar mensagem." });
  }
});

// ── History: clear ────────────────────────────────────────────────────────────

router.delete("/help/history", requireAuth, async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Não autenticado." }); return; }

  try {
    await db.delete(helpMessages).where(eq(helpMessages.clerkUserId, userId));
    res.json({ ok: true });
  } catch {
    req.log.error({ msg: "Error clearing help history", userId });
    res.status(500).json({ error: "Erro ao limpar histórico." });
  }
});

export default router;
