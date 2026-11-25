import { Router, type IRouter } from "express";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db, users, projectsTable, savedPromptsTable, savedItemsTable } from "@workspace/db";
import { requireChatGPTAuth } from "../middlewares/requireChatGPTAuth.js";
import { FEATURE_COSTS } from "../lib/credits.js";

const router: IRouter = Router();
router.use("/chatgpt", requireChatGPTAuth);

// This is deliberately read-only. Never create a user, grant a plan or infer
// an account from email. The Clerk user ID must already belong to IAttom.
router.get("/chatgpt/account", async (req, res): Promise<void> => {
  const clerkId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  const [user] = await db.select({
    plan: users.plan,
    credits: users.credits,
    extraCredits: users.extraCredits,
    creativeCredits: users.creativeCredits,
    extraCreativeCredits: users.extraCreativeCredits,
    videoBalance: users.videoBalance,
  }).from(users).where(eq(users.clerkId, clerkId));
  if (!user) {
    res.status(404).json({ error: "IAttom account not found" });
    return;
  }
  res.json({
    plan: user.plan,
    balance: user.credits + (user.extraCredits ?? 0),
    creativeBalance: user.creativeCredits + (user.extraCreativeCredits ?? 0),
    videoBalance: user.videoBalance ?? 0,
    featureCosts: FEATURE_COSTS,
  });
});

// Read only, scoped to the Clerk user from the verified OAuth token. This does
// not invoke a module, create a project, or debit credits.
router.get("/chatgpt/projects", async (req, res): Promise<void> => {
  const clerkId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  const projects = await db.select({
    id: projectsTable.id,
    name: projectsTable.name,
    type: projectsTable.type,
    status: projectsTable.status,
    description: projectsTable.description,
    updatedAt: projectsTable.updatedAt,
  }).from(projectsTable)
    .where(eq(projectsTable.clerkUserId, clerkId))
    .orderBy(desc(projectsTable.updatedAt))
    .limit(20);
  res.json({ projects });
});

// The web Create Prompt module is paid. A saved prompt is readable here only
// for the authenticated owner while their account has the same plan access.
router.get("/chatgpt/prompts", async (req, res): Promise<void> => {
  const clerkId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  const [user] = await db.select({ plan: users.plan, role: users.role })
    .from(users).where(eq(users.clerkId, clerkId));
  if (!user) {
    res.status(404).json({ error: "IAttom account not found" });
    return;
  }
  if (user.role !== "admin" && !["pro", "business", "agency"].includes(user.plan)) {
    res.status(403).json({ error: "plan_required", currentPlan: user.plan });
    return;
  }

  const prompts = await db.select({
    id: savedPromptsTable.id,
    title: savedPromptsTable.title,
    prompt: savedPromptsTable.prompt,
    module: savedPromptsTable.module,
    createdAt: savedPromptsTable.createdAt,
  }).from(savedPromptsTable)
    .where(and(eq(savedPromptsTable.clerkUserId, clerkId), isNull(savedPromptsTable.deletedAt)))
    .orderBy(desc(savedPromptsTable.createdAt))
    .limit(20);
  res.json({ prompts });
});


// Existing global library, read-only and restricted to the OAuth account owner.
// Never return binary image/video payloads or deleted items through the MCP.
router.get("/chatgpt/library", async (req, res): Promise<void> => {
  const clerkId = (req as typeof req & { clerkUserId: string }).clerkUserId;
  const items = await db.select({
    id: savedItemsTable.id,
    title: savedItemsTable.title,
    type: savedItemsTable.type,
    platform: savedItemsTable.platform,
    content: savedItemsTable.content,
    createdAt: savedItemsTable.createdAt,
  }).from(savedItemsTable)
    .where(and(eq(savedItemsTable.clerkUserId, clerkId), isNull(savedItemsTable.deletedAt)))
    .orderBy(desc(savedItemsTable.createdAt))
    .limit(20);
  res.json({ items });
});

export default router;
