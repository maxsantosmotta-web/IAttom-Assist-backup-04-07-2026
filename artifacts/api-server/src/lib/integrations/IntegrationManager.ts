import {
  db,
  whatsappConfig,
  metaConfig,
  shopeeConfig,
  mlConfig,
  hotmartConfig,
  kiwifyConfig,
} from "@workspace/db";
import { LoggerManager } from "./LoggerManager.js";
import { NotificationManager } from "./NotificationManager.js";
import { TokenManager } from "./TokenManager.js";
import type { IntegrationHealth, IntegrationId, IntegrationStatus } from "./types.js";
import { INTEGRATION_LABELS } from "./types.js";

// ─── Health check interval ────────────────────────────────────────────────────

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

// ─── Shared helpers ───────────────────────────────────────────────────────────

function resolveStatus(opts: {
  configured: boolean;
  isActive: boolean;
  tokenExpired: boolean;
  hasError: boolean;
}): IntegrationStatus {
  if (!opts.configured) return "unconfigured";
  if (opts.hasError) return "error";
  if (opts.tokenExpired) return "token_expired";
  if (!opts.isActive) return "inactive";
  return "connected";
}

// ─── Integration manager ──────────────────────────────────────────────────────

class IntegrationManagerImpl {
  private healthMap: Map<IntegrationId, IntegrationHealth> = new Map();
  private monitorTimer: ReturnType<typeof setInterval> | null = null;
  private lastError: Map<IntegrationId, string> = new Map();

  // ─── Health check ────────────────────────────────────────────────────────

  async checkHealth(): Promise<IntegrationHealth[]> {
    const now = new Date();

    try {
      const [wa, meta, shopee, ml, hotmart, kiwify] = await Promise.all([
        db.select().from(whatsappConfig).limit(1).then((r) => r[0] ?? null),
        db.select().from(metaConfig).limit(1).then((r) => r[0] ?? null),
        db.select().from(shopeeConfig).limit(1).then((r) => r[0] ?? null),
        db.select().from(mlConfig).limit(1).then((r) => r[0] ?? null),
        db.select().from(hotmartConfig).limit(1).then((r) => r[0] ?? null),
        db.select().from(kiwifyConfig).limit(1).then((r) => r[0] ?? null),
      ]);

      const healths: IntegrationHealth[] = [
        this.buildHealth("whatsapp", {
          configured: !!(wa?.accessToken && wa.phoneNumberId),
          isActive: wa?.isActive ?? false,
          tokenExpired: false,
          lastUpdatedAt: wa?.updatedAt ?? null,
          extraInfo: wa?.phoneNumberId ? `Phone ID: ${wa.phoneNumberId}` : null,
        }),
        this.buildHealth("meta", {
          configured: !!(meta?.appId && meta?.appSecret),
          isActive: meta?.isActive ?? false,
          tokenExpired: false,
          lastUpdatedAt: meta?.updatedAt ?? null,
          extraInfo: meta?.appId ? `App ID: ${meta.appId}` : null,
        }),
        this.buildHealth("shopee", {
          configured: !!(shopee?.partnerId && shopee?.partnerKey),
          isActive: shopee?.isActive ?? false,
          tokenExpired: shopee?.tokenExpiry ? shopee.tokenExpiry < now : false,
          lastUpdatedAt: shopee?.updatedAt ?? null,
          extraInfo: shopee?.shopId ? `Shop ID: ${shopee.shopId}` : null,
        }),
        this.buildHealth("ml", {
          configured: !!(ml?.appId && ml?.clientSecret),
          isActive: ml?.isActive ?? false,
          tokenExpired: ml?.tokenExpiry ? ml.tokenExpiry < now : false,
          lastUpdatedAt: ml?.updatedAt ?? null,
          extraInfo: ml?.userId ? `User ID: ${ml.userId}` : null,
        }),
        this.buildHealth("hotmart", {
          configured: !!(hotmart?.clientId && hotmart?.clientSecret),
          isActive: hotmart?.isActive ?? false,
          tokenExpired: false,
          lastUpdatedAt: hotmart?.updatedAt ?? null,
          environment: hotmart?.environment,
          extraInfo: hotmart?.environment
            ? hotmart.environment === "production" ? "Produção" : "Sandbox"
            : null,
        }),
        this.buildHealth("kiwify", {
          configured: !!(kiwify?.clientId && kiwify?.clientSecret),
          isActive: kiwify?.isActive ?? false,
          tokenExpired: kiwify?.tokenExpiry ? kiwify.tokenExpiry < now : false,
          lastUpdatedAt: kiwify?.updatedAt ?? null,
          extraInfo: kiwify?.storeId ? `Store: ${kiwify.storeId}` : null,
        }),
      ];

      for (const h of healths) {
        const previous = this.healthMap.get(h.id);
        this.healthMap.set(h.id, h);

        // Fire notification on status change
        if (previous && previous.status !== h.status) {
          this.onStatusChange(h.id, previous.status, h.status);
        }
      }

      LoggerManager.debug("IntegrationManager: health check complete", undefined, {
        connected: healths.filter((h) => h.status === "connected").length,
        errors: healths.filter((h) => h.status === "error" || h.status === "token_expired").length,
      });

      return healths;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LoggerManager.error(`IntegrationManager: health check failed — ${msg}`);
      throw err;
    }
  }

  private buildHealth(
    id: IntegrationId,
    opts: {
      configured: boolean;
      isActive: boolean;
      tokenExpired: boolean;
      lastUpdatedAt: Date | null;
      environment?: string | null;
      extraInfo?: string | null;
    },
  ): IntegrationHealth {
    const inMemoryExpired = TokenManager.isExpired(id);
    const tokenExpired = opts.tokenExpired || inMemoryExpired;

    return {
      id,
      label: INTEGRATION_LABELS[id],
      status: resolveStatus({
        configured: opts.configured,
        isActive: opts.isActive,
        tokenExpired,
        hasError: !!this.lastError.get(id),
      }),
      configured: opts.configured,
      isActive: opts.isActive,
      tokenExpired,
      environment: opts.environment,
      extraInfo: opts.extraInfo,
      errorMessage: this.lastError.get(id) ?? null,
      lastCheckedAt: new Date(),
      lastUpdatedAt: opts.lastUpdatedAt,
    };
  }

  private onStatusChange(id: IntegrationId, from: IntegrationStatus, to: IntegrationStatus): void {
    const label = INTEGRATION_LABELS[id];

    if (to === "connected") {
      NotificationManager.success(`${label} conectado`, `A integração ${label} está ativa.`, id);
    } else if (to === "token_expired") {
      NotificationManager.tokenExpiry(id, "Expirado");
    } else if (to === "error") {
      NotificationManager.error(`Erro em ${label}`, this.lastError.get(id) ?? "Erro desconhecido", id);
    } else if (to === "inactive" && from === "connected") {
      NotificationManager.warning(`${label} desconectado`, `A integração foi desativada.`, id);
    }
  }

  // ─── Runtime error tracking ──────────────────────────────────────────────

  recordError(id: IntegrationId, message: string): void {
    this.lastError.set(id, message);
    LoggerManager.error(`IntegrationManager: error recorded for ${id}: ${message}`, id);

    const health = this.healthMap.get(id);
    if (health) {
      health.status = "error";
      health.errorMessage = message;
    }
  }

  clearError(id: IntegrationId): void {
    this.lastError.delete(id);
    const health = this.healthMap.get(id);
    if (health) {
      health.errorMessage = null;
      // Re-derive status
      health.status = resolveStatus({
        configured: health.configured,
        isActive: health.isActive,
        tokenExpired: health.tokenExpired,
        hasError: false,
      });
    }
  }

  // ─── Health monitor ──────────────────────────────────────────────────────

  startHealthMonitor(): void {
    if (this.monitorTimer) return;

    // Run immediately, then on interval
    void this.checkHealth().catch((err: unknown) => {
      LoggerManager.error(
        `IntegrationManager: initial health check failed — ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    this.monitorTimer = setInterval(() => {
      void this.checkHealth().catch((err: unknown) => {
        LoggerManager.error(
          `IntegrationManager: periodic health check failed — ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }, HEALTH_CHECK_INTERVAL_MS);

    LoggerManager.info("IntegrationManager: health monitor started");
  }

  stopHealthMonitor(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
      LoggerManager.info("IntegrationManager: health monitor stopped");
    }
  }

  // ─── Query ───────────────────────────────────────────────────────────────

  getHealth(id: IntegrationId): IntegrationHealth | undefined {
    return this.healthMap.get(id);
  }

  getAllHealth(): IntegrationHealth[] {
    const ids: IntegrationId[] = ["whatsapp", "meta", "shopee", "ml", "hotmart", "kiwify"];
    return ids
      .map((id) => this.healthMap.get(id))
      .filter((h): h is IntegrationHealth => h !== undefined);
  }

  get connectedCount(): number {
    return [...this.healthMap.values()].filter((h) => h.status === "connected").length;
  }

  get errorCount(): number {
    return [...this.healthMap.values()].filter(
      (h) => h.status === "error" || h.status === "token_expired",
    ).length;
  }
}

export const IntegrationManager = new IntegrationManagerImpl();
