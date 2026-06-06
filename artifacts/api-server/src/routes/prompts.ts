import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, savedPromptsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod/v4";

const router: IRouter = Router();

const CreatePromptBody = z.object({
  title: z.string().min(1).max(120),
  prompt: z.string().min(1).max(4000),
  module: z.string().min(1),
});

router.get("/prompts", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const module = req.query.module as string | undefined;

  const conditions = module
    ? and(eq(savedPromptsTable.clerkUserId, clerkUserId), eq(savedPromptsTable.module, module))
    : eq(savedPromptsTable.clerkUserId, clerkUserId);

  const items = await db
    .select()
    .from(savedPromptsTable)
    .where(conditions)
    .orderBy(desc(savedPromptsTable.createdAt))
    .limit(100);

  res.json(items);
});

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

Crie um ${tipoCtx} sobre o assunto: ${subject}.

Regras obrigatórias:
- O prompt deve ser completo, profissional e imediatamente reutilizável
- Específico para o assunto informado, sem generalizações
- Entre 80 e 250 palavras
- Linguagem direta e profissional em português brasileiro
- Estruturado com contexto claro + instruções + critérios de qualidade
- Não usar placeholders como [produto] ou [nicho]

Responda exatamente neste formato (duas linhas, sem mais nada):
TITULO: [título conciso, máximo 60 caracteres]
PROMPT: [o prompt completo aqui, pode ter múltiplas linhas]`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: `Tipo: ${tipo}\nAssunto: ${subject}` },
      ],
      temperature: 0.7,
      max_tokens: 900,
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

router.delete("/prompts/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id as string, 10);
  await db
    .delete(savedPromptsTable)
    .where(and(eq(savedPromptsTable.id, id), eq(savedPromptsTable.clerkUserId, clerkUserId)));
  res.json({ ok: true });
});

export default router;
