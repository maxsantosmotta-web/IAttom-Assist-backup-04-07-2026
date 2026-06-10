import { Router, type IRouter } from "express";
import { eq, and, desc, isNull, isNotNull, lt } from "drizzle-orm";
import { db, savedPromptsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod/v4";

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
router.post("/prompts", requireAuth, async (req, res): Promise<void> => {
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
  imagem: "prompt para geração de imagem publicitária — visual premium, composição, paleta, iluminação, estilo fotográfico, apelo emocional",
  video: "prompt para roteiro de vídeo de vendas — gancho, narrativa, benefícios, prova social, CTA",
  copy: "prompt para copywriting de alta conversão — headline, benefícios, objeções, urgência, CTA",
  anuncio: "prompt para anúncio pago (tráfego) — ângulo, público, plataforma, mensagem, formato",
  marketplace: "prompt para listagem em marketplace — título otimizado, descrição persuasiva, especificações, palavras-chave de busca",
  pesquisa: "prompt para pesquisa de mercado — demanda, concorrência, tendências, oportunidades, nicho",
  estrategia: "prompt para estratégia de vendas — posicionamento, funil, canal, precificação, diferenciação",
  automacao: "prompt para automação de marketing — sequência, segmentação, mensagens, gatilhos, métricas",
  personalizado: "prompt profissional, reutilizável e bem estruturado",
};

const GeneratePromptBody = z.object({
  tipo: z.string().min(1).max(50),
  subject: z.string().min(1).max(300),
});

router.post("/prompts/generate", requireAuth, async (req, res): Promise<void> => {
  const parsed = GeneratePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  const { tipo, subject } = parsed.data;
  const tipoKey = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
  const module = TIPO_TO_MODULE[tipoKey] ?? "content";
  const tipoCtx = TIPO_CONTEXT[tipoKey] ?? "prompt profissional reutilizável";

  const systemMsg = `Você é um especialista em criar prompts premium para sistemas de IA de marketing e negócios digitais em português brasileiro.

Antes de processar, interprete e corrija silenciosamente erros evidentes de digitação no assunto informado (ex: "markting" → "marketing", "empreendor" → "empreendedor"). Utilize sempre a forma correta no prompt gerado. Exceção: NÃO altere marcas, nomes próprios ou plataformas com grafia intencional (ex: IAttom, Hotmart, Shopee, Kiwify, Mercado Livre).

Crie um ${tipoCtx} sobre o assunto: ${subject}.

Regras obrigatórias:
- O prompt deve ser completo, profissional e imediatamente reutilizável
- Específico para o assunto informado, sem generalizações
- Entre 80 e 250 palavras
- Linguagem direta e profissional em português brasileiro
- Estruturado com contexto claro + instruções + critérios de qualidade
- Não usar placeholders como [produto] ou [nicho]

Responda exatamente neste formato, sem colchetes, sem explicações adicionais:
TITULO: escreva o título aqui
PROMPT: escreva o prompt completo aqui`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: `Tipo: ${tipo}\nAssunto: ${subject}` },
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
