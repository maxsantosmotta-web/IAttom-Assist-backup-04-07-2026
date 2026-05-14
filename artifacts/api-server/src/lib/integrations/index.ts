// ─── Public API — Global Integration Infrastructure ───────────────────────────
//
// Usage example in a route handler:
//
//   import { IntegrationManager, WebhookManager, EventManager, LoggerManager } from "../lib/integrations/index.js";
//
//   // Validate incoming webhook
//   const result = WebhookManager.validateHotmart(token, expectedToken);
//   if (!result.valid) return res.status(401).json({ error: "Unauthorized" });
//
//   // Normalize and store event
//   const partial = WebhookManager.normalizeHotmart(req.body);
//   const event = WebhookManager.buildEvent(partial);
//   EventManager.push(event);
//
//   // Log
//   LoggerManager.info("Hotmart webhook processed", "hotmart", { eventId: event.id });
//
// ─────────────────────────────────────────────────────────────────────────────

export { LoggerManager }       from "./LoggerManager.js";
export { NotificationManager } from "./NotificationManager.js";
export { RetryQueue }          from "./RetryQueue.js";
export { TokenManager }        from "./TokenManager.js";
export { WebhookManager }      from "./WebhookManager.js";
export { EventManager }        from "./EventManager.js";
export { IntegrationManager }  from "./IntegrationManager.js";

export { INTEGRATION_LABELS }  from "./types.js";

export type {
  IntegrationId,
  IntegrationStatus,
  IntegrationHealth,
  TokenInfo,
  RefreshFn,
  WebhookValidationResult,
  NormalizedEvent,
  EventStatus,
  RetryJob,
  RetryStatus,
  RetryExecutorFn,
  LogEntry,
  LogLevel,
  Notification,
  NotificationType,
} from "./types.js";
