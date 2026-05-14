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
  createMLItem,
  MLApiError,
} from "../lib/mercadolivre.js";
import {
  LoggerManager,
  EventManager,
  IntegrationManager,
  TokenManager,
  WebhookManager,
  NotificationManager,
} from "../lib/integrations/index.js";

const router: IRouter = Router();

// ─── Redirect target after OAuth ──────────────────────────────────────────────
// BASE_PATH is the server-side base prefix (e.g. "" in production root deployment).
// The frontend SPA handles /admin/mercado-livre via client-side routing.
const BASE_PATH = (process.env.BASE_PATH ?? "").replace(/\/$/, "");

// ─── Helper — upsert onNewToken callback ──────────────────────────────────────
async function persistNewToken(
  configId: number,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date | undefined,
): Promise<void> {
  await db.update(mlConfig)
    .set({
      accessToken,
      refreshToken,
      tokenExpiry: expiresAt ?? null,
      updatedAt:   new Date(),
    })
    .where(eq(mlConfig.id, configId));
}

// ─── PUBLIC: Receive ML notifications (webhook) ──────────────────────────────
router.post("/ml/notifications", (req, res): void => {
  const payload  = req.body as Record<string, unknown>;
  const topic    = (payload["topic"]    as string | undefined) ?? "unknown";
  const resource = (payload["resource"] as string | undefined) ?? "";
  const userId   = String((payload["user_id"] as number | undefined) ?? "");

  req.log.info({ topic, resource, userId }, "ml: notification received");

  const partial = WebhookManager.normalizeML(payload);
  const ev      = WebhookManager.buildEvent(partial);
  EventManager.push(ev);

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
  const code  = req.query["code"]  as string | undefined;
  const error = req.query["error"] as string | undefined;

  // ML authorization denied
  if (error) {
    LoggerManager.error(`OAuth callback denied: ${error}`, "ml");
    res.redirect(`${BASE_PATH}/admin/mercado-livre?ml_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code) {
    req.log.warn("ml: OAuth callback missing code");
    res.status(400).send(
      "<html><body><p>Parâmetro 'code' ausente. Volte e tente novamente.</p></body></html>",
    );
    return;
  }

  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.appId || !config.clientSecret) {
    LoggerManager.error("OAuth callback: credentials not configured", "ml");
    res.redirect(`${BASE_PATH}/admin/mercado-livre?ml_error=not_configured`);
    return;
  }

  try {
    // 1 — Exchange code → tokens
    const tokens = await exchangeMLCode(
      config.appId,
      config.clientSecret,
      config.redirectUri ?? "",
      code,
    );

    if (tokens.error || !tokens.access_token) {
      const errCode = encodeURIComponent(tokens.error ?? "exchange_failed");
      LoggerManager.error(`Code exchange failed: ${tokens.error} — ${tokens.message ?? ""}`, "ml");
      res.redirect(`${BASE_PATH}/admin/mercado-livre?ml_error=${errCode}`);
      return;
    }

    // 2 — Fetch nickname
    let nickname = "";
    let mlUserId = tokens.user_id ? String(tokens.user_id) : (config.userId ?? "");
    try {
      const userInfo = await getMLUserInfo(tokens.access_token);
      nickname = userInfo.nickname;
      mlUserId = String(userInfo.id);
      LoggerManager.info(`User info: ${nickname} (${mlUserId})`, "ml");
    } catch (e) {
      LoggerManager.warn(
        `Could not fetch /users/me: ${e instanceof Error ? e.message : String(e)}`,
        "ml",
      );
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    const newRefreshToken = tokens.refresh_token || config.refreshToken || "";

    // 3 — Persist to DB
    await db.update(mlConfig)
      .set({
        accessToken:  tokens.access_token,
        refreshToken: newRefreshToken,
        tokenExpiry:  expiresAt ?? null,
        userId:       mlUserId,
        nickname,
        isActive:     true,
        updatedAt:    new Date(),
      })
      .where(eq(mlConfig.id, config.id));

    req.log.info({ mlUserId, nickname }, "ml: OAuth success — tokens saved");
    LoggerManager.info(`OAuth complete — ${nickname} (${mlUserId})`, "ml");

    // 4 — Register with TokenManager + schedule automatic refresh
    registerMLToken(
      tokens.access_token,
      newRefreshToken || undefined,
      expiresAt,
      config.appId,
      config.clientSecret,
      async (newToken, newExpiry) => {
        await persistNewToken(
          config.id,
          newToken.access_token ?? "",
          newToken.refresh_token ?? newRefreshToken,
          newExpiry,
        );
      },
    );

    // 5 — Update global health state
    void IntegrationManager.checkHealth().catch(() => undefined);
    NotificationManager.success(
      "Mercado Livre conectado",
      `Conta ${nickname || mlUserId} autenticada com sucesso.`,
      "ml",
    );

    res.redirect(`${BASE_PATH}/admin/mercado-livre?ml_connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LoggerManager.error(`OAuth callback exception: ${msg}`, "ml");
    req.log.error({ err }, "ml: OAuth callback exception");
    res.redirect(`${BASE_PATH}/admin/mercado-livre?ml_error=oauth_exception`);
  }
});

// ─── ADMIN: Get config ────────────────────────────────────────────────────────
router.get("/ml/config", requireAdmin, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config) {
    res.json({ configured: false });
    return;
  }

  const now         = new Date();
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
// clientSecret is optional when updating (leave empty to keep existing value).
const configSchema = z.object({
  appId:        z.string().min(1),
  clientSecret: z.string().optional(),
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
    // Only overwrite clientSecret if a non-empty value was provided
    const secretToSave = clientSecret?.trim() ? clientSecret.trim() : existing.clientSecret;

    await db.update(mlConfig)
      .set({
        appId,
        clientSecret: secretToSave,
        redirectUri,
        siteId:    siteId ?? existing.siteId ?? "MLB",
        updatedAt: new Date(),
      })
      .where(eq(mlConfig.id, existing.id));
  } else {
    // First time save — clientSecret is mandatory
    if (!clientSecret?.trim()) {
      res.status(400).json({ error: "Client Secret é obrigatório no primeiro cadastro." });
      return;
    }
    await db.insert(mlConfig).values({
      appId,
      clientSecret: clientSecret.trim(),
      redirectUri,
      siteId: siteId ?? "MLB",
    });
  }

  LoggerManager.info(`Config saved — appId: ${appId}`, "ml");
  res.json({ ok: true });
});

// ─── ADMIN: Generate OAuth URL ────────────────────────────────────────────────
router.get("/ml/oauth-url", requireAdmin, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.appId || !config.redirectUri) {
    res.status(400).json({ error: "Salve as credenciais (App ID e URI de callback) antes de gerar o link." });
    return;
  }
  if (!config.clientSecret) {
    res.status(400).json({ error: "Client Secret não encontrado. Salve as credenciais completas." });
    return;
  }
  const url = generateMLOAuthUrl(config.appId, config.redirectUri);
  LoggerManager.info(`OAuth URL generated for app ${config.appId}`, "ml");
  res.json({ url, redirectUri: config.redirectUri });
});

// ─── ADMIN: Disconnect ────────────────────────────────────────────────────────
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

  // Remove from global TokenManager (static import — guaranteed same singleton)
  TokenManager.removeToken("ml");

  void IntegrationManager.checkHealth().catch(() => undefined);
  NotificationManager.info("Mercado Livre desconectado", "Tokens removidos.", "ml");
  LoggerManager.info("Account disconnected — tokens cleared", "ml");
  req.log.info("ml: account disconnected");
  res.json({ ok: true });
});

// ─── ADMIN: Manual token refresh ──────────────────────────────────────────────
router.post("/ml/refresh-token", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.refreshToken) {
    res.status(400).json({
      error: "Refresh token não disponível. Reconecte a conta usando o fluxo OAuth.",
    });
    return;
  }

  try {
    const tokens = await refreshMLToken(
      config.appId,
      config.clientSecret,
      config.refreshToken,
    );

    if (tokens.error || !tokens.access_token) {
      const msg = tokens.message
        ? `${tokens.error}: ${tokens.message}`
        : (tokens.error ?? "Resposta inválida do Mercado Livre.");
      LoggerManager.error(`Manual refresh failed: ${msg}`, "ml");
      res.status(400).json({ error: msg });
      return;
    }

    const expiresAt      = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;
    const newRefreshToken = tokens.refresh_token || config.refreshToken;

    await db.update(mlConfig)
      .set({
        accessToken:  tokens.access_token,
        refreshToken: newRefreshToken,
        tokenExpiry:  expiresAt ?? null,
        updatedAt:    new Date(),
      })
      .where(eq(mlConfig.id, config.id));

    // Update global TokenManager (static import)
    TokenManager.setToken({
      integrationId: "ml",
      accessToken:   tokens.access_token,
      refreshToken:  newRefreshToken || undefined,
      expiresAt,
    });

    LoggerManager.info("Token refreshed manually", "ml");
    res.json({ ok: true, expiresAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LoggerManager.error(`Manual refresh exception: ${msg}`, "ml");
    req.log.error({ err }, "ml: refresh-token failed");
    res.status(500).json({ error: "Erro interno ao renovar token. Tente reconectar." });
  }
});

// ─── ADMIN: Sync products ─────────────────────────────────────────────────────
router.post("/ml/sync-products", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.isActive || !config.accessToken) {
    res.status(503).json({ error: "Mercado Livre não autenticado. Conecte uma conta primeiro." });
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

    LoggerManager.info(`Sync products done — ${synced} items`, "ml");
    req.log.info({ synced }, "ml: sync-products complete");
    res.json({ ok: true, synced });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LoggerManager.error(`Sync products failed: ${msg}`, "ml");
    req.log.error({ err }, "ml: sync-products failed");

    if (err instanceof MLApiError && err.isUnauthorized) {
      IntegrationManager.recordError("ml", "Token expirado durante sync de anúncios.");
      res.status(401).json({ error: "Token expirado. Renove o token ou reconecte a conta." });
    } else if (err instanceof MLApiError && err.isForbidden) {
      res.status(403).json({ error: "Sem permissão. Verifique os escopos do app no painel ML." });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ─── ADMIN: Sync orders ───────────────────────────────────────────────────────
router.post("/ml/sync-orders", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.isActive || !config.accessToken) {
    res.status(503).json({ error: "Mercado Livre não autenticado. Conecte uma conta primeiro." });
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
          status:        order.status              ?? "unknown",
          totalAmount:   String(order.total_amount ?? "0"),
          buyerNickname: order.buyer?.nickname     ?? "",
          dateCreated:   order.date_created ? new Date(order.date_created) : null,
          syncedAt:      new Date(),
        })
        .onConflictDoUpdate({
          target: mlOrders.mlOrderId,
          set: {
            status:        order.status              ?? "unknown",
            totalAmount:   String(order.total_amount ?? "0"),
            buyerNickname: order.buyer?.nickname     ?? "",
            syncedAt:      sql`now()`,
          },
        });
      synced++;
    }

    LoggerManager.info(`Sync orders done — ${synced} orders`, "ml");
    req.log.info({ synced }, "ml: sync-orders complete");
    res.json({ ok: true, synced });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LoggerManager.error(`Sync orders failed: ${msg}`, "ml");
    req.log.error({ err }, "ml: sync-orders failed");

    if (err instanceof MLApiError && err.isUnauthorized) {
      IntegrationManager.recordError("ml", "Token expirado durante sync de pedidos.");
      res.status(401).json({ error: "Token expirado. Renove o token ou reconecte a conta." });
    } else if (err instanceof MLApiError && err.isForbidden) {
      res.status(403).json({ error: "Sem permissão. Verifique os escopos do app no painel ML." });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ─── ADMIN: Create test item ──────────────────────────────────────────────────
router.post("/ml/create-test-item", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(mlConfig).limit(1);
  if (!config?.isActive || !config.accessToken) {
    res.status(503).json({ error: "Mercado Livre não autenticado. Conecte uma conta primeiro." });
    return;
  }

  try {
    const item = await createMLItem(config.accessToken, {
      title:              "Teste IAttom Assist",
      category_id:        "MLB3530",
      price:              99,
      currency_id:        "BRL",
      available_quantity: 1,
      listing_type_id:    "bronze",
      condition:          "new",
      // ── imagem pública de teste (ML exige ao menos 1 imagem) ───────
      pictures: [
        { source: "https://http2.mlstatic.com/frontend-assets/ui-navigation/5.19.1/mercadolivre/logo__large_plus.png" },
      ],
      // ── atributos obrigatórios para MLB3530 ────────────────────────
      attributes: [
        { id: "BRAND", value_name: "IAttom Assist" },
        { id: "MODEL", value_name: "Teste"         },
      ],
      // ── modo de envio: retirada local, sem frete grátis ───────────
      // Evita o erro "User has not mode me1" (ME1/ME2 não ativado)
      shipping: {
        mode:          "not_specified",
        local_pick_up: true,
        free_shipping: false,
      },
    });

    // Persist to local DB
    if (item.id) {
      await db.insert(mlProducts)
        .values({
          mlItemId:          item.id,
          title:             item.title ?? "Teste IAttom Assist",
          price:             "99",
          availableQuantity: 1,
          status:            item.status ?? "active",
          categoryId:        "MLB3530",
          permalink:         item.permalink ?? "",
          syncedAt:          new Date(),
        })
        .onConflictDoUpdate({
          target: mlProducts.mlItemId,
          set: {
            title:     item.title     ?? "Teste IAttom Assist",
            status:    item.status    ?? "active",
            permalink: item.permalink ?? "",
            syncedAt:  sql`now()`,
          },
        });
    }

    LoggerManager.info(`Test item created: ${item.id ?? "unknown"}`, "ml");
    req.log.info({ itemId: item.id }, "ml: test item created");
    res.json({ ok: true, item });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LoggerManager.error(`Create test item failed: ${msg}`, "ml");
    req.log.error({ err }, "ml: create-test-item failed");

    if (err instanceof MLApiError && err.isUnauthorized) {
      res.status(401).json({ error: "Token expirado. Renove o token ou reconecte a conta." });
    } else if (err instanceof MLApiError && err.isForbidden) {
      res.status(403).json({ error: "Sem permissão. Verifique os escopos do app no painel ML." });
    } else if (err instanceof MLApiError) {
      // Parse ML validation errors into clean Portuguese
      let body: { cause?: Array<{ code: number; message: string }> } = {};
      try { body = JSON.parse(err.body) as typeof body; } catch { /* ignore */ }

      const PT: Record<number, string> = {
        110060: "Imagem inválida ou inacessível pela API do ML.",
        110049: "Conta sem Mercado Envios ativado. Acesse sua conta ML e ative as configurações de envio.",
        110001: "Atributo obrigatório ausente (verifique BRAND / MODEL).",
        110500: "Categoria inválida para este tipo de anúncio.",
         19030: "Categoria não encontrada.",
      };

      const causes = (body.cause ?? [])
        .map((c) => PT[c.code] ?? c.message)
        .filter(Boolean);

      const friendly = causes.length
        ? causes.join(" | ")
        : msg.replace(/^validation_error — /, "");

      res.status(422).json({ error: friendly });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ─── ADMIN: List products ─────────────────────────────────────────────────────
router.get("/ml/products", requireAdmin, async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(mlProducts)
    .orderBy(desc(mlProducts.syncedAt))
    .limit(100);
  res.json(products);
});

// ─── ADMIN: List orders ───────────────────────────────────────────────────────
router.get("/ml/orders", requireAdmin, async (_req, res): Promise<void> => {
  const orders = await db
    .select()
    .from(mlOrders)
    .orderBy(desc(mlOrders.syncedAt))
    .limit(100);
  res.json(orders);
});

// ─── ADMIN: List events ───────────────────────────────────────────────────────
router.get("/ml/events", requireAdmin, async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(mlEvents)
    .orderBy(desc(mlEvents.receivedAt))
    .limit(50);
  res.json(events);
});

export default router;
