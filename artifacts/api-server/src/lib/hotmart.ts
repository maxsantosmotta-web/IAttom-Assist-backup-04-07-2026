import crypto from "crypto";
import { logger } from "./logger.js";

// OAuth token URL (same for sandbox and production)
const HOTMART_TOKEN_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token";

// REST API base — DIFFERENT from the OAuth domain
// Sandbox: https://sandbox.hotmart.com
// Production: https://developers.hotmart.com
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

// ─── OAuth token ──────────────────────────────────────────────────────────────

export interface HotmartTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
}

export async function getHotmartAccessToken(
  clientId: string,
  clientSecret: string,
  basicToken: string,
  environment: string,
): Promise<HotmartTokenResponse> {
  // Token URL is always api-sec-vlc.hotmart.com regardless of environment
  logger.info({ environment }, "hotmart: fetching access token");

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

// Per-endpoint diagnostic result returned to caller and front-end
export interface HotmartEndpointDiag {
  label: string;    // human-readable name
  url: string;
  status: number;   // HTTP status, 0 = network error
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

  // Helper: fetch one endpoint, return items + diag, NEVER throw
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
      logger.warn(
        { label, url, status: res.status, body: raw.slice(0, 300) },
        `hotmart: [ERRO ${res.status}] endpoint retornou erro`,
      );
      return {
        items: [],
        diag: { label, url, status: res.status, bodyEmpty, count: 0, result: "error", errorDetail: raw.slice(0, 200) },
      };
    }

    if (bodyEmpty) {
      logger.warn(
        { label, url, status: res.status },
        "hotmart: [VAZIO] endpoint retornou 200 com corpo vazio — sem produtos ou sem permissão de escopo",
      );
      return {
        items: [],
        diag: { label, url, status: res.status, bodyEmpty: true, count: 0, result: "empty" },
      };
    }

    let parsed: HotmartProductsResponse;
    try {
      parsed = JSON.parse(raw) as HotmartProductsResponse;
    } catch {
      logger.warn({ label, url, raw: raw.slice(0, 300) }, "hotmart: [ERRO JSON] resposta não é JSON válido");
      return {
        items: [],
        diag: { label, url, status: res.status, bodyEmpty: false, count: 0, result: "error", errorDetail: "JSON inválido" },
      };
    }

    const items = parsed.items ?? [];
    logger.info({ label, url, status: res.status, count: items.length }, "hotmart: [OK] produtos retornados");
    return {
      items,
      diag: { label, url, status: res.status, bodyEmpty: false, count: items.length, result: items.length > 0 ? "ok" : "empty" },
    };
  }

  // ── 1. Produtos próprios (produtor) ───────────────────────────────────────
  const ownUrl = `${base}/products/api/v2/products`;
  logger.info({ environment, url: ownUrl }, "hotmart: [1/3] testando produtos próprios (produtor)");
  const { items: ownItems, diag: diagOwn } = await fetchEndpoint("Produtos próprios (produtor)", ownUrl);

  // ── 2. Produtos como afiliado ─────────────────────────────────────────────
  const affUrl = `${base}/products/api/v2/products/affiliates`;
  logger.info({ environment, url: affUrl }, "hotmart: [2/3] testando produtos como afiliado");
  const { items: affiliateItems, diag: diagAff } = await fetchEndpoint("Produtos afiliados", affUrl);

  // ── 3. Verificação via assinaturas (indicador de produtos na conta) ────────
  const subUrl = `${base}/payments/api/v1/subscriptions?max_results=10`;
  logger.info({ environment, url: subUrl }, "hotmart: [3/3] verificando assinaturas/afiliações ativas");
  const { diag: diagSub } = await fetchEndpoint("Assinaturas ativas (diagnóstico)", subUrl);

  const diagnostics: HotmartEndpointDiag[] = [diagOwn, diagAff, diagSub];

  // Log summary table
  for (const d of diagnostics) {
    logger.info(
      { label: d.label, url: d.url, status: d.status, result: d.result, count: d.count },
      `hotmart: diagnóstico — ${d.label}: ${d.result.toUpperCase()} (${d.count} itens, HTTP ${d.status})`,
    );
  }

  // Merge own + affiliate, de-duplicate by product.id
  const seen = new Set<number>();
  const merged: HotmartProductSummary[] = [];
  for (const item of [...ownItems, ...affiliateItems]) {
    if (!seen.has(item.product.id)) {
      seen.add(item.product.id);
      merged.push(item);
    }
  }

  logger.info(
    { total: merged.length, ownCount: ownItems.length, affiliateCount: affiliateItems.length },
    "hotmart: sincronização concluída — total de produtos mesclados",
  );
  return { items: merged, diagnostics };
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export interface HotmartSaleSummary {
  purchase: {
    transaction?: string;
    status?: string;
    price?: { value?: number; currency_code?: string };
  };
  buyer?: {
    email?: string;
    name?: string;
  };
}

interface HotmartSalesResponse {
  items?: HotmartSaleSummary[];
}

export async function getHotmartSales(
  accessToken: string,
  environment: string,
): Promise<HotmartSaleSummary[]> {
  const base = getHotmartApiBase(environment);
  logger.info({ environment }, "hotmart: fetching sales history");

  // Correct path: /payments/api/v1/sales/history (not /sales/api/v1)
  const res = await fetch(`${base}/payments/api/v1/sales/history?max_results=50`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn({ status: res.status, body: text.slice(0, 200) }, "hotmart: sales history error");
    return [];  // graceful — don't throw
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
  logger.info({ environment }, "hotmart: fetching subscriptions");

  const res = await fetch(`${base}/payments/api/v1/subscriptions?max_results=50`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn({ status: res.status, body: text.slice(0, 200) }, "hotmart: subscriptions error");
    return [];  // graceful — don't throw
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
