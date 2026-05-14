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
import {
  IntegrationManager,
  EventManager,
  LoggerManager,
  NotificationManager,
  RetryQueue,
  TokenManager,
} from "../lib/integrations/index.js";

const router: IRouter = Router();

// ─── GET /integrations/status — all 6 integrations (DB-based, for frontend) ──
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

// ─── GET /integrations/events — unified DB event feed ────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MANAGER ENDPOINTS — infrastructure data (in-memory) ─────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /integrations/health — IntegrationManager cached health ──────────────
router.get("/integrations/health", requireAdmin, async (req, res): Promise<void> => {
  try {
    // Prefer cached, fallback to fresh check
    const cached = IntegrationManager.getAllHealth();
    if (cached.length > 0) {
      res.json({
        health: cached,
        connectedCount: IntegrationManager.connectedCount,
        errorCount: IntegrationManager.errorCount,
        checkedAt: cached[0]?.lastCheckedAt,
      });
      return;
    }

    const health = await IntegrationManager.checkHealth();
    res.json({
      health,
      connectedCount: IntegrationManager.connectedCount,
      errorCount: IntegrationManager.errorCount,
      checkedAt: new Date(),
    });
  } catch (err) {
    req.log.error({ err }, "integrations: health check failed");
    res.status(500).json({ error: "internal error" });
  }
});

// ─── GET /integrations/logs — LoggerManager in-memory log entries ─────────────
router.get("/integrations/logs", requireAdmin, (req, res): void => {
  const integrationId = req.query["integration"] as string | undefined;
  const level = req.query["level"] as string | undefined;
  const limit = parseInt(req.query["limit"] as string ?? "100", 10);
  const since = req.query["since"] ? new Date(req.query["since"] as string) : undefined;

  const logs = LoggerManager.getLogs({
    integrationId: integrationId as Parameters<typeof LoggerManager.getLogs>[0] extends { integrationId?: infer T } ? T : never,
    level: level as Parameters<typeof LoggerManager.getLogs>[0] extends { level?: infer T } ? T : never,
    limit,
    since,
  });

  res.json({ logs, total: LoggerManager.totalCount });
});

// ─── GET /integrations/notifications — NotificationManager ───────────────────
router.get("/integrations/notifications", requireAdmin, (req, res): void => {
  const integrationId = req.query["integration"] as string | undefined;
  const unreadOnly = req.query["unread"] === "true";
  const limit = parseInt(req.query["limit"] as string ?? "50", 10);

  type NotifOpts = Parameters<typeof NotificationManager.getAll>[0];
  const notifications = NotificationManager.getAll({
    integrationId: integrationId as NotifOpts extends { integrationId?: infer T } ? T : never,
    unreadOnly,
    limit,
  });

  res.json({
    notifications,
    unreadCount: NotificationManager.unreadCount,
    total: NotificationManager.totalCount,
  });
});

// ─── POST /integrations/notifications/:id/read ────────────────────────────────
router.post("/integrations/notifications/:id/read", requireAdmin, (req, res): void => {
  const id = req.params["id"] as string;
  const ok = NotificationManager.markRead(id);
  res.json({ ok, unreadCount: NotificationManager.unreadCount });
});

// ─── POST /integrations/notifications/read-all ───────────────────────────────
router.post("/integrations/notifications/read-all", requireAdmin, (req, res): void => {
  const integrationId = req.body?.integrationId as string | undefined;
  type NotifOpts = Parameters<typeof NotificationManager.markAllRead>[0];
  const count = NotificationManager.markAllRead(integrationId as NotifOpts);
  res.json({ markedRead: count, unreadCount: NotificationManager.unreadCount });
});

// ─── GET /integrations/retry-jobs — RetryQueue ───────────────────────────────
router.get("/integrations/retry-jobs", requireAdmin, (req, res): void => {
  const integrationId = req.query["integration"] as string | undefined;
  const status = req.query["status"] as string | undefined;

  type RetryOpts = Parameters<typeof RetryQueue.getJobs>[0];
  const jobs = RetryQueue.getJobs({
    integrationId: integrationId as RetryOpts extends { integrationId?: infer T } ? T : never,
    status: status as RetryOpts extends { status?: infer T } ? T : never,
  });

  res.json({
    jobs,
    pendingCount: RetryQueue.pendingCount,
    exhaustedCount: RetryQueue.exhaustedCount,
  });
});

// ─── DELETE /integrations/retry-jobs/:id — cancel retry job ──────────────────
router.delete("/integrations/retry-jobs/:id", requireAdmin, (req, res): void => {
  const id = req.params["id"] as string;
  const ok = RetryQueue.cancel(id);
  res.json({ ok });
});

// ─── GET /integrations/token-snapshot — TokenManager state ───────────────────
router.get("/integrations/token-snapshot", requireAdmin, (req, res): void => {
  res.json({ snapshot: TokenManager.getSnapshot() });
});

// ─── GET /integrations/manager-events — in-memory EventManager ───────────────
router.get("/integrations/manager-events", requireAdmin, (req, res): void => {
  const integrationId = req.query["integration"] as string | undefined;
  const status = req.query["status"] as string | undefined;
  const limit = parseInt(req.query["limit"] as string ?? "50", 10);

  type EvOpts = Parameters<typeof EventManager.getRecent>[0];
  const events = EventManager.getRecent({
    integrationId: integrationId as EvOpts extends { integrationId?: infer T } ? T : never,
    status: status as EvOpts extends { status?: infer T } ? T : never,
    limit,
  });

  res.json({
    events,
    stats: EventManager.getStats(integrationId as EvOpts extends { integrationId?: infer T } ? T : never),
  });
});

export default router;
