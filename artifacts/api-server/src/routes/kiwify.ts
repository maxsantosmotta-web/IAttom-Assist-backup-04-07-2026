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
import { verifyKiwifyWebhook } from "../lib/kiwify.js";

const router: IRouter = Router();

// ─── PUBLIC: Receive Kiwify webhook events ───────────────────────────────────
router.post("/kiwify/webhook", (req, res): void => {
  const rawBody = JSON.stringify(req.body);
  const payload = req.body as Record<string, unknown>;

  // Kiwify sends the signature in the query param `signature`
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
        orderId: (order?.id as string | undefined) ?? null,
        productId: (product?.id as string | undefined) ?? null,
        buyerEmail: (customer?.email as string | undefined) ?? null,
        buyerName: (customer?.full_name as string | undefined) ?? null,
        value: String((order?.amount as number | undefined) ?? ""),
        currency: "BRL",
        payload,
      });
    })
    .then(() => {
      res.status(200).json({ status: "ok" });
    })
    .catch((err: unknown) => {
      req.log.error({ err }, "kiwify: failed to save event");
      res.status(200).json({ status: "ok" });
    });
});

// ─── ADMIN: Get config ────────────────────────────────────────────────────────
router.get("/kiwify/config", requireAdmin, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(kiwifyConfig).limit(1);
  if (!config) {
    res.json({ configured: false });
    return;
  }
  res.json({
    configured: true,
    storeId: config.storeId,
    clientId: config.clientId,
    clientSecret: config.clientSecret ? "••••••••" + config.clientSecret.slice(-4) : "",
    webhookSecret: config.webhookSecret ? "••••••••" + config.webhookSecret.slice(-4) : "",
    accessToken: config.accessToken ? "••••••••" + config.accessToken.slice(-4) : "",
    tokenExpiry: config.tokenExpiry,
    isActive: config.isActive,
    updatedAt: config.updatedAt,
  });
});

// ─── ADMIN: Save config ───────────────────────────────────────────────────────
const configSchema = z.object({
  storeId: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  webhookSecret: z.string().min(1),
});

router.post("/kiwify/config", requireAdmin, async (req, res): Promise<void> => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload", issues: parsed.error.issues });
    return;
  }
  const { storeId, clientId, clientSecret, webhookSecret } = parsed.data;
  const [existing] = await db.select().from(kiwifyConfig).limit(1);

  if (existing) {
    await db
      .update(kiwifyConfig)
      .set({ storeId, clientId, clientSecret, webhookSecret, isActive: true, updatedAt: new Date() })
      .where(eq(kiwifyConfig.id, existing.id));
  } else {
    await db.insert(kiwifyConfig).values({ storeId, clientId, clientSecret, webhookSecret, isActive: true });
  }

  req.log.info({ storeId }, "kiwify: config saved");
  res.json({ ok: true });
});

// ─── ADMIN: Sync products ─────────────────────────────────────────────────────
router.post("/kiwify/sync-products", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(kiwifyConfig).limit(1);
  if (!config?.isActive) {
    res.status(503).json({ error: "Kiwify não configurado" });
    return;
  }
  // TODO: call getKiwifyAccessToken() then getKiwifyProducts() and upsert
  req.log.info("kiwify: sync-products triggered (placeholder)");
  res.json({ ok: true, synced: 0, message: "Sincronização de produtos não implementada ainda." });
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
