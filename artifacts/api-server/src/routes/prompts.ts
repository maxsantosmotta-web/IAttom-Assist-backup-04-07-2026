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

const GeneratePromptBody = z.object({
  product: z.string().min(1).max(200),
  objective: z.string().min(1).max(600),
  module: z.string().min(1),
  observations: z.string().max(500).optional(),
});

const MODULE_CONTEXT: Record<string, string> = {
  product_discovery: "Buscar Produtos — analisa nichos e encontra produtos com potencial de venda em marketplaces",
  product_validation: "Validar Produtos — avalia se um produto tem demanda real, concorrência saudável e potencial de lucro",
  campaign: "Criar Campanha — gera campanhas de marketing completas com ângulos, copies e estratégia de tráfego pago",
  content: "Criar Conteúdo — gera textos, posts, artigos e conteúdos para canais digitais",
  creative: "Gerador Criativo — gera descrições detalhadas para imagens publicitárias e criativos visuais",
  video_script: "Scripts de Vídeo — cria roteiros completos para vídeos de vendas, reels e anúncios em vídeo",
};

router.post("/prompts/generate", requireAuth, async (req, res): Promise<void> => {
  const parsed = GeneratePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }
  const { product, objective, module, observations } = parsed.data;
  const moduleCtx = MODULE_CONTEXT[module] ?? module;

  const systemMsg = `Você é especialista em criar prompts profissionais para sistemas de IA voltados a negócios digitais em português brasileiro.
Sua tarefa é gerar um prompt completo e pronto para uso no módulo: ${moduleCtx}.

Regras obrigatórias:
- Específico para o produto/nicho informado — sem generalizações
- Orientado ao objetivo declarado pelo usuário
- Linguagem direta e profissional em português brasileiro
- Estruturado: contexto + instruções claras + critérios de análise
- Imediatamente utilizável — sem placeholders genéricos
- Entre 80 e 300 palavras no campo "prompt"
- Título conciso e descritivo (máximo 60 caracteres) no campo "title"

Retorne um objeto JSON com exatamente dois campos: "title" (string) e "prompt" (string).`;

  const userMsg = `Produto/Nicho: ${product}\nObjetivo: ${objective}${observations ? `\nObservações: ${observations}` : ""}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
      ],
      temperature: 0.7,
      max_tokens: 900,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const result = JSON.parse(raw) as { title?: string; prompt?: string };

    if (typeof result.title !== "string" || typeof result.prompt !== "string" || !result.title || !result.prompt) {
      req.log.error({ raw }, "prompts/generate: invalid json shape from model");
      res.status(500).json({ error: "Falha ao gerar prompt. Tente novamente." });
      return;
    }

    res.json({ title: result.title.slice(0, 120), prompt: result.prompt });
  } catch (err) {
    req.log.error({ err }, "prompts/generate: error");
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
