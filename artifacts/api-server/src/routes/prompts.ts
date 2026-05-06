import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, savedPromptsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
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

router.delete("/prompts/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id as string, 10);
  await db
    .delete(savedPromptsTable)
    .where(and(eq(savedPromptsTable.id, id), eq(savedPromptsTable.clerkUserId, clerkUserId)));
  res.json({ ok: true });
});

export default router;
