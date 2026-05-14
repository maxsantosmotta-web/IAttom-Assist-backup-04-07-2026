import { LoggerManager } from "./LoggerManager.js";
import type { NormalizedEvent, IntegrationId, EventStatus } from "./types.js";

// ─── In-memory event queue / history ─────────────────────────────────────────

const MAX_EVENTS = 500;

class EventManagerImpl {
  private events: NormalizedEvent[] = [];

  // ─── Push ────────────────────────────────────────────────────────────────

  push(event: NormalizedEvent): void {
    this.events.unshift(event); // newest first

    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(0, MAX_EVENTS);
    }

    LoggerManager.debug(
      `EventManager: received ${event.eventType} from ${event.integrationId}`,
      event.integrationId,
      { eventId: event.id, primaryText: event.primaryText },
    );
  }

  // ─── Status transitions ──────────────────────────────────────────────────

  markProcessed(id: string, metadata?: Record<string, unknown>): boolean {
    const ev = this.events.find((e) => e.id === id);
    if (!ev) return false;
    ev.status = "processed";
    ev.processedAt = new Date();

    LoggerManager.debug(
      `EventManager: event ${id} marked as processed`,
      ev.integrationId,
      metadata,
    );

    return true;
  }

  markFailed(id: string, errorMessage: string): boolean {
    const ev = this.events.find((e) => e.id === id);
    if (!ev) return false;
    ev.status = "failed";
    ev.errorMessage = errorMessage;
    ev.processedAt = new Date();

    LoggerManager.warn(
      `EventManager: event ${id} failed — ${errorMessage}`,
      ev.integrationId,
      { errorMessage },
    );

    return true;
  }

  markSkipped(id: string): boolean {
    const ev = this.events.find((e) => e.id === id);
    if (!ev) return false;
    ev.status = "skipped";
    ev.processedAt = new Date();
    return true;
  }

  // ─── Query ───────────────────────────────────────────────────────────────

  getRecent(opts?: {
    integrationId?: IntegrationId;
    status?: EventStatus;
    limit?: number;
    since?: Date;
  }): NormalizedEvent[] {
    let result = [...this.events];

    if (opts?.integrationId) {
      result = result.filter((e) => e.integrationId === opts.integrationId);
    }
    if (opts?.status) {
      result = result.filter((e) => e.status === opts.status);
    }
    if (opts?.since) {
      result = result.filter((e) => e.receivedAt >= opts.since!);
    }

    return result.slice(0, opts?.limit ?? 50);
  }

  getById(id: string): NormalizedEvent | undefined {
    return this.events.find((e) => e.id === id);
  }

  // ─── Stats ───────────────────────────────────────────────────────────────

  getStats(integrationId?: IntegrationId): {
    total: number;
    received: number;
    processed: number;
    failed: number;
    skipped: number;
    byPlatform: Partial<Record<IntegrationId, number>>;
  } {
    const source = integrationId
      ? this.events.filter((e) => e.integrationId === integrationId)
      : this.events;

    const byPlatform: Partial<Record<IntegrationId, number>> = {};
    for (const ev of this.events) {
      byPlatform[ev.integrationId] = (byPlatform[ev.integrationId] ?? 0) + 1;
    }

    return {
      total: source.length,
      received: source.filter((e) => e.status === "received").length,
      processed: source.filter((e) => e.status === "processed").length,
      failed: source.filter((e) => e.status === "failed").length,
      skipped: source.filter((e) => e.status === "skipped").length,
      byPlatform,
    };
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  pruneOlderThan(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    const before = this.events.length;
    this.events = this.events.filter(
      (e) => e.receivedAt.getTime() > cutoff,
    );
    return before - this.events.length;
  }

  clear(integrationId?: IntegrationId): number {
    const before = this.events.length;
    if (integrationId) {
      this.events = this.events.filter((e) => e.integrationId !== integrationId);
    } else {
      this.events = [];
    }
    return before - this.events.length;
  }

  get totalCount(): number {
    return this.events.length;
  }
}

export const EventManager = new EventManagerImpl();
