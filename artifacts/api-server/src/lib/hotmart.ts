import crypto from "crypto";
import { logger } from "./logger.js";

// ─── Endpoints ────────────────────────────────────────────────────────────────

// OAuth token endpoint (client_credentials AND authorization_code)
const HOTMART_TOKEN_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token";

// User-facing OAuth authorization page
const HOTMART_AUTH_URL = "https://api-sec-vlc.hotmart.com/security/oauth/authorize";

// REST API base
const HOTMART_API_BASE_SANDBOX = "https://sandbox.hotmart.com";
const HOTMART_API_BASE_PROD    = "https://developers.hotmart.com";

// ─── Webhook signature verification ──────────────────────────────────────────

export function verifyHotmartWebhook(
  webhookToken: string,
  receivedToken: string | undefined,
): boolean {
  if (!receivedToken) return false;
  return crypto.timingSafeEqual(
    Buffer.from(webhookToken),
    Buffer.from(receivedToken),
  );
}

// ─── Client-credentials token (platform-level) ────────────────────────────────

export interface HotmartTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export async function getHotmartAccessToken(
  clientId: string,
  clientSecret: string,
  basicToken: string,
  environment: string,
): Promise<HotmartTokenResponse> {
  logger.info({ environment }, "hotmart: fetching access token (client_credentials)");

  const res = await fetch(`${HOTMART_TOKEN_URL}?grant_type=client_credentials`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn({ status: res.status, body: text.slice(0, 200) }, "hotmart: token request failed");
    return { error: `HTTP ${res.status}` };
  }

  return (await res.json()) as HotmartTokenResponse;
}

// ─── Per-user OAuth: Authorization URL ────────────────────────────────────────

export function getHotmartAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  scope?: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  if (scope) params.set("scope", scope);
  return `${HOTMART_AUTH_URL}?${params.toString()}`;
}

// ─── Per-user OAuth: Exchange authorization code for tokens ───────────────────

export interface HotmartUserTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeHotmartCode(
  clientId: string,
  clientSecret: string,
  basicToken: string,
  code: string,
  redirectUri: string,
): Promise<HotmartUserTokenResponse> {
  logger.info({ clientId }, "hotmart: exchanging authorization code for user token");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(HOTMART_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn({ status: res.status, body: text.slice(0, 300) }, "hotmart: code exchange failed");
    return { error: `HTTP ${res.status}`, error_description: text.slice(0, 200) };
  }

  const data = (await res.json()) as HotmartUserTokenResponse;
  logger.info({ hasToken: !!data.access_token }, "hotmart: code exchange completed");
  return data;
}

// ─── Products ─────────────────────────────────────────────────────────────────

export interface HotmartProductSummary {
  product: {
    id: number;
    name?: string;
    format?: string;
    status?: string;
  };
  price?: {
    value?: number;
    currency_code?: string;
  };
}

interface HotmartProductsResponse {
  items?: HotmartProductSummary[];
}

export interface HotmartEndpointDiag {
  label: string;
  url: string;
  status: number;
  bodyEmpty: boolean;
  count: number;
  result: "ok" | "empty" | "error" | "network_error";
  errorDetail?: string;
}

export interface HotmartProductsResult {
  items: HotmartProductSummary[];
  diagnostics: HotmartEndpointDiag[];
}

export async function getHotmartProducts(
  accessToken: string,
  environment: string,
): Promise<HotmartProductsResult> {
  const base = getHotmartApiBase(environment);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  async function fetchEndpoint(
    label: string,
    url: string,
  ): Promise<{ items: HotmartProductSummary[]; diag: HotmartEndpointDiag }> {
    let res: Response;
    try {
      res = await fetch(url, { headers });
    } catch (networkErr) {
      const errorDetail = networkErr instanceof Error ? networkErr.message : String(networkErr);
      logger.warn({ label, url, errorDetail }, "hotmart: [ERRO REDE] falha de conexão");
      return {
        items: [],
        diag: { label, url, status: 0, bodyEmpty: true, count: 0, result: "network_error", errorDetail },
      };
    }

    const raw = await res.text().catch(() => "");
    const bodyEmpty = !raw.trim();

    if (!res.ok) {
      logger.warn({ label, url, status: res.status, body: raw.slice(0, 300) }, `hotmart: [ERRO ${res.status}]`);
      return {
        items: [],
        diag: { label, url, status: res.status, bodyEmpty, count: 0, result: "error", errorDetail: raw.slice(0, 200) },
      };
    }

    if (bodyEmpty) {
      return {
        items: [],
        diag: { label, url, status: res.status, bodyEmpty: true, count: 0, result: "empty" },
      };
    }

    let parsed: HotmartProductsResponse;
    try {
      parsed = JSON.parse(raw) as HotmartProductsResponse;
    } catch {
      return {
        items: [],
        diag: { label, url, status: res.status, bodyEmpty: false, count: 0, result: "error", errorDetail: "JSON inválido" },
      };
    }

    const items = parsed.items ?? [];
    return {
      items,
      diag: { label, url, status: res.status, bodyEmpty: false, count: items.length, result: items.length > 0 ? "ok" : "empty" },
    };
  }

  const ownUrl = `${base}/products/api/v2/products`;
  const { items: ownItems, diag: diagOwn } = await fetchEndpoint("Produtos próprios (produtor)", ownUrl);

  const affUrl = `${base}/products/api/v2/products/affiliates`;
  const { items: affiliateItems, diag: diagAff } = await fetchEndpoint("Produtos afiliados", affUrl);

  const subUrl = `${base}/payments/api/v1/subscriptions?max_results=10`;
  const { diag: diagSub } = await fetchEndpoint("Assinaturas ativas (diagnóstico)", subUrl);

  const diagnostics: HotmartEndpointDiag[] = [diagOwn, diagAff, diagSub];

  for (const d of diagnostics) {
    logger.info(
      { label: d.label, status: d.status, result: d.result, count: d.count },
      `hotmart: diagnóstico — ${d.label}: ${d.result.toUpperCase()}`,
    );
  }

  const seen = new Set<number>();
  const merged: HotmartProductSummary[] = [];
  for (const item of [...ownItems, ...affiliateItems]) {
    if (!seen.has(item.product.id)) {
      seen.add(item.product.id);
      merged.push(item);
    }
  }

  logger.info({ total: merged.length }, "hotmart: sincronização concluída");
  return { items: merged, diagnostics };
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export interface HotmartSaleSummary {
  purchase: {
    transaction?: string;
    status?: string;
    price?: { value?: number; currency_code?: string };
  };
  buyer?: { email?: string; name?: string };
}

interface HotmartSalesResponse {
  items?: HotmartSaleSummary[];
}

export async function getHotmartSales(
  accessToken: string,
  environment: string,
): Promise<HotmartSaleSummary[]> {
  const base = getHotmartApiBase(environment);
  const res = await fetch(`${base}/payments/api/v1/sales/history?max_results=50`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn({ status: res.status, body: text.slice(0, 200) }, "hotmart: sales history error");
    return [];
  }

  const data = (await res.json()) as HotmartSalesResponse;
  return data.items ?? [];
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export interface HotmartSubscriptionSummary {
  subscriber_code?: string;
  status?: string;
  plan?: { name?: string };
  product?: { id?: number; name?: string };
  buyer?: { email?: string; name?: string };
  date_next_charge?: number;
}

interface HotmartSubscriptionsResponse {
  items?: HotmartSubscriptionSummary[];
}

export async function getHotmartSubscriptions(
  accessToken: string,
  environment: string,
): Promise<HotmartSubscriptionSummary[]> {
  const base = getHotmartApiBase(environment);
  const res = await fetch(`${base}/payments/api/v1/subscriptions?max_results=50`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn({ status: res.status, body: text.slice(0, 200) }, "hotmart: subscriptions error");
    return [];
  }

  const data = (await res.json()) as HotmartSubscriptionsResponse;
  return data.items ?? [];
}

// ─── Event type labels ────────────────────────────────────────────────────────

export const HOTMART_EVENT_LABELS: Record<string, string> = {
  PURCHASE_APPROVED: "Compra Aprovada",
  PURCHASE_BILLET_PRINTED: "Boleto/Pix Gerado",
  PURCHASE_REFUNDED: "Reembolso",
  PURCHASE_CHARGEBACK: "Chargeback",
  PURCHASE_CANCELED: "Cancelado",
  PURCHASE_ABANDONED: "Abandono de Checkout",
  PURCHASE_COMPLETE: "Compra Concluída",
  PURCHASE_DELAYED: "Compra Atrasada",
  SUBSCRIPTION_ACTIVE: "Assinatura Ativa",
  SUBSCRIPTION_CANCELED: "Assinatura Cancelada",
  SUBSCRIPTION_REACTIVATED: "Assinatura Reativada",
  SWITCH_PLAN: "Mudança de Plano",
};

export function getHotmartApiBase(environment: string): string {
  return environment === "production" ? HOTMART_API_BASE_PROD : HOTMART_API_BASE_SANDBOX;
}
