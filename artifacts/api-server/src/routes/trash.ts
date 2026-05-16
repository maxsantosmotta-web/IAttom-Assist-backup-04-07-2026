import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  trashItems,
  mlProducts,
  hotmartProducts,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

const PLATFORM_LABELS: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  hotmart: "Hotmart",
  shopee: "Shopee",
  kiwify: "Kiwify",
  meta: "Meta",
  whatsapp: "WhatsApp",
};

async function restoreItem(item: { platform: string; originalId: number }) {
  if (item.platform === "mercado_livre") {
    await db.update(mlProducts).set({ deletedAt: null }).where(eq(mlProducts.id, item.originalId));
  } else if (item.platform === "hotmart") {
    await db.update(hotmartProducts).set({ deletedAt: null }).where(eq(hotmartProducts.id, item.originalId));
  }
}

async function permanentDeleteItem(item: { platform: string; originalId: number }) {
  if (item.platform === "mercado_livre") {
    await db.delete(mlProducts).where(eq(mlProducts.id, item.originalId));
  } else if (item.platform === "hotmart") {
    await db.delete(hotmartProducts).where(eq(hotmartProducts.id, item.originalId));
  }
}

// ─── ADMIN: GET /admin/trash — all items ──────────────────────────────────────
router.get("/admin/trash", requireAdmin, async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(trashItems)
    .orderBy(desc(trashItems.deletedAt))
    .limit(200);
  res.json(items);
});

// ─── ADMIN: POST /admin/trash/:id/restore ─────────────────────────────────────
router.post("/admin/trash/:id/restore", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [item] = await db.select().from(trashItems).where(eq(trashItems.id, id)).limit(1);
  if (!item) { res.status(404).json({ error: "Item não encontrado na lixeira" }); return; }

  await restoreItem(item);
  await db.delete(trashItems).where(eq(trashItems.id, id));
  req.log.info({ id, platform: item.platform }, "admin trash: item restored");
  res.json({ ok: true, platform: item.platform, platformLabel: PLATFORM_LABELS[item.platform] ?? item.platform });
});

// ─── ADMIN: DELETE /admin/trash/:id — permanently delete ──────────────────────
router.delete("/admin/trash/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [item] = await db.select().from(trashItems).where(eq(trashItems.id, id)).limit(1);
  if (!item) { res.status(404).json({ error: "Item não encontrado na lixeira" }); return; }

  await permanentDeleteItem(item);
  await db.delete(trashItems).where(eq(trashItems.id, id));
  req.log.info({ id, platform: item.platform }, "admin trash: item permanently deleted");
  res.json({ ok: true });
});

// ─── USER: GET /me/trash — only items owned by the authenticated user ──────────
router.get("/me/trash", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const items = await db
    .select()
    .from(trashItems)
    .where(eq(trashItems.clerkUserId, clerkUserId))
    .orderBy(desc(trashItems.deletedAt))
    .limit(200);
  res.json(items);
});

// ─── USER: POST /me/trash/:id/restore ─────────────────────────────────────────
router.post("/me/trash/:id/restore", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const { clerkUserId } = req as AuthenticatedRequest;

  const [item] = await db
    .select()
    .from(trashItems)
    .where(and(eq(trashItems.id, id), eq(trashItems.clerkUserId, clerkUserId)))
    .limit(1);
  if (!item) { res.status(404).json({ error: "Item não encontrado" }); return; }

  await restoreItem(item);
  await db.delete(trashItems).where(eq(trashItems.id, id));
  req.log.info({ id, platform: item.platform }, "user trash: item restored");
  res.json({ ok: true, platform: item.platform, platformLabel: PLATFORM_LABELS[item.platform] ?? item.platform });
});

// ─── USER: DELETE /me/trash/:id — permanently delete ──────────────────────────
router.delete("/me/trash/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const { clerkUserId } = req as AuthenticatedRequest;

  const [item] = await db
    .select()
    .from(trashItems)
    .where(and(eq(trashItems.id, id), eq(trashItems.clerkUserId, clerkUserId)))
    .limit(1);
  if (!item) { res.status(404).json({ error: "Item não encontrado" }); return; }

  await permanentDeleteItem(item);
  await db.delete(trashItems).where(eq(trashItems.id, id));
  req.log.info({ id, platform: item.platform }, "user trash: item permanently deleted");
  res.json({ ok: true });
});

export default router;
