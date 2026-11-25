import { Router, type IRouter } from "express";
import { eq, and, desc, isNull, isNotNull, lt } from "drizzle-orm";
import { db, savedPromptsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod/v4";
import { semanticNormalize } from "../lib/ai/semanticNormalize.js";

const router: IRouter = Router();

const TRASH_TTL_MS = 48 * 60 * 60 * 1000;

const CreatePromptBody = z.object({
  title: z.string().min(1).max(120),
  prompt: z.string().min(1).max(4000),
  module: z.string().min(1),
});

// ── GET /prompts — only active (not in trash) ─────────────────────────────────
router.get("/prompts", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const module = req.query.module as string | undefined;

  const conditions = module
    ? and(
        eq(savedPromptsTable.clerkUserId, clerkUserId),
        eq(savedPromptsTable.module, module),
        isNull(savedPromptsTable.deletedAt),
      )
    : and(
        eq(savedPromptsTable.clerkUserId, clerkUserId),
        isNull(savedPromptsTable.deletedAt),
      );

  const items = await db
    .select()
    .from(savedPromptsTable)
    .where(conditions)
    .orderBy(desc(savedPromptsTable.createdAt))
    .limit(100);

  res.json(items);
});

// ── GET /prompts/trash — items in trash (purges expired first) ────────────────
router.get("/prompts/trash", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const now = new Date();

  await db
    .delete(savedPromptsTable)
    .where(
      and(
        eq(savedPromptsTable.clerkUserId, clerkUserId),
        isNotNull(savedPromptsTable.expiresAt),
        lt(savedPromptsTable.expiresAt, now),
      ),
    );

  const items = await db
    .select()
    .from(savedPromptsTable)
    .where(
      and(
        eq(savedPromptsTable.clerkUserId, clerkUserId),
        isNotNull(savedPromptsTable.deletedAt),
      ),
    )
    .orderBy(desc(savedPromptsTable.deletedAt))
    .limit(200);

  res.json(items);
});

// ── POST /prompts ─────────────────────────────────────────────────────────────
router.post("/prompts", requireAuth, requirePlan(["pro", "business", "agency"]), async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = CreatePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { title, prompt, module } = parsed.data;
  const [created] = await db
    .insert(savedPromptsTable)
    .values({ clerkUserId, title, prompt, module })
    .returning();
  res.status(201).json(created);
});

const TIPO_TO_MODULE: Record<string, string> = {
  imagem: "creative",
  video: "video_script",
  copy: "campaign",
  anuncio: "campaign",
  marketplace: "content",
  pesquisa: "product_discovery",
  estrategia: "campaign",
  automacao: "content",
  personalizado: "content",
};

const TIPO_CONTEXT: Record<string, string> = {
  imagem: "prompt para geração de imagem publicitária",
  video: "prompt para geração de vídeo publicitário",
  copy: "prompt para copywriting de alta conversão",
  anuncio: "prompt para anúncio pago",
  marketplace: "prompt para listagem em marketplace",
  pesquisa: "prompt para pesquisa de mercado",
  estrategia: "prompt para estratégia de vendas",
  automacao: "prompt para automação de marketing",
  personalizado: "prompt profissional, reutilizável e bem estruturado",
};

const TYPE_RULES: Record<string, string> = {
  imagem: `
Para IMAGEM, atue como diretor de arte, fotógrafo publicitário e especialista em composição visual.
Antes de escrever, interprete silenciosamente: objeto/produto, intenção comercial ou emocional, público provável, benefício central e melhor direção criativa.
Se a entrada for curta ou ambígua, complete o briefing com escolhas plausíveis e úteis, sem inventar especificações técnicas do produto, certificações, marcas ou promessas não informadas.
Não use automaticamente neon, fundo escuro, luxo, pedestal, luz dramática ou estética futurista. Escolha esses elementos somente quando combinarem com o assunto. Varie de verdade entre direções como editorial, lifestyle, minimalista, natural, industrial, artesanal, documental, elegante, divertida, técnica, emocional ou promocional.
O prompt final deve conter, quando fizer sentido: Contexto; Direção criativa; Instruções de composição; sujeito e posição; ambiente e fundo; espaço negativo; enquadramento e lente; iluminação; paleta; materiais e texturas; estilo fotográfico; apelo emocional; restrições; critérios de qualidade.
Priorize coerência entre produto, cenário, público e objetivo. Evite elementos genéricos ou decorativos que roubem a atenção do assunto.
Não peça textos, logotipos ou marcas visíveis, salvo quando o usuário solicitar explicitamente.`,
  video: `
Para VÍDEO, atue como diretor criativo, roteirista, diretor de fotografia e especialista em movimento.
Antes de escrever, interprete silenciosamente: assunto, objetivo, público provável, formato de comunicação e emoção desejada.
Se a entrada for curta, escolha uma ideia narrativa forte e coerente. Não transforme apenas um prompt de imagem em vídeo; construa progressão temporal.
O prompt final deve conter, quando fizer sentido: conceito e objetivo; duração e formato sugeridos; gancho inicial; sequência clara de cenas; ações do produto ou personagem; movimentos de câmera; enquadramentos; transições; ritmo; ambiente; iluminação; paleta; efeitos visuais coerentes; som, fala ou legenda apenas quando úteis; encerramento e CTA; continuidade visual; restrições e critérios de qualidade.
Evite repetir sempre câmera lenta, partículas, neon, fumaça, zoom dramático ou transições rápidas. Use efeitos somente quando reforçarem a intenção.
Mantenha personagens, produto, cores e cenário consistentes entre as cenas.`,
  copy: `
Para COPY, interprete oferta, público, dor, desejo, nível de consciência e objeção principal. Produza uma instrução capaz de gerar headline, argumento, benefícios, prova, tratamento de objeções e CTA, sem promessas enganosas.`,
  anuncio: `
Para ANÚNCIO, interprete produto, público, objetivo, canal e estágio do funil. Estruture ângulo, mensagem, conceito criativo, formato, variações e CTA, evitando afirmações não comprovadas.`,
  marketplace: `
Para MARKETPLACE, interprete produto, categoria, comprador e diferenciais. Estruture título, descrição, benefícios, especificações disponíveis, palavras-chave e tratamento de objeções, sem inventar características.`,
  pesquisa: `
Para PESQUISA, interprete mercado, público, hipótese e decisão desejada. Estruture demanda, concorrência, tendências, riscos, oportunidades, fontes e critérios de conclusão.`,
  estrategia: `
Para ESTRATÉGIA, interprete objetivo, público, oferta, canais, recursos e restrições. Estruture posicionamento, funil, aquisição, conversão, retenção, métricas e prioridades.`,
  automacao: `
Para AUTOMAÇÃO, interprete objetivo, gatilho, público, dados disponíveis e resultado esperado. Estruture sequência, condições, segmentação, mensagens, exceções, métricas e segurança operacional.`,
  personalizado: `
Para PERSONALIZADO, identifique a intenção real do usuário e construa uma instrução especializada, completa, prática e reutilizável para aquela finalidade.`,
};

const GeneratePromptBody = z.object({
  tipo: z.string().min(1).max(50),
  subject: z.string().min(1).max(3000),
});

router.post("/prompts/generate", requireAuth, requirePlan(["pro", "business", "agency"]), async (req, res): Promise<void> => {
  const parsed = GeneratePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  const { tipo, subject: rawSubject } = parsed.data;
  const subject = semanticNormalize(rawSubject.trim());
  const tipoKey = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
  const module = TIPO_TO_MODULE[tipoKey] ?? "content";
  const tipoCtx = TIPO_CONTEXT[tipoKey] ?? "prompt profissional reutilizável";
  const typeRules = TYPE_RULES[tipoKey] ?? TYPE_RULES.personalizado;

  const systemMsg = `Você cria prompts de nível profissional para marketing, conteúdo e negócios digitais em português brasileiro.

Sua tarefa é transformar SOMENTE a solicitação atual em um ${tipoCtx}. Não reutilize assunto, estética, produto, cenário ou instruções de pedidos anteriores. Cada execução começa limpa.

SOLICITAÇÃO ATUAL:
${subject}

PROCESSO INTERNO OBRIGATÓRIO (não mostre ao usuário):
1. Separe fatos fornecidos de detalhes que precisam ser inferidos.
2. Identifique a intenção real, mesmo quando a entrada tiver apenas poucas palavras.
3. Considere pelo menos três direções possíveis e escolha silenciosamente a mais coerente, específica e útil.
4. Verifique se a direção escolhida não repete clichês sem necessidade.
5. Construa o prompt final com detalhes acionáveis, sem contradizer os fatos fornecidos.

${typeRules}

REGRAS GERAIS:
- Preserve nomes, características e restrições informadas pelo usuário.
- Não invente preço, composição, certificação, desempenho, garantia ou alegação de saúde.
- Não mencione que fez inferências nem explique seu raciocínio.
- O resultado deve ser imediatamente reutilizável e específico para a solicitação atual.
- Use entre 140 e 420 palavras para Imagem ou Vídeo; entre 100 e 320 palavras para os demais tipos.
- Use seções com títulos claros quando isso melhorar a execução.
- Não use placeholders como [produto], [nicho], [público] ou campos para preencher.
- Não inclua múltiplos prompts concorrentes: entregue a melhor direção final, completa e coerente.

Responda exatamente neste formato, sem colchetes e sem comentários adicionais:
TITULO: título específico e profissional
PROMPT: prompt completo`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: `Tipo selecionado: ${tipo}\nUse exclusivamente a solicitação atual descrita no sistema.` },
      ],
      max_completion_tokens: 4000,
    });

    const raw = (completion.choices[0]?.message?.content ?? "").trim();

    const titleMatch = raw.match(/^TITULO:\s*(.+)/m);
    const promptMatch = raw.match(/PROMPT:\s*([\s\S]+)$/m);

    if (!titleMatch?.[1] || !promptMatch?.[1]) {
      req.log.error({ raw }, "prompts/generate: unexpected model output format");
      res.status(500).json({ error: "Falha ao gerar prompt. Tente novamente." });
      return;
    }

    res.json({
      title: titleMatch[1].trim().slice(0, 120),
      prompt: promptMatch[1].trim(),
      module,
    });
  } catch (err) {
    req.log.error({ err }, "prompts/generate: openai error");
    res.status(500).json({ error: "Falha ao gerar prompt. Tente novamente." });
  }
});

const UpdatePromptBody = z.object({
  title: z.string().min(1).max(120),
  prompt: z.string().min(1).max(4000),
});

router.put("/prompts/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id as string, 10);
  const parsed = UpdatePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { title, prompt } = parsed.data;
  const [updated] = await db
    .update(savedPromptsTable)
    .set({ title, prompt })
    .where(and(eq(savedPromptsTable.id, id), eq(savedPromptsTable.clerkUserId, clerkUserId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

// ── DELETE /prompts/:id — soft delete (move to trash, 48h TTL) ────────────────
router.delete("/prompts/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id as string, 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRASH_TTL_MS);
  await db
    .update(savedPromptsTable)
    .set({ deletedAt: now, expiresAt })
    .where(and(eq(savedPromptsTable.id, id), eq(savedPromptsTable.clerkUserId, clerkUserId)));
  res.json({ ok: true });
});

// ── POST /prompts/:id/restore — restore from trash ────────────────────────────
router.post("/prompts/:id/restore", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id as string, 10);
  await db
    .update(savedPromptsTable)
    .set({ deletedAt: null, expiresAt: null })
    .where(and(eq(savedPromptsTable.id, id), eq(savedPromptsTable.clerkUserId, clerkUserId)));
  res.json({ ok: true });
});

// ── DELETE /prompts/:id/permanent — permanent delete ──────────────────────────
router.delete("/prompts/:id/permanent", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id as string, 10);
  await db
    .delete(savedPromptsTable)
    .where(and(eq(savedPromptsTable.id, id), eq(savedPromptsTable.clerkUserId, clerkUserId)));
  res.json({ ok: true });
});

export default router;
