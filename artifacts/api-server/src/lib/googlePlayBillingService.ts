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

async function requestGoogle<T>(url: string, method: "GET" | "POST"): Promise<T> {
  const auth = getGoogleAuth();
  const client = await auth.getClient();
  const response = await client.request<T>({ url, method });
  return response.data;
}

function encoded(value: string): string {
  return encodeURIComponent(value);
}

export async function verifyOneTimePurchase(
  productId: string,
  purchaseToken: string,
): Promise<GoogleOneTimePurchase> {
  const url = `${API_BASE}/applications/${encoded(PACKAGE_NAME)}/purchases/products/${encoded(productId)}/tokens/${encoded(purchaseToken)}`;
  const purchase = await requestGoogle<GoogleOneTimePurchase>(url, "GET");

  // ProductPurchase.purchaseState: 0 = purchased, 1 = canceled, 2 = pending.
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

export async function verifySubscriptionPurchase(
  purchaseToken: string,
): Promise<GoogleSubscriptionPurchaseV2> {
  const url = `${API_BASE}/applications/${encoded(PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encoded(purchaseToken)}`;
  const purchase = await requestGoogle<GoogleSubscriptionPurchaseV2>(url, "GET");

  const allowedStates = new Set([
    "SUBSCRIPTION_STATE_ACTIVE",
    "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  ]);
  if (!purchase.subscriptionState || !allowedStates.has(purchase.subscriptionState)) {
    throw new Error(`google_subscription_not_entitled:${purchase.subscriptionState ?? "unknown"}`);
  }

  return purchase;
}

export async function acknowledgeSubscriptionPurchase(
  productId: string,
  purchaseToken: string,
): Promise<void> {
  // O endpoint de acknowledge permanece em purchases.subscriptions.
  const url = `${API_BASE}/applications/${encoded(PACKAGE_NAME)}/purchases/subscriptions/${encoded(productId)}/tokens/${encoded(purchaseToken)}:acknowledge`;
  await requestGoogle<unknown>(url, "POST");
}

export { PACKAGE_NAME as GOOGLE_PLAY_PACKAGE_NAME, SERVICE_ACCOUNT_ENV as GOOGLE_PLAY_SERVICE_ACCOUNT_ENV };
