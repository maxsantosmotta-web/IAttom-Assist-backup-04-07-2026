import crypto from "crypto";
import { logger } from "./logger.js";

const KIWIFY_API_BASE = "https://api.kiwify.com.br/v1";
const KIWIFY_TOKEN_URL = "https://api.kiwify.com.br/v1/oauth/token";

// ─── Webhook signature verification ──────────────────────────────────────────

export function verifyKiwifyWebhook(
  webhookSecret: string,
  body: string,
  receivedSignature: string | undefined,
): boolean {
  if (!receivedSignature) return false;
  const expected = crypto
    .createHmac("sha1", webhookSecret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(receivedSignature),
  );
}

// ─── OAuth token ──────────────────────────────────────────────────────────────

export interface KiwifyTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  message?: string;
}

export async function getKiwifyAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<KiwifyTokenResponse> {
  logger.info("kiwify: fetching access token");

  const res = await fetch(KIWIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  return (await res.json()) as KiwifyTokenResponse;
}

// ─── Products (placeholder) ───────────────────────────────────────────────────

export interface KiwifyProductSummary {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  price?: number;
}

export async function getKiwifyProducts(
  _accessToken: string,
  _storeId: string,
): Promise<KiwifyProductSummary[]> {
  // TODO: GET /products — requires valid access_token + store_id header
  logger.info("kiwify: getProducts (placeholder — not implemented)");
  return [];
}

// ─── Orders (placeholder) ─────────────────────────────────────────────────────

export interface KiwifyOrderSummary {
  id: string;
  status?: string;
  product_id?: string;
  customer?: { email?: string; full_name?: string };
  amount?: number;
}

export async function getKiwifyOrders(
  _accessToken: string,
  _storeId: string,
): Promise<KiwifyOrderSummary[]> {
  // TODO: GET /orders
  logger.info("kiwify: getOrders (placeholder — not implemented)");
  return [];
}

// ─── Generic authenticated request ───────────────────────────────────────────

export async function kiwifyGet<T>(
  path: string,
  accessToken: string,
  storeId: string,
): Promise<T> {
  const res = await fetch(`${KIWIFY_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "store-id": storeId,
    },
  });
  if (!res.ok) {
    logger.warn({ status: res.status, path }, "kiwify: API request failed");
    throw new Error(`Kiwify API error: ${res.status}`);
  }
  return (await res.json()) as T;
}

// ─── Event type labels ────────────────────────────────────────────────────────

export const KIWIFY_EVENT_LABELS: Record<string, string> = {
  "order.approved": "Compra Aprovada",
  "order.refunded": "Reembolso",
  "order.chargeback": "Chargeback",
  "order.waiting_payment": "Aguardando Pagamento",
  "order.abandoned": "Abandono de Checkout",
  "order.canceled": "Cancelado",
  "subscription.active": "Assinatura Ativa",
  "subscription.canceled": "Assinatura Cancelada",
  "subscription.overdue": "Assinatura Inadimplente",
  "subscription.reactivated": "Assinatura Reativada",
};
