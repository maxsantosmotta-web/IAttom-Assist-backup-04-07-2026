import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  shopeeConfig,
  shopeeProducts,
  shopeeOrders,
  shopeeEvents,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import {
  generateShopeeOAuthUrl,
  verifyShopeeWebhook,
} from "../lib/shopee.js";

const router: IRouter = Router();

// ─── PUBLIC: Receive Shopee push events ─────────────────────────────────────
router.post("/shopee/webhook", (req, res): void => {
  const payload = req.body as Record<string, unknown>;
  const eventType = (payload.code as number | undefined) ?? 0;
  const shopId = String((payload.shop_id as number | undefined) ?? "");

  req.log.info({ eventType, shopId }, "shopee: event received");

  db.insert(shopeeEvents)
    .values({ eventType: String(eventType), shopId, payload })
    .then(() => {
      res.status(200).json({ status: "ok" });
    })
    .catch((err: unknown) => {
      req.log.error({ err }, "shopee: failed to save event");
      res.status(200).json({ status: "ok" });
    });
});

// ─── USER: Platform connection status (no secrets) ───────────────────────────
router.get("/shopee/status", async (_req, res): Promise<void> => {
  const [config] = await db.select().from(shopeeConfig).limit(1);
  if (!config?.isActive) {
    res.json({ configured: false });
    return;
  }
  res.json({
    configured: true,
    shopId: config.shopId || null,
    updatedAt: config.updatedAt,
  });
});

// ─── ADMIN: Get config ───────────────────────────────────────────────────────
router.get("/shopee/config", requireAdmin, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(shopeeConfig).limit(1);
  if (!config) {
    res.json({ configured: false });
    return;
  }
  res.json({
    configured: true,
    partnerId: config.partnerId,
    partnerKey: config.partnerKey ? "••••••••" + config.partnerKey.slice(-4) : "",
    shopId: config.shopId,
    accessToken: config.accessToken ? "••••••••" + config.accessToken.slice(-4) : "",
    redirectUrl: config.redirectUrl,
    isActive: config.isActive,
    tokenExpiry: config.tokenExpiry,
    updatedAt: config.updatedAt,
  });
});

// ─── ADMIN: Save config ──────────────────────────────────────────────────────
const configSchema = z.object({
  partnerId: z.string().min(1),
  partnerKey: z.string().min(1),
  redirectUrl: z.string().min(1),
  shopId: z.string().optional(),
});

router.post("/shopee/config", requireAdmin, async (req, res): Promise<void> => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload", issues: parsed.error.issues });
    return;
  }
  const { partnerId, partnerKey, redirectUrl, shopId } = parsed.data;
  const [existing] = await db.select().from(shopeeConfig).limit(1);

  if (existing) {
    await db
      .update(shopeeConfig)
      .set({ partnerId, partnerKey, redirectUrl, shopId: shopId ?? "", isActive: true, updatedAt: new Date() })
      .where(eq(shopeeConfig.id, existing.id));
  } else {
    await db.insert(shopeeConfig).values({ partnerId, partnerKey, redirectUrl, shopId: shopId ?? "", isActive: true });
  }

  req.log.info({ partnerId }, "shopee: config saved");
  res.json({ ok: true });
});

// ─── ADMIN: Generate OAuth URL ───────────────────────────────────────────────
router.get("/shopee/oauth-url", requireAdmin, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(shopeeConfig).limit(1);
  if (!config?.partnerId || !config.partnerKey || !config.redirectUrl) {
    res.status(400).json({ error: "Salve as credenciais antes de gerar o link OAuth" });
    return;
  }
  const url = generateShopeeOAuthUrl(config.partnerId, config.partnerKey, config.redirectUrl);
  res.json({ url });
});

// ─── ADMIN: Sync products ────────────────────────────────────────────────────
router.post("/shopee/sync-products", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(shopeeConfig).limit(1);
  if (!config?.isActive) {
    res.status(503).json({ error: "Shopee não configurado" });
    return;
  }
  // TODO: call getShopeeProducts() and upsert into shopeeProducts table
  req.log.info("shopee: sync-products triggered (placeholder)");
  res.json({ ok: true, synced: 0, message: "Sincronização de produtos não implementada ainda." });
});

// ─── ADMIN: Sync orders ──────────────────────────────────────────────────────
router.post("/shopee/sync-orders", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(shopeeConfig).limit(1);
  if (!config?.isActive) {
    res.status(503).json({ error: "Shopee não configurado" });
    return;
  }
  // TODO: call getShopeeOrders() and upsert into shopeeOrders table
  req.log.info("shopee: sync-orders triggered (placeholder)");
  res.json({ ok: true, synced: 0, message: "Sincronização de pedidos não implementada ainda." });
});

// ─── ADMIN: List products ────────────────────────────────────────────────────
router.get("/shopee/products", requireAdmin, async (_req, res): Promise<void> => {
  const products = await db.select().from(shopeeProducts).orderBy(desc(shopeeProducts.syncedAt)).limit(100);
  res.json(products);
});

// ─── ADMIN: List orders ──────────────────────────────────────────────────────
router.get("/shopee/orders", requireAdmin, async (_req, res): Promise<void> => {
  const orders = await db.select().from(shopeeOrders).orderBy(desc(shopeeOrders.syncedAt)).limit(100);
  res.json(orders);
});

// ─── ADMIN: List events ──────────────────────────────────────────────────────
router.get("/shopee/events", requireAdmin, async (_req, res): Promise<void> => {
  const events = await db.select().from(shopeeEvents).orderBy(desc(shopeeEvents.receivedAt)).limit(50);
  res.json(events);
});

export default router;
