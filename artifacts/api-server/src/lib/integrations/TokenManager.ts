import { LoggerManager } from "./LoggerManager.js";
import { NotificationManager } from "./NotificationManager.js";
import type { TokenInfo, RefreshFn, ScheduledRefresh, IntegrationId } from "./types.js";

// ─── Token expiry warning thresholds ─────────────────────────────────────────

const WARN_BEFORE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
const MONITOR_INTERVAL_MS   = 30 * 60 * 1000;       // check every 30 min

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expirado";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Token manager implementation ─────────────────────────────────────────────

class TokenManagerImpl {
  private tokens: Map<IntegrationId, TokenInfo> = new Map();
  private refreshes: Map<IntegrationId, ScheduledRefresh> = new Map();
  private monitorTimer: ReturnType<typeof setInterval> | null = null;
  private notifiedExpiry: Set<IntegrationId> = new Set();

  // ─── Store / retrieve tokens ─────────────────────────────────────────────

  setToken(token: TokenInfo): void {
    this.tokens.set(token.integrationId, token);
    this.notifiedExpiry.delete(token.integrationId); // reset expiry warning

    LoggerManager.info(
      `TokenManager: token set for ${token.integrationId}`,
      token.integrationId,
      { expiresAt: token.expiresAt?.toISOString() },
    );

    // If a refresh is scheduled, reschedule it
    const scheduled = this.refreshes.get(token.integrationId);
    if (scheduled) {
      this.clearRefreshTimer(token.integrationId);
      this.scheduleRefreshTimer(scheduled);
    }
  }

  getToken(integrationId: IntegrationId): TokenInfo | undefined {
    return this.tokens.get(integrationId);
  }

  removeToken(integrationId: IntegrationId): boolean {
    const existed = this.tokens.has(integrationId);
    this.tokens.delete(integrationId);
    this.clearRefreshTimer(integrationId);
    this.notifiedExpiry.delete(integrationId);

    if (existed) {
      LoggerManager.info(`TokenManager: token removed for ${integrationId}`, integrationId);
    }

    return existed;
  }

  // ─── Expiry checks ───────────────────────────────────────────────────────

  isExpired(integrationId: IntegrationId): boolean {
    const token = this.tokens.get(integrationId);
    if (!token?.expiresAt) return false;
    return token.expiresAt.getTime() < Date.now();
  }

  expiresInMs(integrationId: IntegrationId): number | null {
    const token = this.tokens.get(integrationId);
    if (!token?.expiresAt) return null;
    return token.expiresAt.getTime() - Date.now();
  }

  expiresInFormatted(integrationId: IntegrationId): string {
    const ms = this.expiresInMs(integrationId);
    if (ms === null) return "—";
    return formatRemaining(ms);
  }

  // ─── Scheduled refresh ───────────────────────────────────────────────────

  scheduleRefresh(
    integrationId: IntegrationId,
    refreshFn: RefreshFn,
    bufferMs = WARN_BEFORE_EXPIRY_MS,
  ): void {
    this.clearRefreshTimer(integrationId);

    const scheduled: ScheduledRefresh = { integrationId, refreshFn, bufferMs };
    this.refreshes.set(integrationId, scheduled);
    this.scheduleRefreshTimer(scheduled);

    LoggerManager.info(
      `TokenManager: refresh scheduled for ${integrationId} (buffer ${bufferMs}ms)`,
      integrationId,
    );
  }

  private scheduleRefreshTimer(scheduled: ScheduledRefresh): void {
    const token = this.tokens.get(scheduled.integrationId);
    if (!token?.expiresAt) return;

    const triggerAt = token.expiresAt.getTime() - scheduled.bufferMs;
    const delay = triggerAt - Date.now();

    if (delay <= 0) {
      // Already past trigger time — refresh immediately
      void this.executeRefresh(scheduled);
      return;
    }

    const timer = setTimeout(() => void this.executeRefresh(scheduled), delay);
    scheduled.timeoutHandle = timer;
  }

  private async executeRefresh(scheduled: ScheduledRefresh): Promise<void> {
    const current = this.tokens.get(scheduled.integrationId);
    if (!current) return;

    LoggerManager.info(
      `TokenManager: refreshing token for ${scheduled.integrationId}`,
      scheduled.integrationId,
    );

    try {
      const refreshed = await scheduled.refreshFn(current);
      this.setToken(refreshed);

      LoggerManager.info(
        `TokenManager: token refreshed for ${scheduled.integrationId}`,
        scheduled.integrationId,
        { expiresAt: refreshed.expiresAt?.toISOString() },
      );

      NotificationManager.success(
        "Token renovado",
        `Token da integração ${scheduled.integrationId} renovado com sucesso.`,
        scheduled.integrationId,
      );

      // Reschedule next refresh
      this.scheduleRefreshTimer(scheduled);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      LoggerManager.error(
        `TokenManager: failed to refresh token for ${scheduled.integrationId}: ${errMsg}`,
        scheduled.integrationId,
        { error: errMsg },
      );

      NotificationManager.error(
        "Falha ao renovar token",
        `Não foi possível renovar o token de ${scheduled.integrationId}: ${errMsg}`,
        scheduled.integrationId,
      );
    }
  }

  private clearRefreshTimer(integrationId: IntegrationId): void {
    const scheduled = this.refreshes.get(integrationId);
    if (scheduled?.timeoutHandle) {
      clearTimeout(scheduled.timeoutHandle);
      scheduled.timeoutHandle = undefined;
    }
  }

  // ─── Expiry monitor ──────────────────────────────────────────────────────

  startExpiryMonitor(): void {
    if (this.monitorTimer) return;

    this.monitorTimer = setInterval(() => this.runExpiryCheck(), MONITOR_INTERVAL_MS);
    LoggerManager.info("TokenManager: expiry monitor started");
    // Run once immediately
    this.runExpiryCheck();
  }

  stopExpiryMonitor(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
      LoggerManager.info("TokenManager: expiry monitor stopped");
    }
  }

  private runExpiryCheck(): void {
    for (const [id, token] of this.tokens) {
      if (!token.expiresAt) continue;

      const msLeft = token.expiresAt.getTime() - Date.now();

      if (msLeft < 0) {
        // Already expired
        if (!this.notifiedExpiry.has(id)) {
          LoggerManager.warn(`TokenManager: token expired for ${id}`, id);
          NotificationManager.tokenExpiry(id, "Expirado");
          this.notifiedExpiry.add(id);
        }
      } else if (msLeft < WARN_BEFORE_EXPIRY_MS && !this.notifiedExpiry.has(id)) {
        // Expiring soon
        const formatted = formatRemaining(msLeft);
        LoggerManager.warn(
          `TokenManager: token expiring soon for ${id} — ${formatted}`,
          id,
          { expiresAt: token.expiresAt.toISOString() },
        );
        NotificationManager.tokenExpiry(id, formatted);
        this.notifiedExpiry.add(id);
      }
    }
  }

  // ─── Status snapshot ─────────────────────────────────────────────────────

  getSnapshot(): Array<{
    integrationId: IntegrationId;
    hasToken: boolean;
    isExpired: boolean;
    expiresIn: string;
    hasRefreshScheduled: boolean;
  }> {
    const ids: IntegrationId[] = ["whatsapp", "meta", "shopee", "ml", "hotmart", "kiwify"];
    return ids.map((id) => ({
      integrationId: id,
      hasToken: this.tokens.has(id),
      isExpired: this.isExpired(id),
      expiresIn: this.expiresInFormatted(id),
      hasRefreshScheduled: this.refreshes.has(id),
    }));
  }
}

export const TokenManager = new TokenManagerImpl();
