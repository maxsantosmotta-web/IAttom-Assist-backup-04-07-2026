import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  kiwifyConfig,
  kiwifyProducts,
  kiwifyEvents,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import {
  verifyKiwifyWebhook,
  testKiwifyConnection,
  getKiwifyAccessToken,
  getKiwifyProducts,
} from "../lib/kiwify.js";

const router: IRouter = Router();

// ─── PUBLIC: Receive Kiwify webhook events ────────────────────────────────────
router.post("/kiwify/webhook", (req, res): void => {
  const rawBody = JSON.stringify(req.body);
  const payload = req.body as Record<string, unknown>;
  const receivedSignature = req.query["signature"] as string | undefined;

  db.select()
    .from(kiwifyConfig)
    .limit(1)
    .then(([config]) => {
      if (config?.webhookSecret && receivedSignature) {
        const valid = verifyKiwifyWebhook(config.webhookSecret, rawBody, receivedSignature);
        if (!valid) {
          req.log.warn("kiwify: webhook signature mismatch — storing anyway");
        }
      }

      const eventType = (payload.type as string | undefined) ?? "unknown";
      const order = payload.order as Record<string, unknown> | undefined;
      const product = payload.product as Record<string, unknown> | undefined;
      const customer = payload.customer as Record<string, unknown> | undefined;

      req.log.info({ eventType }, "kiwify: event received");

      return db.insert(kiwifyEvents).values({
        eventType,
        orderId:     (order?.id as string | undefined) ?? null,
        productId:   (product?.id as string | undefined) ?? null,
        buyerEmail:  (customer?.email as string | undefined) ?? null,
        buyerName:   (customer?.full_name as string | undefined) ?? null,
        value:       String((order?.amount as number | undefined) ?? ""),
        currency:    "BRL",
        payload,
      });
    })
    .then(() => { res.status(200).json({ status: "ok" }); })
    .catch((err: unknown) => {
      req.log.error({ err }, "kiwify: failed to save event");
      res.status(200).json({ status: "ok" });
    });
});

// ─── ADMIN: Get config + connection status ────────────────────────────────────
router.get("/kiwify/config", requireAdmin, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(kiwifyConfig).limit(1);
  if (!config) {
    res.json({
      configured: false,
      connectionStatus: "not_configured",
      webhookConfigured: false,
    });
    return;
  }

  const hasSecret     = !!config.clientSecret;
  const hasWebhook    = !!config.webhookSecret;
  const hasToken      = !!config.accessToken;
  const tokenExpired  = config.tokenExpiry ? config.tokenExpiry < new Date() : true;

  let connectionStatus: string;
  if (!hasSecret) {
    connectionStatus = "not_configured";
  } else if (hasToken && !tokenExpired) {
    connectionStatus = "validated";
  } else if (hasSecret) {
    connectionStatus = "configured";
  } else {
    connectionStatus = "not_configured";
  }

  res.json({
    configured:        hasSecret,
    connectionStatus,
    webhookConfigured: hasWebhook,
    webhookUrl:        `https://iattomassist.com.br/api/kiwify/webhook`,
    clientSecret:      config.clientSecret ? "••••••" + config.clientSecret.slice(-4) : "",
    webhookSecret:     config.webhookSecret ? "••••••" + config.webhookSecret.slice(-4) : "",
    accessToken:       config.accessToken ? "••••••" + config.accessToken.slice(-4) : "",
    tokenExpiry:       config.tokenExpiry,
    isActive:          config.isActive,
    updatedAt:         config.updatedAt,
  });
});

// ─── ADMIN: Save config ───────────────────────────────────────────────────────
const configSchema = z.object({
  clientSecret:  z.string().min(1, "client_secret é obrigatório"),
  webhookSecret: z.string().optional().default(""),
});

router.post("/kiwify/config", requireAdmin, async (req, res): Promise<void> => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "payload inválido", issues: parsed.error.issues });
    return;
  }

  const { clientSecret, webhookSecret } = parsed.data;
  const [existing] = await db.select().from(kiwifyConfig).limit(1);

  if (existing) {
    await db
      .update(kiwifyConfig)
      .set({
        clientSecret,
        webhookSecret,
        isActive:   true,
        // limpa o token armazenado ao trocar de credencial
        accessToken:  "",
        tokenExpiry:  null,
        updatedAt:    new Date(),
      })
      .where(eq(kiwifyConfig.id, existing.id));
  } else {
    await db.insert(kiwifyConfig).values({
      clientSecret,
      webhookSecret,
      isActive: true,
    });
  }

  req.log.info("kiwify: config saved");
  res.json({ ok: true });
});

// ─── ADMIN: Test connection ───────────────────────────────────────────────────
/**
 * POST /kiwify/test-connection
 *
 * Valida o client_secret salvo chamando a API real da Kiwify.
 * Se bem-sucedido, salva o access_token e a data de expiração no banco.
 *
 * Retorna:
 *   { ok: true,  status: "validated",    accountName, accountId, expiresAt }
 *   { ok: false, status: "auth_error",   error }
 *   { ok: false, status: "network_error",error }
 *   { ok: false, status: "not_configured" }
 */
router.post("/kiwify/test-connection", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(kiwifyConfig).limit(1);

  if (!config?.clientSecret) {
    res.status(400).json({ ok: false, status: "not_configured", error: "Nenhum client_secret configurado." });
    return;
  }

  req.log.info("kiwify: testing connection");
  const result = await testKiwifyConnection(config.clientSecret);

  if (result.ok && result.accessToken) {
    const expiresAt = result.expiresIn
      ? new Date(Date.now() + result.expiresIn * 1000)
      : new Date(Date.now() + 96 * 60 * 60 * 1000); // fallback 96h

    await db
      .update(kiwifyConfig)
      .set({
        accessToken:  result.accessToken,
        tokenExpiry:  expiresAt,
        updatedAt:    new Date(),
      })
      .where(eq(kiwifyConfig.id, config.id));

    req.log.info({ accountId: result.accountId }, "kiwify: connection validated");
    res.json({
      ok:          true,
      status:      "validated",
      accountName: result.accountName,
      accountId:   result.accountId,
      expiresAt,
    });
    return;
  }

  req.log.warn({ status: result.status, error: result.error }, "kiwify: connection test failed");
  res.status(422).json({
    ok:     false,
    status: result.status,
    error:  result.error,
  });
});

// ─── ADMIN: Sync products ─────────────────────────────────────────────────────
/**
 * POST /kiwify/sync-products
 *
 * Busca produtos reais da Kiwify API e faz upsert na tabela kiwify_products.
 * Requer que a conexão já tenha sido testada (accessToken válido no banco).
 */
router.post("/kiwify/sync-products", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(kiwifyConfig).limit(1);

  if (!config?.isActive || !config.clientSecret) {
    res.status(503).json({ error: "Kiwify não configurado" });
    return;
  }

  // Garante um token válido
  let accessToken = config.accessToken ?? "";
  const tokenExpired = config.tokenExpiry ? config.tokenExpiry < new Date() : true;

  if (!accessToken || tokenExpired) {
    req.log.info("kiwify: token expired or missing — refreshing before sync");
    const tokenRes = await getKiwifyAccessToken(config.clientSecret);
    if (!tokenRes.access_token) {
      res.status(422).json({
        error:  "Não foi possível obter token. Verifique o client_secret.",
        detail: tokenRes.message ?? tokenRes.error,
      });
      return;
    }
    accessToken = tokenRes.access_token;
    const expiresAt = tokenRes.expires_in
      ? new Date(Date.now() + tokenRes.expires_in * 1000)
      : new Date(Date.now() + 96 * 60 * 60 * 1000);
    await db
      .update(kiwifyConfig)
      .set({ accessToken, tokenExpiry: expiresAt, updatedAt: new Date() })
      .where(eq(kiwifyConfig.id, config.id));
  }

  req.log.info("kiwify: syncing products");
  const products = await getKiwifyProducts(accessToken, config.clientSecret);

  let synced = 0;
  for (const p of products) {
    await db
      .insert(kiwifyProducts)
      .values({
        productId: p.id,
        name:      p.name ?? "",
        type:      p.type ?? "",
        status:    p.status ?? "",
        price:     p.price != null ? String(p.price) : null,
        syncedAt:  new Date(),
      })
      .onConflictDoUpdate({
        target: kiwifyProducts.productId,
        set: {
          name:     p.name ?? "",
          type:     p.type ?? "",
          status:   p.status ?? "",
          price:    p.price != null ? String(p.price) : null,
          syncedAt: new Date(),
        },
      });
    synced++;
  }

  req.log.info({ synced }, "kiwify: products synced");
  res.json({ ok: true, synced });
});

// ─── ADMIN: List products ─────────────────────────────────────────────────────
router.get("/kiwify/products", requireAdmin, async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(kiwifyProducts)
    .orderBy(desc(kiwifyProducts.syncedAt))
    .limit(100);
  res.json(products);
});

// ─── ADMIN: List events ───────────────────────────────────────────────────────
router.get("/kiwify/events", requireAdmin, async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(kiwifyEvents)
    .orderBy(desc(kiwifyEvents.receivedAt))
    .limit(100);
  res.json(events);
});

export default router;
