import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { db, savedItemsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";

const router: IRouter = Router();
const TRASH_TTL_MS = 48 * 60 * 60 * 1000;
const largeJson = express.json({ limit: "25mb" });

type TrashImageBody = {
  title: string;
  origin: "gallery" | "library";
  name: string;
  base64: string;
  mimeType: "image/png" | "image/jpeg";
};

router.post("/image-motion/trash-source", requireAuth, largeJson, async (req: Request, res: Response) => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  const { title, origin, name, base64, mimeType } = req.body as TrashImageBody;

  if (!title || !name || !base64 || !["gallery", "library"].includes(origin) || !["image/png", "image/jpeg"].includes(mimeType)) {
    return res.status(400).json({ error: "Dados da imagem são inválidos" });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRASH_TTL_MS);
  const id = crypto.randomUUID();

  try {
    const [row] = await db
      .insert(savedItemsTable)
      .values({
        id,
        clerkUserId,
        title,
        type: "creative",
        platform: null,
        content: "Imagem removida do fluxo Vídeo com Imagem",
        data: JSON.stringify({
          type: "image-motion-source",
          origin,
          name,
          mimeType,
          removedAt: now.toISOString(),
        }),
        hasImages: true,
        imagesData: JSON.stringify([{
          conceptIndex: 0,
          base64,
          label: name,
          format: origin,
        }]),
        deletedAt: now,
        expiresAt,
      })
      .returning({
        id: savedItemsTable.id,
        deletedAt: savedItemsTable.deletedAt,
        expiresAt: savedItemsTable.expiresAt,
      });

    if (!row?.deletedAt) {
      return res.status(500).json({ error: "A imagem não foi confirmada na Lixeira" });
    }

    return res.status(201).json({ ok: true, item: row });
  } catch (err) {
    req.log.error({ err }, "Failed to atomically trash image-motion source");
    return res.status(500).json({ error: "Erro ao enviar imagem para a Lixeira" });
  }
});

export default router;
