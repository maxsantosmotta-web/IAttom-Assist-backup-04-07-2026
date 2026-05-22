import { Router, type IRouter } from "express";
import { eq, desc, isNull, isNotNull, and, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  hotmartConfig,
  hotmartProducts,
  hotmartEvents,
  userHotmartConnections,
  userHotmartProductClaims,
  trashItems,
} from "@workspace/db";
import { requireAdmin, type AdminRequest } from "../middlewares/requireAdmin.js";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import {
  verifyHotmartWebhook,
  getHotmartAccessToken,
  getHotmartProducts,
} from "../lib/hotmart.js";

const router: IRouter = Router();

// Set to true once real Hotmart OAuth/API credentials are validated and ready.
// While false: connect/disconnect are blocked, user status always returns "not configured",
// and the admin user-connections list returns empty.
const HOTMART_INTEGRATION_READY = false;

// ─── PUBLIC: Receive Hotmart webhook events ───────────────────────────────────
router.post("/hotmart/webhook", (req, res): void => {
  const payload = req.body as Record<string, unknown>;

  const receivedToken =
    (req.query["hottok"] as string | undefined) ??
    (req.headers["x-hotmart-webhook-token"] as string | undefined);

  db.select()
    .from(hotmartConfig)
    .limit(1)
    .then(([config]) => {
      if (config?.webhookToken && receivedToken) {
        const valid = verifyHotmartWebhook(config.webhookToken, receivedToken);
        if (!valid) {
          req.log.warn("hotmart: webhook token mismatch — storing anyway");
        }
      }

      const event = payload.event as string | undefined;
      const data = payload.data as Record<string, unknown> | undefined;
      const purchase = data?.purchase as Record<string, unknown> | undefined;
      const buyer = data?.buyer as Record<string, unknown> | undefined;
      const product = data?.product as Record<string, unknown> | undefined;

      req.log.info({ event }, "hotmart: event received");

      return db.insert(hotmartEvents).values({
        eventType: event ?? "UNKNOWN",
        transactionId: (purchase?.transaction as string | undefined) ?? null,
        productId: String((product?.id as number | undefined) ?? ""),
        buyerEmail: (buyer?.email as string | undefined) ?? null,
        buyerName: (buyer?.name as string | undefined) ?? null,
        value: String(
          (purchase as Record<string, unknown> | undefined)?.price !== undefined
            ? ((purchase?.price as Record<string, unknown>)?.value ?? "")
            : "",
        ),
        currency:
          (((purchase as Record<string, unknown> | undefined)
            ?.price as Record<string, unknown> | undefined)
            ?.currency_code as string | undefined) ?? "BRL",
        payload,
      });
    })
    .then(() => {
      res.status(200).json({ status: "ok" });
    })
    .catch((err: unknown) => {
      req.log.error({ err }, "hotmart: failed to save event");
      res.status(200).json({ status: "ok" });
    });
});

// ─── PUBLIC: OAuth callback — deprecated, redirect to dashboard ──────────────
router.get("/hotmart/oauth/callback", (_req, res): void => {
  res.redirect("https://iattomassist.com.br/dashboard/hotmart");
});

// ─── ADMIN: Get platform config ───────────────────────────────────────────────
router.get("/hotmart/config", requireAdmin, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(hotmartConfig).limit(1);
  if (!config) {
    res.json({ configured: false, isActive: false });
    return;
  }
  res.json({
    configured: !!(config.clientId && config.clientSecret && config.basicToken),
    clientId: config.clientId,
    clientSecret: config.clientSecret ? "••••••••" + config.clientSecret.slice(-4) : "",
    basicToken: config.basicToken ? "••••" : "",
    webhookToken: config.webhookToken ? "••••••••" + config.webhookToken.slice(-4) : "",
    environment: config.environment,
    isActive: config.isActive,
    updatedAt: config.updatedAt,
  });
});

// ─── ADMIN: Save config ───────────────────────────────────────────────────────
const configSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  basicToken: z.string().min(1),
  webhookToken: z.string().min(1),
  environment: z.enum(["sandbox", "production"]).optional(),
});

router.post("/hotmart/config", requireAdmin, async (req, res): Promise<void> => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload", issues: parsed.error.issues });
    return;
  }
  const { clientId, clientSecret, basicToken, webhookToken, environment } = parsed.data;
  const [existing] = await db.select().from(hotmartConfig).limit(1);

  if (existing) {
    await db
      .update(hotmartConfig)
      .set({
        clientId,
        clientSecret,
        basicToken,
        webhookToken,
        environment: environment ?? existing.environment ?? "sandbox",
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(hotmartConfig.id, existing.id));
  } else {
    await db.insert(hotmartConfig).values({
      clientId,
      clientSecret,
      basicToken,
      webhookToken,
      environment: environment ?? "sandbox",
      isActive: true,
    });
  }

  req.log.info({ clientId, environment }, "hotmart: config saved");
  res.json({ ok: true });
});

// ─── ADMIN: Test platform connection ─────────────────────────────────────────
router.post("/hotmart/test", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(hotmartConfig).limit(1);
  if (!config?.isActive) {
    res.status(503).json({ error: "Hotmart não configurado. Salve as credenciais primeiro." });
    return;
  }

  try {
    const token = await getHotmartAccessToken(
      config.clientId,
      config.clientSecret,
      config.basicToken,
      config.environment,
    );

    if (token.error || !token.access_token) {
      req.log.warn({ error: token.error }, "hotmart: test connection failed");
      res.status(401).json({
        error: `Autenticação falhou: ${token.error ?? "sem access_token na resposta"}`,
      });
      return;
    }

    req.log.info({ environment: config.environment }, "hotmart: test connection ok");
    res.json({ ok: true, message: "Conexão com a API Hotmart estabelecida com sucesso." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "hotmart: test connection error");
    res.status(500).json({ error: msg });
  }
});

// ─── ADMIN: Sync products ─────────────────────────────────────────────────────
router.post("/hotmart/sync-products", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(hotmartConfig).limit(1);
  if (!config?.isActive) {
    res.status(503).json({ error: "Hotmart não configurado" });
    return;
  }

  try {
    const token = await getHotmartAccessToken(
      config.clientId,
      config.clientSecret,
      config.basicToken,
      config.environment,
    );

    if (!token.access_token) {
      res.status(401).json({ error: "Falha ao obter token Hotmart. Verifique as credenciais." });
      return;
    }

    const { items, diagnostics } = await getHotmartProducts(token.access_token, config.environment);

    if (items.length === 0) {
      req.log.info({ diagnostics }, "hotmart: sync-products — zero products");
      res.json({
        ok: true,
        synced: 0,
        diagnostics,
        message: "Nenhum produto encontrado nesta credencial.",
      });
      return;
    }

    let synced = 0;
    for (const item of items) {
      await db
        .insert(hotmartProducts)
        .values({
          productId: String(item.product.id),
          name: item.product.name ?? "",
          format: item.product.format ?? "",
          status: item.product.status ?? "ACTIVE",
          price: String(item.price?.value ?? 0),
          currency: item.price?.currency_code ?? "BRL",
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: hotmartProducts.productId,
          set: {
            name: item.product.name ?? "",
            format: item.product.format ?? "",
            status: item.product.status ?? "ACTIVE",
            price: String(item.price?.value ?? 0),
            syncedAt: new Date(),
          },
        });
      synced++;
    }

    req.log.info({ synced, diagnostics }, "hotmart: sync-products complete");
    res.json({ ok: true, synced, diagnostics });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "hotmart: sync-products unexpected error");
    res.status(422).json({ error: `Falha na sincronização: ${msg}` });
  }
});

// ─── ADMIN: List products ─────────────────────────────────────────────────────
router.get("/hotmart/products", requireAdmin, async (req, res): Promise<void> => {
  const products = await db
    .select()
    .from(hotmartProducts)
    .where(isNull(hotmartProducts.deletedAt))
    .orderBy(desc(hotmartProducts.syncedAt))
    .limit(100);

  req.log.info({ count: products.length }, "hotmart: products listed");
  res.json(products);
});

// ─── ADMIN: Manually create a product ────────────────────────────────────────
const manualProductSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  productId: z.string().min(1, "ID do produto obrigatório"),
  format: z.string().optional().default("Produto próprio"),
  status: z.string().optional().default("ACTIVE"),
  price: z.string().optional().default("0"),
  currency: z.string().optional().default("BRL"),
});

router.post("/hotmart/products/manual", requireAdmin, async (req, res): Promise<void> => {
  const parsed = manualProductSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(", ");
    res.status(422).json({ error: msg });
    return;
  }

  const { name, productId, format, status, price, currency } = parsed.data;

  await db
    .insert(hotmartProducts)
    .values({ name, productId, format, status, price, currency, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: hotmartProducts.productId,
      set: { name, format, status, syncedAt: new Date() },
    });

  const [product] = await db
    .select()
    .from(hotmartProducts)
    .where(eq(hotmartProducts.productId, productId))
    .limit(1);

  req.log.info({ productId, name }, "hotmart: product created/updated manually");
  res.json({ ok: true, product });
});

// ─── ADMIN: List product trash ────────────────────────────────────────────────
router.get("/hotmart/products/trash", requireAdmin, async (_req, res): Promise<void> => {
  const trashed = await db
    .select()
    .from(hotmartProducts)
    .where(isNotNull(hotmartProducts.deletedAt))
    .orderBy(desc(hotmartProducts.deletedAt))
    .limit(100);
  res.json(trashed);
});

// ─── ADMIN: Restore product from trash ───────────────────────────────────────
router.post("/hotmart/products/:id/restore", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  await db.update(hotmartProducts).set({ deletedAt: null }).where(eq(hotmartProducts.id, id));
  await db.delete(trashItems).where(and(eq(trashItems.originalId, id), eq(trashItems.platform, "hotmart")));
  req.log.info({ id }, "hotmart: product restored from trash");
  res.json({ ok: true });
});

// ─── ADMIN: Permanently delete product ───────────────────────────────────────
router.delete("/hotmart/products/:id/permanent", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  await db.delete(hotmartProducts).where(eq(hotmartProducts.id, id));
  await db.delete(trashItems).where(and(eq(trashItems.originalId, id), eq(trashItems.platform, "hotmart")));
  req.log.info({ id }, "hotmart: product permanently deleted");
  res.json({ ok: true });
});

// ─── ADMIN: Soft delete product ───────────────────────────────────────────────
router.delete("/hotmart/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [product] = await db.select().from(hotmartProducts).where(eq(hotmartProducts.id, id)).limit(1);
  if (!product) { res.status(404).json({ error: "Produto não encontrado" }); return; }
  await db.update(hotmartProducts).set({ deletedAt: new Date() }).where(eq(hotmartProducts.id, id));
  await db.insert(trashItems).values({
    originalId: id,
    platform: "hotmart",
    itemType: "product",
    name: product.name ?? product.productId,
    previousStatus: product.status ?? "",
    snapshot: JSON.stringify(product),
    clerkUserId: (req as AdminRequest).clerkUserId,
  });
  req.log.info({ id }, "hotmart: product moved to trash");
  res.json({ ok: true });
});

// ─── ADMIN: List events ───────────────────────────────────────────────────────
router.get("/hotmart/events", requireAdmin, async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(hotmartEvents)
    .orderBy(desc(hotmartEvents.receivedAt))
    .limit(100);
  res.json(events);
});

// ─── ADMIN: List per-user connections (monitoring only) ───────────────────────
router.get("/hotmart/user-connections", requireAdmin, async (_req, res): Promise<void> => {
  if (!HOTMART_INTEGRATION_READY) { res.json([]); return; }
  const connections = await db
    .select({
      id: userHotmartConnections.id,
      clerkUserId: userHotmartConnections.clerkUserId,
      platformUserId: userHotmartConnections.platformUserId,
      platformUsername: userHotmartConnections.platformUsername,
      expiresAt: userHotmartConnections.expiresAt,
      isActive: userHotmartConnections.isActive,
      createdAt: userHotmartConnections.createdAt,
      updatedAt: userHotmartConnections.updatedAt,
    })
    .from(userHotmartConnections)
    .orderBy(desc(userHotmartConnections.createdAt))
    .limit(200);
  res.json(connections);
});

// ─── USER: Connect — blocked until real OAuth is ready ───────────────────────
router.post("/hotmart/user/connect", requireAuth, async (req, res): Promise<void> => {
  if (!HOTMART_INTEGRATION_READY) {
    res.status(503).json({ error: "Integração Hotmart em preparação. Aguarde a configuração da central." });
    return;
  }
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

  const [config] = await db.select().from(hotmartConfig).limit(1);
  if (!config?.clientId || !config?.clientSecret || !config?.basicToken) {
    res.status(503).json({ error: "Configure a Hotmart no painel ADM." });
    return;
  }

  const [existing] = await db
    .select()
    .from(userHotmartConnections)
    .where(eq(userHotmartConnections.clerkUserId, clerkUserId))
    .limit(1);

  if (existing) {
    await db
      .update(userHotmartConnections)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(userHotmartConnections.id, existing.id));
  } else {
    await db.insert(userHotmartConnections).values({
      clerkUserId,
      platformUserId: "",
      platformUsername: "",
      accessToken: "",
      refreshToken: "",
      expiresAt: null,
      scopes: "",
      isActive: true,
    });
  }

  req.log.info({ clerkUserId }, "hotmart: user connected via ADM credentials");
  res.json({ ok: true });
});

// ─── USER: Integration status (per-user) ─────────────────────────────────────
router.get("/hotmart/user/integration-status", requireAuth, async (req, res): Promise<void> => {
  if (!HOTMART_INTEGRATION_READY) {
    res.json({ configured: false, isActive: false, platformUsername: null, connectedAt: null, tokenExpired: false });
    return;
  }
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

  // Also check if platform is configured at all
  const [platformConfig] = await db.select().from(hotmartConfig).limit(1);
  const platformConfigured = !!(platformConfig?.clientId && platformConfig?.clientSecret && platformConfig?.basicToken);

  const [conn] = await db
    .select()
    .from(userHotmartConnections)
    .where(
      and(
        eq(userHotmartConnections.clerkUserId, clerkUserId),
        eq(userHotmartConnections.isActive, true),
      ),
    )
    .limit(1);

  if (!conn) {
    res.json({
      configured: platformConfigured,
      isActive: false,
      platformUsername: null,
      connectedAt: null,
      tokenExpired: false,
    });
    return;
  }

  const tokenExpired = conn.expiresAt ? conn.expiresAt < new Date() : false;

  res.json({
    configured: platformConfigured,
    isActive: true,
    platformUsername: conn.platformUsername ?? null,
    connectedAt: conn.createdAt,
    tokenExpired,
  });
});

// ─── USER: Disconnect (per-user) ──────────────────────────────────────────────
router.post("/hotmart/user/disconnect", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

  await db
    .update(userHotmartConnections)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(userHotmartConnections.clerkUserId, clerkUserId));

  req.log.info({ clerkUserId }, "hotmart: user disconnected");
  res.json({ ok: true });
});


// ─── USER: List products (filtered by user's claimed product_ids) ─────────────
router.get("/hotmart/user/products", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

  const claims = await db
    .select({ productId: userHotmartProductClaims.productId })
    .from(userHotmartProductClaims)
    .where(eq(userHotmartProductClaims.clerkUserId, clerkUserId));

  if (claims.length === 0) {
    res.json([]);
    return;
  }

  const claimedIds = claims.map((c) => c.productId);

  const products = await db
    .select()
    .from(hotmartProducts)
    .where(and(isNull(hotmartProducts.deletedAt), inArray(hotmartProducts.productId, claimedIds)))
    .orderBy(desc(hotmartProducts.syncedAt))
    .limit(100);

  req.log.info({ count: products.length, clerkUserId }, "hotmart user: products listed by claims");
  res.json(products);
});

// ─── USER: List sales/events (requires active per-user connection) ────────────
router.get("/hotmart/user/sales", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

  const [conn] = await db
    .select()
    .from(userHotmartConnections)
    .where(
      and(
        eq(userHotmartConnections.clerkUserId, clerkUserId),
        eq(userHotmartConnections.isActive, true),
      ),
    )
    .limit(1);

  if (!conn) {
    res.json([]);
    return;
  }

  const events = await db
    .select()
    .from(hotmartEvents)
    .orderBy(desc(hotmartEvents.receivedAt))
    .limit(100);

  req.log.info({ count: events.length, clerkUserId }, "hotmart user: sales listed");
  res.json(events);
});

// ─── USER: Sync products using ADM central credentials ───────────────────────
router.post("/hotmart/user/sync", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

  const [conn] = await db
    .select()
    .from(userHotmartConnections)
    .where(
      and(
        eq(userHotmartConnections.clerkUserId, clerkUserId),
        eq(userHotmartConnections.isActive, true),
      ),
    )
    .limit(1);

  if (!conn) {
    res.status(403).json({ error: "Conta Hotmart não conectada. Clique em Conectar Hotmart." });
    return;
  }

  const [platformConfig] = await db.select().from(hotmartConfig).limit(1);
  if (!platformConfig?.clientId || !platformConfig?.clientSecret || !platformConfig?.basicToken) {
    res.status(503).json({ error: "Configure a Hotmart no painel ADM." });
    return;
  }

  const environment = platformConfig.environment ?? "sandbox";

  try {
    const token = await getHotmartAccessToken(
      platformConfig.clientId,
      platformConfig.clientSecret,
      platformConfig.basicToken,
      environment,
    );

    if (!token.access_token) {
      req.log.warn({ clerkUserId }, "hotmart user: sync — ADM token fetch failed");
      res.json({ ok: true, synced: 0 });
      return;
    }

    const { items, diagnostics } = await getHotmartProducts(token.access_token, environment);

    if (items.length === 0) {
      req.log.info({ diagnostics, clerkUserId }, "hotmart user: sync — zero products");
      res.json({ ok: true, synced: 0, diagnostics });
      return;
    }

    let synced = 0;
    for (const item of items) {
      await db
        .insert(hotmartProducts)
        .values({
          productId: String(item.product.id),
          name: item.product.name ?? "",
          format: item.product.format ?? "",
          status: item.product.status ?? "ACTIVE",
          price: String(item.price?.value ?? 0),
          currency: item.price?.currency_code ?? "BRL",
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: hotmartProducts.productId,
          set: {
            name: item.product.name ?? "",
            format: item.product.format ?? "",
            status: item.product.status ?? "ACTIVE",
            price: String(item.price?.value ?? 0),
            syncedAt: new Date(),
          },
        });
      synced++;
    }

    req.log.info({ synced, clerkUserId }, "hotmart user: sync complete");
    res.json({ ok: true, synced });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err, clerkUserId }, "hotmart user: sync error");
    res.status(500).json({ error: `Falha na sincronização: ${msg}` });
  }
});

// ─── USER: List claimed products ─────────────────────────────────────────────
router.get("/hotmart/user/claimed-products", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

  const claims = await db
    .select()
    .from(userHotmartProductClaims)
    .where(eq(userHotmartProductClaims.clerkUserId, clerkUserId))
    .orderBy(desc(userHotmartProductClaims.createdAt));

  req.log.info({ count: claims.length, clerkUserId }, "hotmart user: claimed-products listed");
  res.json(claims);
});

// ─── USER: Claim a product ────────────────────────────────────────────────────
const claimProductSchema = z.object({
  productId: z.string().min(1, "productId obrigatório"),
});

router.post("/hotmart/user/claim-product", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

  const parsed = claimProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "productId obrigatório" });
    return;
  }

  const { productId } = parsed.data;

  await db
    .insert(userHotmartProductClaims)
    .values({ clerkUserId, productId })
    .onConflictDoNothing();

  req.log.info({ clerkUserId, productId }, "hotmart user: product claimed");
  res.json({ ok: true, clerkUserId, productId });
});

// ─── USER: Remove a product claim ────────────────────────────────────────────
router.delete("/hotmart/user/claim-product/:productId", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
  const productId = req.params["productId"] as string;

  if (!productId) {
    res.status(400).json({ error: "productId obrigatório" });
    return;
  }

  await db
    .delete(userHotmartProductClaims)
    .where(
      and(
        eq(userHotmartProductClaims.clerkUserId, clerkUserId),
        eq(userHotmartProductClaims.productId, productId),
      ),
    );

  req.log.info({ clerkUserId, productId }, "hotmart user: product claim removed");
  res.json({ ok: true });
});

export default router;
