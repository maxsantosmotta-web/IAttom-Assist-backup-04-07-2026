import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, users, projectsTable } from "@workspace/db";
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
  }).from(users).where(eq(users.clerkId, clerkId));
  if (!user) {
    res.status(404).json({ error: "IAttom account not found" });
    return;
  }
  res.json({
    plan: user.plan,
    balance: user.credits + (user.extraCredits ?? 0),
    creativeBalance: user.creativeCredits + (user.extraCreativeCredits ?? 0),
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

export default router;
