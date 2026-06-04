import crypto from "crypto";
import { logger } from "./logger.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const KIWIFY_API_BASE = "https://public-api.kiwify.com/v1";
const KIWIFY_TOKEN_URL = `${KIWIFY_API_BASE}/oauth/token`;

// ─── Webhook signature verification ──────────────────────────────────────────

export function verifyKiwifyWebhook(
  webhookToken: string,
  body: string,
  receivedSignature: string | undefined,
): boolean {
  if (!receivedSignature) return false;
  const expected = crypto
    .createHmac("sha1", webhookToken)
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

/**
 * Obtém o bearer token da Kiwify a partir do client_secret (API Key).
 *
 * Credencial única necessária: client_secret obtido em:
 *   Dashboard Kiwify → Apps → API → Criar API Key
 *
 * Token expira em 96 horas (expires_in: 345600).
 */
export async function getKiwifyAccessToken(
  clientSecret: string,
): Promise<KiwifyTokenResponse> {
  logger.info("kiwify: fetching access token");

  const res = await fetch(KIWIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_secret: clientSecret }),
  });

  const data = (await res.json()) as KiwifyTokenResponse;

  if (!res.ok) {
    logger.warn({ status: res.status, error: data.error }, "kiwify: token request failed");
  }

  return data;
}

// ─── Generic authenticated request ───────────────────────────────────────────

/**
 * Faz uma requisição GET autenticada na API Kiwify.
 *
 * Headers obrigatórios (conforme docs.kiwify.com.br):
 *   Authorization: Bearer <access_token>
 *   x-kiwify-account-id: <client_secret>   ← o próprio API Key
 */
export async function kiwifyGet<T>(
  path: string,
  accessToken: string,
  clientSecret: string,
): Promise<T> {
  const res = await fetch(`${KIWIFY_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-kiwify-account-id": clientSecret,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn({ status: res.status, path, text }, "kiwify: API request failed");
    throw new Error(`Kiwify API error: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

// ─── Account details (usado para testar a conexão) ────────────────────────────

export interface KiwifyAccountDetails {
  id?: string;
  company_name?: string;
  director_cpf?: string;
  company_cnpj?: string;
  legal_entities?: Array<{
    id?: string;
    active?: boolean;
    company_name?: string;
  }>;
}

export async function getKiwifyAccountDetails(
  accessToken: string,
  clientSecret: string,
): Promise<KiwifyAccountDetails> {
  return kiwifyGet<KiwifyAccountDetails>("/account-details", accessToken, clientSecret);
}

// ─── Products ─────────────────────────────────────────────────────────────────

export interface KiwifyProductSummary {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  price?: number | null;
  currency?: string;
  affiliate_enabled?: boolean;
  payment_type?: string;
  created_at?: string;
}

export interface KiwifyPaginatedResponse<T> {
  pagination?: { count: number; page_number: number; page_size: number };
  data?: T[];
}

export async function getKiwifyProducts(
  accessToken: string,
  clientSecret: string,
  page = 1,
  pageSize = 50,
): Promise<KiwifyProductSummary[]> {
  logger.info({ page, pageSize }, "kiwify: fetching products");
  const result = await kiwifyGet<KiwifyPaginatedResponse<KiwifyProductSummary>>(
    `/products?page_number=${page}&page_size=${pageSize}`,
    accessToken,
    clientSecret,
  );
  return result.data ?? [];
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export interface KiwifySaleSummary {
  id: string;
  status?: string;
  product_id?: string;
  payment_method?: string;
  created_at?: string;
  customer?: { email?: string; full_name?: string };
  amount?: number;
}

export async function getKiwifySales(
  accessToken: string,
  clientSecret: string,
  startDate: string,
  endDate: string,
  page = 1,
  pageSize = 50,
): Promise<KiwifySaleSummary[]> {
  logger.info({ startDate, endDate }, "kiwify: fetching sales");
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    page_number: String(page),
    page_size: String(pageSize),
  });
  const result = await kiwifyGet<KiwifyPaginatedResponse<KiwifySaleSummary>>(
    `/sales?${params.toString()}`,
    accessToken,
    clientSecret,
  );
  return result.data ?? [];
}

// ─── Test connection ──────────────────────────────────────────────────────────

export interface KiwifyConnectionTestResult {
  ok: boolean;
  status: "validated" | "auth_error" | "network_error";
  accessToken?: string;
  expiresIn?: number;
  accountName?: string;
  accountId?: string;
  error?: string;
}

/**
 * Testa a conexão com a Kiwify:
 *   1. Obtém um bearer token a partir do client_secret
 *   2. Consulta /account-details para confirmar que o token é válido
 *   3. Retorna { ok, status, accountName, accountId, accessToken, expiresIn }
 */
export async function testKiwifyConnection(
  clientSecret: string,
): Promise<KiwifyConnectionTestResult> {
  let tokenRes: KiwifyTokenResponse;
  try {
    tokenRes = await getKiwifyAccessToken(clientSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: "network_error", error: `Falha de rede ao obter token: ${msg}` };
  }

  if (!tokenRes.access_token) {
    return {
      ok: false,
      status: "auth_error",
      error: tokenRes.message ?? tokenRes.error ?? "Token não retornado. Verifique o client_secret.",
    };
  }

  try {
    const account = await getKiwifyAccountDetails(tokenRes.access_token, clientSecret);
    return {
      ok: true,
      status: "validated",
      accessToken: tokenRes.access_token,
      expiresIn: tokenRes.expires_in,
      accountName:
        account.company_name ??
        account.legal_entities?.[0]?.company_name ??
        undefined,
      accountId: account.id ?? undefined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: "auth_error",
      error: `Token obtido mas falha ao verificar conta: ${msg}`,
    };
  }
}

// ─── Event type labels ────────────────────────────────────────────────────────

export const KIWIFY_EVENT_LABELS: Record<string, string> = {
  compra_aprovada:       "Compra Aprovada",
  compra_reembolsada:    "Reembolso",
  chargeback:            "Chargeback",
  pix_gerado:            "PIX Gerado",
  boleto_gerado:         "Boleto Gerado",
  carrinho_abandonado:   "Carrinho Abandonado",
  compra_recusada:       "Compra Recusada",
  subscription_canceled: "Assinatura Cancelada",
  subscription_late:     "Assinatura Inadimplente",
  subscription_renewed:  "Assinatura Renovada",
  // chaves legadas mantidas para compatibilidade com eventos antigos
  "order.approved":         "Compra Aprovada",
  "order.refunded":         "Reembolso",
  "order.chargeback":       "Chargeback",
  "order.waiting_payment":  "Aguardando Pagamento",
  "order.abandoned":        "Abandono de Checkout",
  "order.canceled":         "Cancelado",
  "subscription.active":    "Assinatura Ativa",
  "subscription.canceled":  "Assinatura Cancelada",
  "subscription.overdue":   "Assinatura Inadimplente",
  "subscription.reactivated": "Assinatura Reativada",
};
