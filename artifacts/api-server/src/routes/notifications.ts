import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const items = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.clerkUserId, clerkUserId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(items);
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id as string, 10);
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.clerkUserId, clerkUserId)));
  res.json({ ok: true });
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.clerkUserId, clerkUserId));
  res.json({ ok: true });
});

router.delete("/notifications/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params.id as string, 10);
  await db
    .delete(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.clerkUserId, clerkUserId)));
  res.json({ ok: true });
});

export default router;
