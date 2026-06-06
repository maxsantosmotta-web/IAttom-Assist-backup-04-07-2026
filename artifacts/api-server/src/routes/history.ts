import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, isNotNull, lt } from "drizzle-orm";
import { db, historyTable } from "@workspace/db";
import { ListHistoryQueryParams, ListHistoryResponse } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const TRASH_TTL_MS = 48 * 60 * 60 * 1000;

/* ── GET /history ── active list (no deleted) ──────────────────────── */
router.get("/history", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const parsed = ListHistoryQueryParams.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 20;

  const items = await db
    .select()
    .from(historyTable)
    .where(and(
      eq(historyTable.clerkUserId, clerkUserId),
      isNull(historyTable.deletedAt),
    ))
    .orderBy(desc(historyTable.createdAt))
    .limit(limit);

  res.json(ListHistoryResponse.parse(items.map((item) => ({
    ...item,
    projectId: item.projectId ?? undefined,
    projectName: item.projectName ?? undefined,
  }))));
});

/* ── GET /history/trash ── trash list (purge expired first) ─────────── */
router.get("/history/trash", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const now = new Date();

  await db
    .delete(historyTable)
    .where(and(
      eq(historyTable.clerkUserId, clerkUserId),
      isNotNull(historyTable.deletedAt),
      isNotNull(historyTable.expiresAt),
      lt(historyTable.expiresAt, now),
    ));

  const items = await db
    .select()
    .from(historyTable)
    .where(and(
      eq(historyTable.clerkUserId, clerkUserId),
      isNotNull(historyTable.deletedAt),
    ))
    .orderBy(desc(historyTable.deletedAt));

  res.json(items.map((item) => ({
    id: item.id,
    action: item.action,
    module: item.module,
    projectName: item.projectName ?? null,
    deletedAt: item.deletedAt?.toISOString() ?? null,
    expiresAt: item.expiresAt?.toISOString() ?? null,
  })));
});

/* ── POST /history/clear ── soft-delete ALL active ──────────────────── */
router.post("/history/clear", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const now = new Date();
  const expires = new Date(now.getTime() + TRASH_TTL_MS);

  await db
    .update(historyTable)
    .set({ deletedAt: now, expiresAt: expires })
    .where(and(
      eq(historyTable.clerkUserId, clerkUserId),
      isNull(historyTable.deletedAt),
    ));

  res.json({ ok: true });
});

/* ── DELETE /history/:id ── soft-delete individual ──────────────────── */
router.delete("/history/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "id inválido" }); return; }

  const now = new Date();
  const expires = new Date(now.getTime() + TRASH_TTL_MS);

  await db
    .update(historyTable)
    .set({ deletedAt: now, expiresAt: expires })
    .where(and(eq(historyTable.id, id), eq(historyTable.clerkUserId, clerkUserId)));

  res.json({ ok: true });
});

/* ── POST /history/:id/restore ── restore from trash ────────────────── */
router.post("/history/:id/restore", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "id inválido" }); return; }

  await db
    .update(historyTable)
    .set({ deletedAt: null, expiresAt: null })
    .where(and(eq(historyTable.id, id), eq(historyTable.clerkUserId, clerkUserId)));

  res.json({ ok: true });
});

/* ── DELETE /history/:id/permanent ── hard delete ───────────────────── */
router.delete("/history/:id/permanent", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "id inválido" }); return; }

  await db
    .delete(historyTable)
    .where(and(eq(historyTable.id, id), eq(historyTable.clerkUserId, clerkUserId)));

  res.json({ ok: true });
});

export default router;
