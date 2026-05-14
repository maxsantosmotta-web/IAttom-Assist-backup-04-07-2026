// ─── Shared utilities for all integration modules ────────────────────────────

export type IntegrationId = "whatsapp" | "meta" | "shopee" | "ml" | "hotmart" | "kiwify";

export interface IntegrationHealthStatus {
  id: IntegrationId;
  label: string;
  configured: boolean;
  isActive: boolean;
  tokenExpired?: boolean;
  environment?: string | null;
  extraInfo?: string | null;
  lastUpdated?: Date | string | null;
}

export interface NormalizedEvent {
  platform: IntegrationId;
  platformLabel: string;
  eventType: string;
  primaryText: string | null;
  secondaryText: string | null;
  value: string | null;
  currency: string | null;
  receivedAt: Date | string | null;
}

// ─── Secret masking ───────────────────────────────────────────────────────────

export function maskSecret(value: string | null | undefined, showLast = 4): string {
  if (!value) return "";
  if (value.length <= showLast) return "••••";
  return "••••••••" + value.slice(-showLast);
}

// ─── Token expiry ─────────────────────────────────────────────────────────────

export function tokenIsExpired(expiry: Date | string | null | undefined): boolean {
  if (!expiry) return false;
  return new Date(expiry) < new Date();
}

export function tokenExpiresIn(expiry: Date | string | null | undefined): string {
  if (!expiry) return "—";
  const diff = new Date(expiry).getTime() - Date.now();
  if (diff < 0) return "Expirado";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export function resolveIntegrationStatus(
  config: { isActive?: boolean | null; updatedAt?: Date | null } | null | undefined,
  id: IntegrationId,
  label: string,
  overrides?: Partial<IntegrationHealthStatus>,
): IntegrationHealthStatus {
  if (!config) {
    return { id, label, configured: false, isActive: false, ...overrides };
  }
  return {
    id,
    label,
    configured: true,
    isActive: config.isActive ?? false,
    lastUpdated: config.updatedAt ?? null,
    ...overrides,
  };
}
