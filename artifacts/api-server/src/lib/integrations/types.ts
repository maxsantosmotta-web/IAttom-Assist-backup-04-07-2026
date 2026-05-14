// ─── Core identifiers ────────────────────────────────────────────────────────

export type IntegrationId = "whatsapp" | "meta" | "shopee" | "ml" | "hotmart" | "kiwify";

export const INTEGRATION_LABELS: Record<IntegrationId, string> = {
  whatsapp: "WhatsApp",
  meta: "Meta (IG + FB)",
  shopee: "Shopee",
  ml: "Mercado Livre",
  hotmart: "Hotmart",
  kiwify: "Kiwify",
};

// ─── Integration status ───────────────────────────────────────────────────────

export type IntegrationStatus =
  | "connected"     // configured + isActive + token valid
  | "inactive"      // configured + isActive=false
  | "token_expired" // configured + token expired
  | "error"         // configured + runtime error
  | "unconfigured"; // no credentials saved

export interface IntegrationHealth {
  id: IntegrationId;
  label: string;
  status: IntegrationStatus;
  configured: boolean;
  isActive: boolean;
  tokenExpired: boolean;
  environment?: string | null;
  extraInfo?: string | null;
  errorMessage?: string | null;
  lastCheckedAt: Date;
  lastUpdatedAt?: Date | null;
}

// ─── Token management ─────────────────────────────────────────────────────────

export interface TokenInfo {
  integrationId: IntegrationId;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  metadata?: Record<string, unknown>;
}

export type RefreshFn = (current: TokenInfo) => Promise<TokenInfo>;

export interface ScheduledRefresh {
  integrationId: IntegrationId;
  refreshFn: RefreshFn;
  bufferMs: number;         // refresh this many ms before expiry
  timeoutHandle?: ReturnType<typeof setTimeout>;
}

// ─── Webhook validation ───────────────────────────────────────────────────────

export interface WebhookValidationResult {
  valid: boolean;
  errorMessage?: string;
}

export type WebhookSignatureAlgorithm = "hmac-sha256" | "hmac-sha1" | "timing-safe-equal" | "none";

export interface WebhookValidationConfig {
  integrationId: IntegrationId;
  algorithm: WebhookSignatureAlgorithm;
  secret: string;
  headerName?: string;
  queryParamName?: string;
}

// ─── Normalized events ────────────────────────────────────────────────────────

export type EventStatus = "received" | "processed" | "failed" | "skipped";

export interface NormalizedEvent {
  id: string;                        // uuid-like unique ID
  integrationId: IntegrationId;
  platformLabel: string;
  eventType: string;
  eventLabel: string;
  primaryText: string | null;        // buyer name, sender number, etc.
  secondaryText: string | null;      // email, order ID, etc.
  value: string | null;              // monetary value if any
  currency: string | null;
  rawPayload: unknown;
  status: EventStatus;
  receivedAt: Date;
  processedAt?: Date;
  errorMessage?: string;
}

// ─── Retry queue ──────────────────────────────────────────────────────────────

export type RetryStatus = "pending" | "retrying" | "success" | "exhausted";

export interface RetryJob {
  id: string;
  integrationId: IntegrationId;
  operation: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  status: RetryStatus;
  lastError?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export type RetryExecutorFn = (job: RetryJob) => Promise<void>;

// ─── Logging ──────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  timestamp: Date;
  integrationId?: IntegrationId;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType = "error" | "warning" | "info" | "success" | "token_expiry" | "webhook_error" | "retry_exhausted";

export interface Notification {
  id: string;
  type: NotificationType;
  integrationId?: IntegrationId;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  read: boolean;
}
