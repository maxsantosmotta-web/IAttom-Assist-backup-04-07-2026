import { GoogleAuth } from "google-auth-library";

const PACKAGE_NAME = "com.iattomassist.app";
const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const SERVICE_ACCOUNT_ENV = "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON";

function getGoogleAuth(): GoogleAuth {
  const rawCredentials = process.env[SERVICE_ACCOUNT_ENV];

  if (!rawCredentials) {
    throw new Error(`${SERVICE_ACCOUNT_ENV}_not_configured`);
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(rawCredentials) as Record<string, unknown>;
  } catch {
    throw new Error(`${SERVICE_ACCOUNT_ENV}_invalid_json`);
  }

  const clientEmail = credentials.client_email;
  const privateKey = credentials.private_key;
  if (typeof clientEmail !== "string" || typeof privateKey !== "string") {
    throw new Error(`${SERVICE_ACCOUNT_ENV}_missing_required_fields`);
  }

  return new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [ANDROID_PUBLISHER_SCOPE],
  });
}

export interface GoogleOneTimePurchase {
  purchaseState?: number;
  consumptionState?: number;
  acknowledgementState?: number;
  orderId?: string;
  productId?: string;
  purchaseToken?: string;
  quantity?: number;
  purchaseTimeMillis?: string;
  regionCode?: string;
}

export interface GoogleSubscriptionLineItem {
  productId?: string;
  expiryTime?: string;
  latestSuccessfulOrderId?: string;
  offerDetails?: {
    basePlanId?: string;
    offerId?: string;
  };
}

export interface GoogleSubscriptionPurchaseV2 {
  subscriptionState?: string;
  acknowledgementState?: string;
  startTime?: string;
  regionCode?: string;
  linkedPurchaseToken?: string;
  lineItems?: GoogleSubscriptionLineItem[];
}

interface GoogleCatalogSubscription {
  productId?: string;
}

interface GoogleCatalogSubscriptionList {
  subscriptions?: GoogleCatalogSubscription[];
}

interface GoogleCatalogOneTimeProduct {
  productId?: string;
}

interface GoogleCatalogOneTimeProductList {
  oneTimeProducts?: GoogleCatalogOneTimeProduct[];
}

async function requestGoogle<T>(url: string, method: "GET" | "POST"): Promise<T> {
  const auth = getGoogleAuth();
  const client = await auth.getClient();
  const response = await client.request<T>({ url, method });
  return response.data;
}

function encoded(value: string): string {
  return encodeURIComponent(value);
}

function hasFutureExpiry(lineItem: GoogleSubscriptionLineItem | undefined, now = new Date()): boolean {
  if (!lineItem?.expiryTime) return false;
  const expiry = new Date(lineItem.expiryTime);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() > now.getTime();
}

export function isGoogleSubscriptionEntitled(
  purchase: GoogleSubscriptionPurchaseV2,
  lineItem?: GoogleSubscriptionLineItem,
  now = new Date(),
): boolean {
  // Regra comercial IAttom: zero carência. Apenas ativa ou cancelada ainda dentro do período já pago.
  const state = purchase.subscriptionState;
  if (state !== "SUBSCRIPTION_STATE_ACTIVE" && state !== "SUBSCRIPTION_STATE_CANCELED") {
    return false;
  }

  if (lineItem) return hasFutureExpiry(lineItem, now);
  return (purchase.lineItems ?? []).some((item) => hasFutureExpiry(item, now));
}

export async function probeGooglePlayCatalog(): Promise<{
  packageName: string;
  subscriptionProductIds: string[];
  oneTimeProductIds: string[];
}> {
  const subscriptionsUrl = `${API_BASE}/applications/${encoded(PACKAGE_NAME)}/subscriptions?pageSize=50`;
  const oneTimeProductsUrl = `${API_BASE}/applications/${encoded(PACKAGE_NAME)}/oneTimeProducts?pageSize=50`;

  const [subscriptionsResponse, oneTimeProductsResponse] = await Promise.all([
    requestGoogle<GoogleCatalogSubscriptionList>(subscriptionsUrl, "GET"),
    requestGoogle<GoogleCatalogOneTimeProductList>(oneTimeProductsUrl, "GET"),
  ]);

  return {
    packageName: PACKAGE_NAME,
    subscriptionProductIds: (subscriptionsResponse.subscriptions ?? [])
      .map((item) => item.productId)
      .filter((productId): productId is string => typeof productId === "string"),
    oneTimeProductIds: (oneTimeProductsResponse.oneTimeProducts ?? [])
      .map((item) => item.productId)
      .filter((productId): productId is string => typeof productId === "string"),
  };
}

export async function verifyOneTimePurchase(
  productId: string,
  purchaseToken: string,
): Promise<GoogleOneTimePurchase> {
  const url = `${API_BASE}/applications/${encoded(PACKAGE_NAME)}/purchases/products/${encoded(productId)}/tokens/${encoded(purchaseToken)}`;
  const purchase = await requestGoogle<GoogleOneTimePurchase>(url, "GET");

  if (purchase.purchaseState !== 0) {
    throw new Error(`google_purchase_not_completed:${purchase.purchaseState ?? "unknown"}`);
  }

  if (purchase.productId && purchase.productId !== productId) {
    throw new Error("google_product_mismatch");
  }

  return purchase;
}

export async function consumeOneTimePurchase(
  productId: string,
  purchaseToken: string,
): Promise<void> {
  const url = `${API_BASE}/applications/${encoded(PACKAGE_NAME)}/purchases/products/${encoded(productId)}/tokens/${encoded(purchaseToken)}:consume`;
  await requestGoogle<unknown>(url, "POST");
}

export async function acknowledgeOneTimePurchase(
  productId: string,
  purchaseToken: string,
): Promise<void> {
  const url = `${API_BASE}/applications/${encoded(PACKAGE_NAME)}/purchases/products/${encoded(productId)}/tokens/${encoded(purchaseToken)}:acknowledge`;
  await requestGoogle<unknown>(url, "POST");
}

export async function getSubscriptionPurchase(
  purchaseToken: string,
): Promise<GoogleSubscriptionPurchaseV2> {
  const url = `${API_BASE}/applications/${encoded(PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encoded(purchaseToken)}`;
  return requestGoogle<GoogleSubscriptionPurchaseV2>(url, "GET");
}

export async function verifySubscriptionPurchase(
  purchaseToken: string,
): Promise<GoogleSubscriptionPurchaseV2> {
  const purchase = await getSubscriptionPurchase(purchaseToken);
  if (!isGoogleSubscriptionEntitled(purchase)) {
    throw new Error(`google_subscription_not_entitled:${purchase.subscriptionState ?? "unknown"}`);
  }
  return purchase;
}

export async function acknowledgeSubscriptionPurchase(
  productId: string,
  purchaseToken: string,
): Promise<void> {
  const url = `${API_BASE}/applications/${encoded(PACKAGE_NAME)}/purchases/subscriptions/${encoded(productId)}/tokens/${encoded(purchaseToken)}:acknowledge`;
  await requestGoogle<unknown>(url, "POST");
}

export { PACKAGE_NAME as GOOGLE_PLAY_PACKAGE_NAME, SERVICE_ACCOUNT_ENV as GOOGLE_PLAY_SERVICE_ACCOUNT_ENV };
