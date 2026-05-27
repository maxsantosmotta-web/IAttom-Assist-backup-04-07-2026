import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { eq, and, isNull, isNotNull, lt } from "drizzle-orm";
import { db, savedItemsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

const TRASH_TTL_MS = 48 * 60 * 60 * 1000;

// Columns returned in list views — excludes imagesData (can be several MB per row)
const LIST_COLUMNS = {
  id: savedItemsTable.id,
  clerkUserId: savedItemsTable.clerkUserId,
  title: savedItemsTable.title,
  type: savedItemsTable.type,
  platform: savedItemsTable.platform,
  content: savedItemsTable.content,
  data: savedItemsTable.data,
  hasImages: savedItemsTable.hasImages,
  createdAt: savedItemsTable.createdAt,
  deletedAt: savedItemsTable.deletedAt,
  expiresAt: savedItemsTable.expiresAt,
};

router.get("/saved-items", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  try {
    const items = await db
      .select(LIST_COLUMNS)
      .from(savedItemsTable)
      .where(and(eq(savedItemsTable.clerkUserId, clerkUserId), isNull(savedItemsTable.deletedAt)))
      .orderBy(savedItemsTable.createdAt);
    return res.json(items.reverse());
  } catch (err) {
    req.log.error({ err }, "Failed to list saved items");
    return res.status(500).json({ error: "Erro ao listar projetos" });
  }
});

router.get("/saved-items/trash", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  try {
    const now = new Date();
    // Remove only expired items (TTL elapsed)
    await db
      .delete(savedItemsTable)
      .where(
        and(
          eq(savedItemsTable.clerkUserId, clerkUserId),
          isNotNull(savedItemsTable.expiresAt),
          lt(savedItemsTable.expiresAt, now),
        )
      );
    // Return remaining trash items (no images data — lightweight)
    const items = await db
      .select(LIST_COLUMNS)
      .from(savedItemsTable)
      .where(and(eq(savedItemsTable.clerkUserId, clerkUserId), isNotNull(savedItemsTable.deletedAt)))
      .orderBy(savedItemsTable.deletedAt);
    return res.json(items.reverse());
  } catch (err) {
    req.log.error({ err }, "Failed to list trash items");
    return res.status(500).json({ error: "Erro ao listar lixeira" });
  }
});

router.post("/saved-items", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  const { id, title, type, platform, content, data, hasImages } = req.body as {
    id: string;
    title: string;
    type: string;
    platform?: string;
    content?: string;
    data?: string;
    hasImages?: boolean;
  };
  if (!id || !title || !type) {
    return res.status(400).json({ error: "id, title e type são obrigatórios" });
  }
  try {
    const [row] = await db
      .insert(savedItemsTable)
      .values({
        id,
        clerkUserId,
        title,
        type,
        platform: platform ?? null,
        content: content ?? "",
        data: data ?? null,
        hasImages: hasImages ?? false,
      })
      .onConflictDoUpdate({
        target: savedItemsTable.id,
        set: { title, content: content ?? "", data: data ?? null, hasImages: hasImages ?? false },
      })
      .returning({
        id: savedItemsTable.id,
        clerkUserId: savedItemsTable.clerkUserId,
        title: savedItemsTable.title,
        type: savedItemsTable.type,
        platform: savedItemsTable.platform,
        content: savedItemsTable.content,
        data: savedItemsTable.data,
        hasImages: savedItemsTable.hasImages,
        createdAt: savedItemsTable.createdAt,
        deletedAt: savedItemsTable.deletedAt,
        expiresAt: savedItemsTable.expiresAt,
      });
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to save item");
    return res.status(500).json({ error: "Erro ao salvar projeto" });
  }
});

// Assets endpoints — uses larger body limit middleware per route
const largeJson = express.json({ limit: "25mb" });

router.get("/saved-items/:id/assets", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  const id = req.params["id"] as string;
  try {
    const [row] = await db
      .select({ imagesData: savedItemsTable.imagesData })
      .from(savedItemsTable)
      .where(and(eq(savedItemsTable.id, id), eq(savedItemsTable.clerkUserId, clerkUserId)));
    if (!row) return res.status(404).json({ error: "Não encontrado" });
    const assets = row.imagesData ? (JSON.parse(row.imagesData) as unknown[]) : [];
    return res.json({ assets });
  } catch (err) {
    req.log.error({ err }, "Failed to get item assets");
    return res.status(500).json({ error: "Erro ao buscar assets" });
  }
});

router.post("/saved-items/:id/assets", requireAuth, largeJson, async (req: Request, res: Response) => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  const id = req.params["id"] as string;
  const { assets } = req.body as { assets: Array<{ conceptIndex: number; base64: string; label: string; format: string }> };
  if (!Array.isArray(assets)) {
    return res.status(400).json({ error: "assets deve ser um array" });
  }
  try {
    await db
      .update(savedItemsTable)
      .set({ imagesData: JSON.stringify(assets), hasImages: assets.length > 0 })
      .where(and(eq(savedItemsTable.id, id), eq(savedItemsTable.clerkUserId, clerkUserId)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save item assets");
    return res.status(500).json({ error: "Erro ao salvar assets" });
  }
});

router.delete("/saved-items/:id", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  const id = req.params["id"] as string;
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TRASH_TTL_MS);
    await db
      .update(savedItemsTable)
      .set({ deletedAt: now, expiresAt })
      .where(and(eq(savedItemsTable.id, id), eq(savedItemsTable.clerkUserId, clerkUserId)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to trash item");
    return res.status(500).json({ error: "Erro ao mover para lixeira" });
  }
});

router.post("/saved-items/:id/restore", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  const id = req.params["id"] as string;
  try {
    await db
      .update(savedItemsTable)
      .set({ deletedAt: null, expiresAt: null })
      .where(and(eq(savedItemsTable.id, id), eq(savedItemsTable.clerkUserId, clerkUserId)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to restore item");
    return res.status(500).json({ error: "Erro ao restaurar projeto" });
  }
});

router.delete("/saved-items/:id/permanent", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  const id = req.params["id"] as string;
  try {
    await db
      .delete(savedItemsTable)
      .where(and(eq(savedItemsTable.id, id), eq(savedItemsTable.clerkUserId, clerkUserId)));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to permanently delete item");
    return res.status(500).json({ error: "Erro ao excluir projeto" });
  }
});

export default router;
