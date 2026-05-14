import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import {
  db,
  whatsappConfig,
  whatsappEvents,
  metaConfig,
  metaEvents,
  shopeeConfig,
  shopeeEvents,
  mlConfig,
  mlEvents,
  hotmartConfig,
  hotmartEvents,
  kiwifyConfig,
  kiwifyEvents,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import {
  resolveIntegrationStatus,
  tokenIsExpired,
  type NormalizedEvent,
  type IntegrationId,
} from "../lib/integrationUtils.js";

const router: IRouter = Router();

// ─── GET /integrations/status — all 6 integrations at once ──────────────────
router.get("/integrations/status", requireAdmin, async (req, res): Promise<void> => {
  try {
    const [wa, meta, shopee, ml, hotmart, kiwify] = await Promise.all([
      db.select().from(whatsappConfig).limit(1).then((r) => r[0] ?? null),
      db.select().from(metaConfig).limit(1).then((r) => r[0] ?? null),
      db.select().from(shopeeConfig).limit(1).then((r) => r[0] ?? null),
      db.select().from(mlConfig).limit(1).then((r) => r[0] ?? null),
      db.select().from(hotmartConfig).limit(1).then((r) => r[0] ?? null),
      db.select().from(kiwifyConfig).limit(1).then((r) => r[0] ?? null),
    ]);

    res.json([
      resolveIntegrationStatus(wa, "whatsapp", "WhatsApp", {
        extraInfo: wa?.phoneNumberId ? `+${wa.phoneNumberId}` : null,
      }),
      resolveIntegrationStatus(meta, "meta", "Meta (IG + FB)", {
        extraInfo: meta?.appId ?? null,
      }),
      resolveIntegrationStatus(shopee, "shopee", "Shopee", {
        extraInfo: shopee?.shopId ? `Shop ID: ${shopee.shopId}` : null,
        tokenExpired: shopee?.tokenExpiry ? tokenIsExpired(shopee.tokenExpiry) : false,
      }),
      resolveIntegrationStatus(ml, "ml", "Mercado Livre", {
        extraInfo: ml?.userId ? `User ID: ${ml.userId}` : null,
        tokenExpired: ml?.tokenExpiry ? tokenIsExpired(ml.tokenExpiry) : false,
      }),
      resolveIntegrationStatus(hotmart, "hotmart", "Hotmart", {
        environment: hotmart?.environment ?? null,
      }),
      resolveIntegrationStatus(kiwify, "kiwify", "Kiwify", {
        extraInfo: kiwify?.storeId ? `Store: ${kiwify.storeId}` : null,
        tokenExpired: kiwify?.tokenExpiry ? tokenIsExpired(kiwify.tokenExpiry) : false,
      }),
    ]);
  } catch (err) {
    req.log.error({ err }, "integrations: failed to fetch status");
    res.status(500).json({ error: "internal error" });
  }
});

// ─── GET /integrations/events — unified event feed from all platforms ────────
router.get("/integrations/events", requireAdmin, async (req, res): Promise<void> => {
  const limit = 30;

  try {
    const [waEvts, metaEvts, shopeeEvts, mlEvts, hotmartEvts, kiwifyEvts] =
      await Promise.all([
        db.select().from(whatsappEvents).orderBy(desc(whatsappEvents.receivedAt)).limit(limit),
        db.select().from(metaEvents).orderBy(desc(metaEvents.receivedAt)).limit(limit),
        db.select().from(shopeeEvents).orderBy(desc(shopeeEvents.receivedAt)).limit(limit),
        db.select().from(mlEvents).orderBy(desc(mlEvents.receivedAt)).limit(limit),
        db.select().from(hotmartEvents).orderBy(desc(hotmartEvents.receivedAt)).limit(limit),
        db.select().from(kiwifyEvents).orderBy(desc(kiwifyEvents.receivedAt)).limit(limit),
      ]);

    const normalized: NormalizedEvent[] = [
      ...waEvts.map((e) => ({
        platform: "whatsapp" as IntegrationId,
        platformLabel: "WhatsApp",
        eventType: e.eventType ?? "message",
        primaryText: e.fromNumber ?? null,
        secondaryText: null,
        value: null,
        currency: null,
        receivedAt: e.receivedAt,
      })),
      ...metaEvts.map((e) => ({
        platform: "meta" as IntegrationId,
        platformLabel: e.platform === "instagram" ? "Instagram" : "Facebook",
        eventType: e.eventType ?? "event",
        primaryText: e.objectId ?? null,
        secondaryText: null,
        value: null,
        currency: null,
        receivedAt: e.receivedAt,
      })),
      ...shopeeEvts.map((e) => ({
        platform: "shopee" as IntegrationId,
        platformLabel: "Shopee",
        eventType: e.eventType ?? "event",
        primaryText: e.shopId ? `Shop ${e.shopId}` : null,
        secondaryText: null,
        value: null,
        currency: null,
        receivedAt: e.receivedAt,
      })),
      ...mlEvts.map((e) => ({
        platform: "ml" as IntegrationId,
        platformLabel: "Mercado Livre",
        eventType: e.topic ?? "notification",
        primaryText: e.resource ?? null,
        secondaryText: null,
        value: null,
        currency: null,
        receivedAt: e.receivedAt,
      })),
      ...hotmartEvts.map((e) => ({
        platform: "hotmart" as IntegrationId,
        platformLabel: "Hotmart",
        eventType: e.eventType ?? "event",
        primaryText: e.buyerName ?? e.buyerEmail ?? null,
        secondaryText: e.transactionId ?? null,
        value: e.value,
        currency: e.currency,
        receivedAt: e.receivedAt,
      })),
      ...kiwifyEvts.map((e) => ({
        platform: "kiwify" as IntegrationId,
        platformLabel: "Kiwify",
        eventType: e.eventType ?? "event",
        primaryText: e.buyerName ?? e.buyerEmail ?? null,
        secondaryText: e.orderId ?? null,
        value: e.value,
        currency: e.currency,
        receivedAt: e.receivedAt,
      })),
    ];

    // Sort by receivedAt desc and take top 50
    normalized.sort((a, b) => {
      const ta = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
      const tb = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
      return tb - ta;
    });

    res.json(normalized.slice(0, 50));
  } catch (err) {
    req.log.error({ err }, "integrations: failed to fetch events");
    res.status(500).json({ error: "internal error" });
  }
});

export default router;
