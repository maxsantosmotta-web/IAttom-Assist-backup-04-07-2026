import crypto from "crypto";
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
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import {
  generateShopeeOAuthUrl,
  exchangeShopeeCode,
  verifyShopeeWebhook,
} from "../lib/shopee.js";
import {
  getShopeeConnection,
  saveShopeeConnection,
  disconnectShopee,
} from "../services/platforms/shopeeConnectionService.js";

function getFrontendBase(): string {
  const basePath = process.env.BASE_PATH ?? "";
  const domain = process.env.APP_CUSTOM_DOMAIN
    ?? process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (domain) return `https://${domain}${basePath}`;
  return `http://localhost:80${basePath}`;
}

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

// ─── USER: Per-user connection status ────────────────────────────────────────
router.get("/shopee/me/status", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;

  const [config] = await db.select().from(shopeeConfig).limit(1);
  const platformConfigured = !!(config?.partnerId && config?.partnerKey && config?.redirectUrl && config?.isActive);

  const conn = await getShopeeConnection(clerkUserId);
  if (!conn) {
    res.json({ connected: false, platformConfigured });
    return;
  }

  res.json({
    connected: true,
    platformConfigured,
    connectionId: conn.id,
    shopId: conn.platformUserId || null,
    platformUsername: conn.platformUsername || null,
    connectedAt: conn.createdAt,
  });
});

// ─── USER: Start OAuth — browser redirect to Shopee ──────────────────────────
router.get("/shopee/oauth/start", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const frontendBase = getFrontendBase();

  const [config] = await db.select().from(shopeeConfig).limit(1);
  if (!config?.partnerId || !config?.partnerKey || !config?.redirectUrl || !config?.isActive) {
    res.redirect(
      `${frontendBase}/dashboard/shopee?shopee_error=${encodeURIComponent("Credenciais Shopee não configuradas. Configure no painel administrativo.")}`,
    );
    return;
  }

  const secret = process.env.SESSION_SECRET ?? "iattom_shopee_state";
  const stateHmac = crypto.createHmac("sha256", secret).update(clerkUserId).digest("hex");
  const state = `${stateHmac}.${clerkUserId}`;

  const callbackUrl = `${config.redirectUrl}?uid=${encodeURIComponent(clerkUserId)}&state=${encodeURIComponent(state)}`;
  const oauthUrl = generateShopeeOAuthUrl(config.partnerId, config.partnerKey, callbackUrl);

  req.log.info({ clerkUserId }, "shopee: starting OAuth flow");
  res.redirect(oauthUrl);
});

// ─── USER: OAuth callback — receives code+shop_id from Shopee ────────────────
router.get("/shopee/oauth/callback", async (req, res): Promise<void> => {
  const { code, shop_id, uid, state } = req.query as Record<string, string>;
  const frontendBase = getFrontendBase();

  if (!code || !shop_id || !uid || !state) {
    res.redirect(
      `${frontendBase}/dashboard/shopee?shopee_error=${encodeURIComponent("Parâmetros inválidos no callback Shopee.")}`,
    );
    return;
  }

  const secret = process.env.SESSION_SECRET ?? "iattom_shopee_state";
  const expectedHmac = crypto.createHmac("sha256", secret).update(uid).digest("hex");
  const expectedState = `${expectedHmac}.${uid}`;
  if (state !== expectedState) {
    res.redirect(
      `${frontendBase}/dashboard/shopee?shopee_error=${encodeURIComponent("Estado de segurança inválido. Tente novamente.")}`,
    );
    return;
  }

  const [config] = await db.select().from(shopeeConfig).limit(1);
  if (!config?.partnerId || !config?.partnerKey) {
    res.redirect(
      `${frontendBase}/dashboard/shopee?shopee_error=${encodeURIComponent("Configuração Shopee não encontrada.")}`,
    );
    return;
  }

  try {
    const tokenResp = await exchangeShopeeCode(config.partnerId, config.partnerKey, code, shop_id);

    if (tokenResp.error || !tokenResp.access_token) {
      const msg = tokenResp.message ?? tokenResp.error ?? "Falha ao trocar código por token.";
      req.log.warn({ uid, shop_id, error: msg }, "shopee: token exchange failed");
      res.redirect(
        `${frontendBase}/dashboard/shopee?shopee_error=${encodeURIComponent(msg)}`,
      );
      return;
    }

    const expiresAt = tokenResp.expire_in
      ? new Date(Date.now() + tokenResp.expire_in * 1000)
      : undefined;

    await saveShopeeConnection(uid, {
      platformUserId: shop_id,
      accessToken: tokenResp.access_token,
      refreshToken: tokenResp.refresh_token ?? "",
      expiresAt,
    });

    req.log.info({ clerkUserId: uid, shop_id }, "shopee: user connected successfully");
    res.redirect(`${frontendBase}/dashboard/shopee?shopee_connected=1`);
  } catch (err) {
    req.log.error({ err, uid, shop_id }, "shopee: oauth callback error");
    res.redirect(
      `${frontendBase}/dashboard/shopee?shopee_error=${encodeURIComponent("Falha na autenticação com a Shopee. Tente novamente.")}`,
    );
  }
});

// ─── USER: Disconnect own Shopee account ──────────────────────────────────────
router.post("/shopee/me/disconnect", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthenticatedRequest;
  const conn = await getShopeeConnection(clerkUserId);
  if (conn) {
    await disconnectShopee(clerkUserId, conn.id);
  }
  req.log.info({ clerkUserId }, "shopee: user disconnected own account");
  res.json({ ok: true });
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
