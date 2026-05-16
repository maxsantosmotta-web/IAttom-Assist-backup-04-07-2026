import { Router, type IRouter } from "express";
import { eq, desc, isNull, sql } from "drizzle-orm";
import {
  db,
  mlConfig,
  mlProducts,
  mlEvents,
  trashItems,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import {
  generateMLOAuthUrl,
  getMLItems,
  createMLItem,
  MLApiError,
} from "../lib/mercadolivre.js";

const router: IRouter = Router();

// ─── GET /me/ml/status — connection status (non-sensitive) ────────────────────
router.get("/me/ml/status", requireAuth, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  res.json({
    connected: !!(config?.accessToken && config.isActive),
    nickname: config?.nickname ?? null,
    tokenExpired: config?.tokenExpiry ? new Date(config.tokenExpiry) < new Date() : false,
    appConfigured: !!(config?.appId),
    siteId: config?.siteId ?? null,
  });
});

// ─── GET /me/ml/oauth-url ─────────────────────────────────────────────────────
router.get("/me/ml/oauth-url", requireAuth, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.appId || !config.redirectUri) {
    res.status(503).json({ error: "Integração ML não configurada pelo administrador." });
    return;
  }
  const url = generateMLOAuthUrl(config.appId, config.redirectUri);
  res.json({ url });
});

// ─── GET /me/ml/listings ──────────────────────────────────────────────────────
router.get("/me/ml/listings", requireAuth, async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(mlProducts)
    .where(isNull(mlProducts.deletedAt))
    .orderBy(desc(mlProducts.syncedAt))
    .limit(100);
  res.json(items);
});

// ─── GET /me/ml/events ────────────────────────────────────────────────────────
router.get("/me/ml/events", requireAuth, async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(mlEvents)
    .orderBy(desc(mlEvents.id))
    .limit(30);
  res.json(events);
});

// ─── POST /me/ml/sync ─────────────────────────────────────────────────────────
router.post("/me/ml/sync", requireAuth, async (req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.accessToken || !config.isActive) {
    res.status(503).json({ error: "Mercado Livre não conectado. O administrador deve configurar a integração primeiro." });
    return;
  }
  if (!config.userId) {
    res.status(503).json({ error: "User ID não disponível. Reconecte a conta no painel administrativo." });
    return;
  }
  try {
    const items = await getMLItems(config.accessToken, config.userId);
    let synced = 0;
    for (const item of items) {
      await db
        .insert(mlProducts)
        .values({
          mlItemId:          item.id,
          title:             item.title             ?? "",
          price:             String(item.price      ?? "0"),
          availableQuantity: item.available_quantity ?? 0,
          status:            item.status            ?? "unknown",
          categoryId:        item.category_id       ?? "",
          permalink:         item.permalink         ?? "",
          syncedAt:          new Date(),
        })
        .onConflictDoUpdate({
          target: mlProducts.mlItemId,
          set: {
            title:             item.title             ?? "",
            price:             String(item.price      ?? "0"),
            availableQuantity: item.available_quantity ?? 0,
            status:            item.status            ?? "unknown",
            syncedAt:          sql`now()`,
          },
        });
      synced++;
    }
    res.json({ ok: true, synced });
  } catch (err) {
    req.log.error({ err }, "me/ml/sync: failed");
    if (err instanceof MLApiError && err.isUnauthorized) {
      res.status(401).json({ error: "Token expirado. O administrador deve renovar a conexão ML." });
    } else {
      res.status(500).json({ error: err instanceof Error ? err.message : "Falha na sincronização" });
    }
  }
});

// ─── POST /me/ml/listings/:id/trash ──────────────────────────────────────────
router.post("/me/ml/listings/:id/trash", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [product] = await db.select().from(mlProducts).where(eq(mlProducts.id, id)).limit(1);
  if (!product) { res.status(404).json({ error: "Anúncio não encontrado" }); return; }

  await db.update(mlProducts).set({ deletedAt: new Date() }).where(eq(mlProducts.id, id));
  await db.insert(trashItems).values({
    originalId:     id,
    platform:       "mercado_livre",
    itemType:       "listing",
    name:           product.title ?? "Anúncio sem título",
    previousStatus: product.status ?? "active",
    snapshot:       JSON.stringify(product),
    clerkUserId,
    deletedAt:      new Date(),
  });

  res.json({ ok: true });
});

// ─── POST /me/ml/create-listing ───────────────────────────────────────────────
router.post("/me/ml/create-listing", requireAuth, async (req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.accessToken || !config.isActive) {
    res.status(503).json({ error: "Mercado Livre não conectado." });
    return;
  }
  try {
    const body = req.body as { title?: string; price?: number; quantity?: number };
    const item = await createMLItem(config.accessToken, {
      title:              body.title ?? "Novo Anúncio",
      category_id:        "MLB3530",
      price:              body.price ?? 10,
      currency_id:        "BRL",
      available_quantity: body.quantity ?? 1,
      listing_type_id:    "bronze",
      condition:          "new",
      pictures: [
        { source: "https://http2.mlstatic.com/frontend-assets/ui-navigation/5.19.1/mercadolivre/logo__large_plus.png" },
      ],
      attributes: [
        { id: "BRAND", value_name: "Minha Marca"          },
        { id: "MODEL", value_name: body.title ?? "Produto" },
      ],
      shipping: {
        mode:          "not_specified",
        local_pick_up: true,
        free_shipping: false,
      },
    });

    if (item.id) {
      await db
        .insert(mlProducts)
        .values({
          mlItemId:          item.id,
          title:             item.title ?? body.title ?? "Novo Anúncio",
          price:             String(body.price ?? 10),
          availableQuantity: body.quantity ?? 1,
          status:            item.status ?? "active",
          categoryId:        "MLB3530",
          permalink:         item.permalink ?? "",
          syncedAt:          new Date(),
        })
        .onConflictDoUpdate({
          target: mlProducts.mlItemId,
          set: {
            title:     item.title     ?? "",
            status:    item.status    ?? "active",
            permalink: item.permalink ?? "",
            syncedAt:  sql`now()`,
          },
        });
    }

    res.json({ ok: true, item: { id: item.id, permalink: item.permalink } });
  } catch (err) {
    req.log.error({ err }, "me/ml/create-listing: failed");
    if (err instanceof MLApiError && err.isUnauthorized) {
      res.status(401).json({ error: "Token expirado. O administrador deve renovar a conexão." });
    } else {
      res.status(500).json({ error: err instanceof Error ? err.message : "Falha ao criar anúncio" });
    }
  }
});

export default router;
