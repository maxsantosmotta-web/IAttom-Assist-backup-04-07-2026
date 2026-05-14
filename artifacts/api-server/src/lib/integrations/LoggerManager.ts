import { logger as pinoLogger } from "../logger.js";
import type { LogEntry, LogLevel, IntegrationId } from "./types.js";
import { randomUUID } from "crypto";

// ─── Circular buffer for in-memory log retention ──────────────────────────────

const MAX_LOG_ENTRIES = 500;

class LoggerManagerImpl {
  private entries: LogEntry[] = [];

  private push(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_LOG_ENTRIES);
    }
  }

  private buildEntry(
    level: LogLevel,
    message: string,
    integrationId?: IntegrationId,
    metadata?: Record<string, unknown>,
  ): LogEntry {
    return {
      id: randomUUID(),
      timestamp: new Date(),
      integrationId,
      level,
      message,
      metadata,
    };
  }

  // ─── Public log methods ─────────────────────────────────────────────────

  debug(message: string, integrationId?: IntegrationId, metadata?: Record<string, unknown>): void {
    const entry = this.buildEntry("debug", message, integrationId, metadata);
    this.push(entry);
    pinoLogger.debug({ integration: integrationId, ...metadata }, message);
  }

  info(message: string, integrationId?: IntegrationId, metadata?: Record<string, unknown>): void {
    const entry = this.buildEntry("info", message, integrationId, metadata);
    this.push(entry);
    pinoLogger.info({ integration: integrationId, ...metadata }, message);
  }

  warn(message: string, integrationId?: IntegrationId, metadata?: Record<string, unknown>): void {
    const entry = this.buildEntry("warn", message, integrationId, metadata);
    this.push(entry);
    pinoLogger.warn({ integration: integrationId, ...metadata }, message);
  }

  error(message: string, integrationId?: IntegrationId, metadata?: Record<string, unknown>): void {
    const entry = this.buildEntry("error", message, integrationId, metadata);
    this.push(entry);
    pinoLogger.error({ integration: integrationId, ...metadata }, message);
  }

  // ─── Query ──────────────────────────────────────────────────────────────

  getLogs(opts?: {
    integrationId?: IntegrationId;
    level?: LogLevel;
    limit?: number;
    since?: Date;
  }): LogEntry[] {
    let result = [...this.entries];

    if (opts?.integrationId) {
      result = result.filter((e) => e.integrationId === opts.integrationId);
    }
    if (opts?.level) {
      result = result.filter((e) => e.level === opts.level);
    }
    if (opts?.since) {
      result = result.filter((e) => e.timestamp >= opts.since!);
    }

    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return result.slice(0, opts?.limit ?? 100);
  }

  clearLogs(integrationId?: IntegrationId): void {
    if (integrationId) {
      this.entries = this.entries.filter((e) => e.integrationId !== integrationId);
    } else {
      this.entries = [];
    }
  }

  get totalCount(): number {
    return this.entries.length;
  }
}

export const LoggerManager = new LoggerManagerImpl();
