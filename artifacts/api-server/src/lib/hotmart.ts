import crypto from "crypto";
import { logger } from "./logger.js";

const HOTMART_API_BASE_SANDBOX = "https://sandbox.hotmart.com";
const HOTMART_API_BASE_PROD = "https://api-sec-vlc.hotmart.com";
const HOTMART_TOKEN_URL_SANDBOX = "https://api-sec-vlc.hotmart.com/security/oauth/token";
const HOTMART_TOKEN_URL_PROD = "https://api-sec-vlc.hotmart.com/security/oauth/token";

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
  const url = environment === "production" ? HOTMART_TOKEN_URL_PROD : HOTMART_TOKEN_URL_SANDBOX;
  logger.info({ environment }, "hotmart: fetching access token");

  const res = await fetch(`${url}?grant_type=client_credentials`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  return (await res.json()) as HotmartTokenResponse;
}

// ─── Products (placeholder) ───────────────────────────────────────────────────

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

export async function getHotmartProducts(
  _accessToken: string,
  _environment: string,
): Promise<HotmartProductSummary[]> {
  // TODO: GET /product/api/v2/products
  logger.info("hotmart: getProducts (placeholder — not implemented)");
  return [];
}

// ─── Sales (placeholder) ─────────────────────────────────────────────────────

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

export async function getHotmartSales(
  _accessToken: string,
  _environment: string,
): Promise<HotmartSaleSummary[]> {
  // TODO: GET /sales/api/v1/sales/history
  logger.info("hotmart: getSales (placeholder — not implemented)");
  return [];
}

// ─── Subscriptions (placeholder) ─────────────────────────────────────────────

export async function getHotmartSubscriptions(
  _accessToken: string,
  _environment: string,
): Promise<unknown[]> {
  // TODO: GET /payments/api/v1/subscriptions
  logger.info("hotmart: getSubscriptions (placeholder — not implemented)");
  return [];
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
