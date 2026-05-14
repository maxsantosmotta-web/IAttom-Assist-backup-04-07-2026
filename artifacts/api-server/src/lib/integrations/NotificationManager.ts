import { randomUUID } from "crypto";
import { LoggerManager } from "./LoggerManager.js";
import type { Notification, NotificationType, IntegrationId } from "./types.js";

// ─── In-memory notification store ─────────────────────────────────────────────

const MAX_NOTIFICATIONS = 100;

class NotificationManagerImpl {
  private notifications: Notification[] = [];

  // ─── Push ───────────────────────────────────────────────────────────────

  push(opts: {
    type: NotificationType;
    title: string;
    message: string;
    integrationId?: IntegrationId;
    metadata?: Record<string, unknown>;
  }): Notification {
    const notification: Notification = {
      id: randomUUID(),
      type: opts.type,
      integrationId: opts.integrationId,
      title: opts.title,
      message: opts.message,
      metadata: opts.metadata,
      createdAt: new Date(),
      read: false,
    };

    this.notifications.unshift(notification); // newest first

    if (this.notifications.length > MAX_NOTIFICATIONS) {
      this.notifications = this.notifications.slice(0, MAX_NOTIFICATIONS);
    }

    LoggerManager.info(
      `[Notification] ${opts.type.toUpperCase()}: ${opts.title}`,
      opts.integrationId,
      { message: opts.message },
    );

    return notification;
  }

  // ─── Convenience helpers ────────────────────────────────────────────────

  error(title: string, message: string, integrationId?: IntegrationId, metadata?: Record<string, unknown>): Notification {
    return this.push({ type: "error", title, message, integrationId, metadata });
  }

  warning(title: string, message: string, integrationId?: IntegrationId, metadata?: Record<string, unknown>): Notification {
    return this.push({ type: "warning", title, message, integrationId, metadata });
  }

  info(title: string, message: string, integrationId?: IntegrationId, metadata?: Record<string, unknown>): Notification {
    return this.push({ type: "info", title, message, integrationId, metadata });
  }

  success(title: string, message: string, integrationId?: IntegrationId, metadata?: Record<string, unknown>): Notification {
    return this.push({ type: "success", title, message, integrationId, metadata });
  }

  tokenExpiry(integrationId: IntegrationId, expiresIn: string): Notification {
    return this.push({
      type: "token_expiry",
      integrationId,
      title: "Token próximo do vencimento",
      message: `A integração ${integrationId} tem o token expirando em ${expiresIn}.`,
    });
  }

  webhookError(integrationId: IntegrationId, reason: string): Notification {
    return this.push({
      type: "webhook_error",
      integrationId,
      title: "Erro de validação de webhook",
      message: reason,
    });
  }

  retryExhausted(integrationId: IntegrationId, operation: string): Notification {
    return this.push({
      type: "retry_exhausted",
      integrationId,
      title: "Tentativas esgotadas",
      message: `A operação "${operation}" falhou após todas as tentativas.`,
    });
  }

  // ─── Query & management ──────────────────────────────────────────────────

  getAll(opts?: { integrationId?: IntegrationId; unreadOnly?: boolean; limit?: number }): Notification[] {
    let result = [...this.notifications];

    if (opts?.integrationId) {
      result = result.filter((n) => n.integrationId === opts.integrationId);
    }
    if (opts?.unreadOnly) {
      result = result.filter((n) => !n.read);
    }

    return result.slice(0, opts?.limit ?? 50);
  }

  markRead(id: string): boolean {
    const n = this.notifications.find((n) => n.id === id);
    if (!n) return false;
    n.read = true;
    return true;
  }

  markAllRead(integrationId?: IntegrationId): number {
    let count = 0;
    for (const n of this.notifications) {
      if (!n.read && (!integrationId || n.integrationId === integrationId)) {
        n.read = true;
        count++;
      }
    }
    return count;
  }

  dismiss(id: string): boolean {
    const idx = this.notifications.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    this.notifications.splice(idx, 1);
    return true;
  }

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  get totalCount(): number {
    return this.notifications.length;
  }
}

export const NotificationManager = new NotificationManagerImpl();
