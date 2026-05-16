import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  trashItems,
  mlProducts,
  hotmartProducts,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router: IRouter = Router();

const PLATFORM_LABELS: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  hotmart: "Hotmart",
  shopee: "Shopee",
  kiwify: "Kiwify",
};

// ─── GET /admin/trash ─────────────────────────────────────────────────────────
router.get("/admin/trash", requireAdmin, async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(trashItems)
    .orderBy(desc(trashItems.deletedAt))
    .limit(200);
  res.json(items);
});

// ─── POST /admin/trash/:id/restore ───────────────────────────────────────────
router.post("/admin/trash/:id/restore", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [item] = await db.select().from(trashItems).where(eq(trashItems.id, id)).limit(1);
  if (!item) { res.status(404).json({ error: "Item não encontrado na lixeira" }); return; }

  if (item.platform === "mercado_livre") {
    await db.update(mlProducts).set({ deletedAt: null }).where(eq(mlProducts.id, item.originalId));
  } else if (item.platform === "hotmart") {
    await db.update(hotmartProducts).set({ deletedAt: null }).where(eq(hotmartProducts.id, item.originalId));
  }

  await db.delete(trashItems).where(eq(trashItems.id, id));
  req.log.info({ id, platform: item.platform }, "trash: item restored");
  res.json({ ok: true, platform: item.platform, platformLabel: PLATFORM_LABELS[item.platform] ?? item.platform });
});

// ─── DELETE /admin/trash/:id — permanently delete ─────────────────────────────
router.delete("/admin/trash/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [item] = await db.select().from(trashItems).where(eq(trashItems.id, id)).limit(1);
  if (!item) { res.status(404).json({ error: "Item não encontrado na lixeira" }); return; }

  if (item.platform === "mercado_livre") {
    await db.delete(mlProducts).where(eq(mlProducts.id, item.originalId));
  } else if (item.platform === "hotmart") {
    await db.delete(hotmartProducts).where(eq(hotmartProducts.id, item.originalId));
  }

  await db.delete(trashItems).where(eq(trashItems.id, id));
  req.log.info({ id, platform: item.platform }, "trash: item permanently deleted");
  res.json({ ok: true });
});

export default router;
