import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  hotmartConfig,
  hotmartProducts,
  hotmartEvents,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { verifyHotmartWebhook } from "../lib/hotmart.js";

const router: IRouter = Router();

// ─── PUBLIC: Receive Hotmart webhook events ──────────────────────────────────
router.post("/hotmart/webhook", (req, res): void => {
  const payload = req.body as Record<string, unknown>;

  // Hotmart sends the token in the hottok query param or X-Hotmart-Webhook-Token header
  const receivedToken =
    (req.query["hottok"] as string | undefined) ??
    (req.headers["x-hotmart-webhook-token"] as string | undefined);

  // Validate token asynchronously — still accept to avoid blocking Hotmart retries
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
        value: String((purchase as Record<string, unknown> | undefined)?.price !== undefined
          ? ((purchase?.price as Record<string, unknown>)?.value ?? "")
          : ""),
        currency: (((purchase as Record<string, unknown> | undefined)?.price as Record<string, unknown> | undefined)?.currency_code as string | undefined) ?? "BRL",
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

// ─── ADMIN: Get config ────────────────────────────────────────────────────────
router.get("/hotmart/config", requireAdmin, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(hotmartConfig).limit(1);
  if (!config) {
    res.json({ configured: false });
    return;
  }
  res.json({
    configured: true,
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

// ─── ADMIN: Sync products ─────────────────────────────────────────────────────
router.post("/hotmart/sync-products", requireAdmin, async (req, res): Promise<void> => {
  const [config] = await db.select().from(hotmartConfig).limit(1);
  if (!config?.isActive) {
    res.status(503).json({ error: "Hotmart não configurado" });
    return;
  }
  // TODO: call getHotmartAccessToken() then getHotmartProducts() and upsert
  req.log.info("hotmart: sync-products triggered (placeholder)");
  res.json({ ok: true, synced: 0, message: "Sincronização de produtos não implementada ainda." });
});

// ─── ADMIN: List products ─────────────────────────────────────────────────────
router.get("/hotmart/products", requireAdmin, async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(hotmartProducts)
    .orderBy(desc(hotmartProducts.syncedAt))
    .limit(100);
  res.json(products);
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

export default router;
