import {
  LoggerManager,
  TokenManager,
  type TokenInfo,
} from "./integrations/index.js";

const ML_API_BASE  = "https://api.mercadolibre.com";
const ML_AUTH_BASE = "https://auth.mercadolivre.com/authorization";
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

// ─── ML-specific error with HTTP status ───────────────────────────────────────

export class MLApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string = "",
  ) {
    super(message);
    this.name = "MLApiError";
  }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden()    { return this.status === 403; }
  get isNotFound()     { return this.status === 404; }
  get isRateLimit()    { return this.status === 429; }
}

// ─── OAuth URL ─────────────────────────────────────────────────────────────────

export function generateMLOAuthUrl(appId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     appId,
    redirect_uri:  redirectUri,
  });
  return `${ML_AUTH_BASE}?${params.toString()}`;
}

// ─── Token response ───────────────────────────────────────────────────────────

export interface MLTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  user_id?: number;
  scope?: string;
  error?: string;
  message?: string;
}

export async function exchangeMLCode(
  appId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<MLTokenResponse> {
  LoggerManager.info("Exchanging OAuth code for access token", "ml");

  const res = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     appId,
      client_secret: clientSecret,
      code,
      redirect_uri:  redirectUri,
    }),
  });

  const data = (await res.json()) as MLTokenResponse;

  if (!res.ok || data.error) {
    LoggerManager.error(
      `Token exchange failed (${res.status}): ${data.error ?? "unknown"} — ${data.message ?? ""}`,
      "ml",
    );
  } else {
    LoggerManager.info(`Token exchange success — user_id: ${data.user_id}`, "ml");
  }

  return data;
}

export async function refreshMLToken(
  appId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<MLTokenResponse> {
  LoggerManager.info("Refreshing access token", "ml");

  const res = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     appId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const data = (await res.json()) as MLTokenResponse;

  if (!res.ok || data.error) {
    LoggerManager.error(
      `Token refresh failed (${res.status}): ${data.error ?? "unknown"} — ${data.message ?? ""}`,
      "ml",
    );
  } else {
    LoggerManager.info("Token refreshed successfully", "ml");
  }

  return data;
}

// ─── User info ────────────────────────────────────────────────────────────────

export interface MLUserInfo {
  id: number;
  nickname: string;
  email?: string;
  site_id?: string;
  country_id?: string;
  registration_date?: string;
}

export async function getMLUserInfo(accessToken: string): Promise<MLUserInfo> {
  LoggerManager.info("Fetching user info /users/me", "ml");
  return mlGet<MLUserInfo>("/users/me", accessToken);
}

// ─── Products (real) ──────────────────────────────────────────────────────────

export interface MLProductSummary {
  id: string;
  title?: string;
  price?: number;
  available_quantity?: number;
  status?: string;
  category_id?: string;
  permalink?: string;
}

interface MLItemsBatch {
  code: number;
  body: MLProductSummary;
}

interface MLItemsSearch {
  results: string[];
  paging: { total: number; offset: number; limit: number };
}

export async function getMLItems(
  accessToken: string,
  userId: string,
): Promise<MLProductSummary[]> {
  LoggerManager.info(`Fetching items for user ${userId}`, "ml");

  const search = await mlGet<MLItemsSearch>(
    `/users/${userId}/items/search?limit=50&offset=0`,
    accessToken,
  );

  const ids = search.results ?? [];
  if (ids.length === 0) {
    LoggerManager.info("No items found for user", "ml");
    return [];
  }

  // Batch-fetch details (max 20 per request)
  const items: MLProductSummary[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    const batchData = await mlGet<MLItemsBatch[]>(
      `/items?ids=${batch.join(",")}`,
      accessToken,
    );
    items.push(
      ...batchData.filter((d) => d.code === 200).map((d) => d.body),
    );
  }

  LoggerManager.info(`Fetched ${items.length} items`, "ml");
  return items;
}

// ─── Orders (real) ────────────────────────────────────────────────────────────

export interface MLOrderSummary {
  id: number;
  status?: string;
  total_amount?: number;
  buyer?: { nickname?: string; id?: number };
  date_created?: string;
}

interface MLOrdersResult {
  results: MLOrderSummary[];
  paging?: { total: number };
}

export async function getMLOrders(
  accessToken: string,
  sellerId: string,
): Promise<MLOrderSummary[]> {
  LoggerManager.info(`Fetching orders for seller ${sellerId}`, "ml");

  const data = await mlGet<MLOrdersResult>(
    `/orders/search?seller=${sellerId}&sort=date_desc&limit=50`,
    accessToken,
  );

  const orders = data.results ?? [];
  LoggerManager.info(`Fetched ${orders.length} orders`, "ml");
  return orders;
}

// ─── Create item ──────────────────────────────────────────────────────────────

export interface MLCreateItemRequest {
  title: string;
  category_id: string;
  price: number;
  currency_id: string;
  available_quantity: number;
  listing_type_id: string;
  condition: "new" | "used";
  pictures?: Array<{ source: string }>;
  attributes?: Array<{ id: string; value_name: string }>;
  shipping?: {
    mode: string;
    local_pick_up?: boolean;
    free_shipping?: boolean;
  };
}

export interface MLCreateItemResponse {
  id?: string;
  title?: string;
  permalink?: string;
  status?: string;
  error?: string;
  message?: string;
  cause?: Array<{ code: number; message: string }>;
}

export async function createMLItem(
  accessToken: string,
  item: MLCreateItemRequest,
): Promise<MLCreateItemResponse> {
  LoggerManager.info(`Creating item: "${item.title}"`, "ml");

  const res = await fetch(`${ML_API_BASE}/items`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept":       "application/json",
    },
    body: JSON.stringify(item),
  });

  const data = (await res.json()) as MLCreateItemResponse;

  if (!res.ok) {
    const cause = data.cause?.map((c) => c.message).join("; ") ?? "";
    const detail = [data.error, data.message, cause].filter(Boolean).join(" — ");
    LoggerManager.warn(`Create item ${res.status}: ${detail}`, "ml");
    throw new MLApiError(detail || `create_item_${res.status}`, res.status, JSON.stringify(data));
  }

  LoggerManager.info(`Item created: ${data.id} — ${data.permalink ?? ""}`, "ml");
  return data;
}

// ─── Generic authenticated GET — throws MLApiError with HTTP status ────────────

export async function mlGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${ML_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    LoggerManager.warn(`ML API ${res.status} at ${path}: ${body.slice(0, 200)}`, "ml");
    throw new MLApiError(`ML API ${res.status}`, res.status, body);
  }

  return (await res.json()) as T;
}

// ─── TokenManager integration ─────────────────────────────────────────────────

export function buildMLRefreshFn(
  appId: string,
  clientSecret: string,
  onNewToken: (token: MLTokenResponse, expiresAt: Date | undefined) => Promise<void>,
): (current: TokenInfo) => Promise<TokenInfo> {
  return async (current: TokenInfo): Promise<TokenInfo> => {
    if (!current.refreshToken) throw new Error("No refresh token available");

    const tokens = await refreshMLToken(appId, clientSecret, current.refreshToken);
    if (tokens.error || !tokens.access_token) {
      throw new Error(`ML refresh: ${tokens.error ?? "no access_token"}`);
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    await onNewToken(tokens, expiresAt);

    return {
      integrationId: "ml",
      accessToken:   tokens.access_token,
      refreshToken:  tokens.refresh_token ?? current.refreshToken,
      expiresAt,
    };
  };
}

export function registerMLToken(
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: Date | undefined,
  appId: string,
  clientSecret: string,
  onNewToken: (token: MLTokenResponse, expiresAt: Date | undefined) => Promise<void>,
): void {
  TokenManager.setToken({
    integrationId: "ml",
    accessToken,
    refreshToken:  refreshToken || undefined, // coerce "" to undefined
    expiresAt,
  });

  if (refreshToken) {
    TokenManager.scheduleRefresh(
      "ml",
      buildMLRefreshFn(appId, clientSecret, onNewToken),
    );
  }
}
