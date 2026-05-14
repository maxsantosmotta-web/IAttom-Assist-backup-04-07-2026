import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  mlConfig,
  mlProducts,
  mlOrders,
  mlEvents,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { maskSecret } from "../lib/integrationUtils.js";
import {
  generateMLOAuthUrl,
  exchangeMLCode,
  refreshMLToken,
  getMLUserInfo,
  getMLItems,
  getMLOrders,
  registerMLToken,
} from "../lib/mercadolivre.js";
import {
  LoggerManager,
  EventManager,
  IntegrationManager,
  WebhookManager,
  NotificationManager,
} from "../lib/integrations/index.js";

const router: IRouter = Router();

// ─── Frontend redirect after OAuth ───────────────────────────────────────────
const BASE_PATH = process.env.BASE_PATH ?? "";

// ─── PUBLIC: Receive ML notifications (webhook) ──────────────────────────────
router.post("/ml/notifications", (req, res): void => {
  const payload = req.body as Record<string, unknown>;
  const topic   = (payload["topic"]   as string | undefined) ?? "unknown";
  const resource = (payload["resource"] as string | undefined) ?? "";
  const userId  = String((payload["user_id"] as number | undefined) ?? "");

  req.log.info({ topic, resource, userId }, "ml: notification received");

  // Normalize and push to EventManager
  const partial = WebhookManager.normalizeML(payload);
  const ev = WebhookManager.buildEvent(partial);
  EventManager.push(ev);

  // Persist to DB
  db.insert(mlEvents)
    .values({ topic, resource, userId, payload })
    .then(() => {
      EventManager.markProcessed(ev.id);
      res.status(200).json({ status: "ok" });
    })
    .catch((err: unknown) => {
      req.log.error({ err }, "ml: failed to save notification");
      EventManager.markFailed(ev.id, err instanceof Error ? err.message : String(err));
      res.status(200).json({ status: "ok" }); // always 200 to ML
    });
});

// ─── PUBLIC: OAuth callback ───────────────────────────────────────────────────
router.get("/ml/oauth-callback", async (req, res): Promise<void> => {
  const code  = req.query["code"] as string | undefined;
  const error = req.query["error"] as string | undefined;

  if (error) {
    LoggerManager.error(`OAuth callback error: ${error}`, "ml");
    res.redirect(`${BASE_PATH}/admin/mercado-livre?ml_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code) {
    res.status(400).send("Parâmetro 'code' ausente.");
    return;
  }

  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.appId || !config.clientSecret) {
    LoggerManager.error("OAuth callback: ML credentials not configured", "ml");
    res.redirect(`${BASE_PATH}/admin/mercado-livre?ml_error=not_configured`);
    return;
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeMLCode(
      config.appId,
      config.clientSecret,
      config.redirectUri ?? "",
      code,
    );

    if (tokens.error || !tokens.access_token) {
      LoggerManager.error(`Code exchange failed: ${tokens.error}`, "ml");
      res.redirect(`${BASE_PATH}/admin/mercado-livre?ml_error=${encodeURIComponent(tokens.error ?? "exchange_failed")}`);
      return;
    }

    // Fetch user info for nickname
    let nickname = "";
    try {
      const userInfo = await getMLUserInfo(tokens.access_token);
      nickname = userInfo.nickname;
      LoggerManager.info(`User info fetched: ${nickname} (${userInfo.id})`, "ml");
    } catch (e) {
      LoggerManager.warn(`Could not fetch user info: ${e instanceof Error ? e.message : String(e)}`, "ml");
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    // Save to DB
    const updates = {
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token ?? config.refreshToken ?? "",
      tokenExpiry:  expiresAt ?? null,
      userId:       String(tokens.user_id ?? config.userId ?? ""),
      nickname,
      isActive:     true,
      updatedAt:    new Date(),
    };

    if (config.id) {
      await db.update(mlConfig).set(updates).where(eq(mlConfig.id, config.id));
    }

    // Register token in global TokenManager
    registerMLToken(
      tokens.access_token,
      tokens.refresh_token ?? config.refreshToken ?? undefined,
      expiresAt,
      config.appId,
      config.clientSecret,
      async (newToken, newExpiry) => {
        const [cfg] = await db.select().from(mlConfig).limit(1);
        if (!cfg) throw new Error("ML config not found");
        await db.update(mlConfig).set({
          accessToken:  newToken.access_token ?? cfg.accessToken ?? "",
          refreshToken: newToken.refresh_token ?? cfg.refreshToken ?? "",
          tokenExpiry:  newExpiry ?? null,
          updatedAt:    new Date(),
        }).where(eq(mlConfig.id, cfg.id));
      },
    );

    // Trigger health monitor refresh
    void IntegrationManager.checkHealth().catch(() => undefined);

    NotificationManager.success(
      "Mercado Livre conectado",
      `Conta ${nickname || "sem nome"} conectada com sucesso.`,
      "ml",
    );

    LoggerManager.info(`OAuth complete — user: ${nickname || tokens.user_id}`, "ml");
    res.redirect(`${BASE_PATH}/admin/mercado-livre?ml_connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LoggerManager.error(`OAuth callback exception: ${msg}`, "ml");
    req.log.error({ err }, "ml: OAuth callback failed");
    res.redirect(`${BASE_PATH}/admin/mercado-livre?ml_error=${encodeURIComponent("oauth_exception")}`);
  }
});

// ─── ADMIN: Get config ────────────────────────────────────────────────────────
router.get("/ml/config", requireAdmin, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config) {
    res.json({ configured: false });
    return;
  }

  const now = new Date();
  const tokenExpired = config.tokenExpiry ? config.tokenExpiry < now : false;

  res.json({
    configured:   true,
    appId:        config.appId,
    clientSecret: maskSecret(config.clientSecret),
    accessToken:  maskSecret(config.accessToken),
    userId:       config.userId,
    nickname:     config.nickname,
    siteId:       config.siteId,
    redirectUri:  config.redirectUri,
    isActive:     config.isActive,
    tokenExpired,
    tokenExpiry:  config.tokenExpiry,
    updatedAt:    config.updatedAt,
  });
});

// ─── ADMIN: Save config ───────────────────────────────────────────────────────
const configSchema = z.object({
  appId:        z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri:  z.string().min(1),
  siteId:       z.string().optional(),
});

router.post("/ml/config", requireAdmin, async (req, res): Promise<void> => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload", issues: parsed.error.issues });
    return;
  }
  const { appId, clientSecret, redirectUri, siteId } = parsed.data;
  const [existing] = await db.select().from(mlConfig).limit(1);

  if (existing) {
    await db.update(mlConfig)
      .set({ appId, clientSecret, redirectUri, siteId: siteId ?? "MLB", updatedAt: new Date() })
      .where(eq(mlConfig.id, existing.id));
  } else {
    await db.insert(mlConfig).values({ appId, clientSecret, redirectUri, siteId: siteId ?? "MLB" });
  }

  LoggerManager.info(`Config saved — appId: ${appId}`, "ml");
  res.json({ ok: true });
});

// ─── ADMIN: Generate OAuth URL ────────────────────────────────────────────────
router.get("/ml/oauth-url", requireAdmin, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.appId || !config.redirectUri) {
    res.status(400).json({ error: "Salve as credenciais antes de gerar o link OAuth." });
    return;
  }
  const url = generateMLOAuthUrl(config.appId, config.redirectUri);
  LoggerManager.info("OAuth URL generated", "ml");
  res.json({ url, redirectUri: config.redirectUri });
});

// ─── ADMIN: Disconnect (revoke tokens) ───────────────────────────────────────
router.post("/ml/disconnect", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config) {
    res.status(404).json({ error: "ML não configurado." });
    return;
  }

  await db.update(mlConfig)
    .set({
      accessToken:  "",
      refreshToken: "",
      tokenExpiry:  null,
      isActive:     false,
      nickname:     "",
      userId:       "",
      updatedAt:    new Date(),
    })
    .where(eq(mlConfig.id, config.id));

  // Remove from TokenManager
  const { TokenManager } = await import("../lib/integrations/index.js");
  TokenManager.removeToken("ml");

  // Refresh health
  void IntegrationManager.checkHealth().catch(() => undefined);

  NotificationManager.info("Mercado Livre desconectado", "Tokens removidos com sucesso.", "ml");
  LoggerManager.info("Account disconnected", "ml");
  req.log.info("ml: disconnected");
  res.json({ ok: true });
});

// ─── ADMIN: Manual token refresh ──────────────────────────────────────────────
router.post("/ml/refresh-token", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.refreshToken) {
    res.status(400).json({ error: "Sem refresh token disponível. Reconecte a conta." });
    return;
  }

  try {
    const tokens = await refreshMLToken(config.appId, config.clientSecret, config.refreshToken);

    if (tokens.error || !tokens.access_token) {
      LoggerManager.error(`Manual refresh failed: ${tokens.error}`, "ml");
      res.status(400).json({ error: tokens.error ?? "Falha ao renovar token." });
      return;
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    await db.update(mlConfig)
      .set({
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token ?? config.refreshToken,
        tokenExpiry:  expiresAt ?? null,
        updatedAt:    new Date(),
      })
      .where(eq(mlConfig.id, config.id));

    // Update TokenManager
    const { TokenManager } = await import("../lib/integrations/index.js");
    TokenManager.setToken({
      integrationId: "ml",
      accessToken:   tokens.access_token,
      refreshToken:  tokens.refresh_token ?? config.refreshToken,
      expiresAt,
    });

    LoggerManager.info("Token refreshed manually", "ml");
    res.json({ ok: true, expiresAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LoggerManager.error(`Manual refresh exception: ${msg}`, "ml");
    req.log.error({ err }, "ml: refresh-token failed");
    res.status(500).json({ error: "Erro interno ao renovar token." });
  }
});

// ─── ADMIN: Sync products (real) ──────────────────────────────────────────────
router.post("/ml/sync-products", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.isActive || !config.accessToken) {
    res.status(503).json({ error: "Mercado Livre não autenticado." });
    return;
  }
  if (!config.userId) {
    res.status(503).json({ error: "User ID não disponível. Reconecte a conta." });
    return;
  }

  try {
    const items = await getMLItems(config.accessToken, config.userId);

    let synced = 0;
    for (const item of items) {
      await db.insert(mlProducts)
        .values({
          mlItemId:          item.id,
          title:             item.title ?? "",
          price:             String(item.price ?? "0"),
          availableQuantity: item.available_quantity ?? 0,
          status:            item.status ?? "unknown",
          categoryId:        item.category_id ?? "",
          permalink:         item.permalink ?? "",
          syncedAt:          new Date(),
        })
        .onConflictDoUpdate({
          target: mlProducts.mlItemId,
          set: {
            title:             item.title ?? "",
            price:             String(item.price ?? "0"),
            availableQuantity: item.available_quantity ?? 0,
            status:            item.status ?? "unknown",
            syncedAt:          sql`now()`,
          },
        });
      synced++;
    }

    LoggerManager.info(`Sync products complete — ${synced} items`, "ml");
    req.log.info({ synced }, "ml: sync-products complete");
    res.json({ ok: true, synced });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LoggerManager.error(`Sync products failed: ${msg}`, "ml");
    req.log.error({ err }, "ml: sync-products failed");

    // Check if token expired (401)
    if (msg.includes("401")) {
      IntegrationManager.recordError("ml", "Token expirado — reconecte a conta.");
      res.status(401).json({ error: "Token expirado. Reconecte a conta do Mercado Livre." });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ─── ADMIN: Sync orders (real) ────────────────────────────────────────────────
router.post("/ml/sync-orders", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.isActive || !config.accessToken) {
    res.status(503).json({ error: "Mercado Livre não autenticado." });
    return;
  }
  if (!config.userId) {
    res.status(503).json({ error: "User ID não disponível. Reconecte a conta." });
    return;
  }

  try {
    const orders = await getMLOrders(config.accessToken, config.userId);

    let synced = 0;
    for (const order of orders) {
      await db.insert(mlOrders)
        .values({
          mlOrderId:     String(order.id),
          status:        order.status ?? "unknown",
          totalAmount:   String(order.total_amount ?? "0"),
          buyerNickname: order.buyer?.nickname ?? "",
          dateCreated:   order.date_created ? new Date(order.date_created) : null,
          syncedAt:      new Date(),
        })
        .onConflictDoUpdate({
          target: mlOrders.mlOrderId,
          set: {
            status:        order.status ?? "unknown",
            totalAmount:   String(order.total_amount ?? "0"),
            buyerNickname: order.buyer?.nickname ?? "",
            syncedAt:      sql`now()`,
          },
        });
      synced++;
    }

    LoggerManager.info(`Sync orders complete — ${synced} orders`, "ml");
    req.log.info({ synced }, "ml: sync-orders complete");
    res.json({ ok: true, synced });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LoggerManager.error(`Sync orders failed: ${msg}`, "ml");
    req.log.error({ err }, "ml: sync-orders failed");

    if (msg.includes("401")) {
      IntegrationManager.recordError("ml", "Token expirado — reconecte a conta.");
      res.status(401).json({ error: "Token expirado. Reconecte a conta do Mercado Livre." });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ─── ADMIN: List products ─────────────────────────────────────────────────────
router.get("/ml/products", requireAdmin, async (_req, res): Promise<void> => {
  const products = await db.select().from(mlProducts).orderBy(desc(mlProducts.syncedAt)).limit(100);
  res.json(products);
});

// ─── ADMIN: List orders ───────────────────────────────────────────────────────
router.get("/ml/orders", requireAdmin, async (_req, res): Promise<void> => {
  const orders = await db.select().from(mlOrders).orderBy(desc(mlOrders.syncedAt)).limit(100);
  res.json(orders);
});

// ─── ADMIN: List events ───────────────────────────────────────────────────────
router.get("/ml/events", requireAdmin, async (_req, res): Promise<void> => {
  const events = await db.select().from(mlEvents).orderBy(desc(mlEvents.receivedAt)).limit(50);
  res.json(events);
});

export default router;
