type GooglePlayBillingPeriod = "monthly" | "annual";
type GooglePlayPlanKey = "pro" | "business" | "agency";

type GooglePlaySubscriptionConfig = {
  productId: string;
  basePlanId: string;
};

type DigitalGoodsServiceLike = {
  getDetails: (itemIds: string[]) => Promise<Array<{ itemId?: string }>>;
};

type WindowWithDigitalGoods = Window & {
  getDigitalGoodsService?: (serviceUrl: string) => Promise<DigitalGoodsServiceLike>;
};

const PLAY_BILLING_METHOD = "https://play.google.com/billing";

export const GOOGLE_PLAY_SUBSCRIPTIONS: Record<
  GooglePlayPlanKey,
  Record<GooglePlayBillingPeriod, GooglePlaySubscriptionConfig>
> = {
  pro: {
    monthly: { productId: "iattom_start", basePlanId: "start-mensal" },
    annual: { productId: "iattom_start_anual", basePlanId: "start-anual" },
  },
  business: {
    monthly: { productId: "iattom_premium", basePlanId: "premium-mensal" },
    annual: { productId: "iattom_premium_anual", basePlanId: "premium-anual" },
  },
  agency: {
    monthly: { productId: "iattom_pro", basePlanId: "pro-mensal" },
    annual: { productId: "iattom_pro_anual", basePlanId: "pro-anual" },
  },
};

export const GOOGLE_PLAY_ONE_TIME_BY_UI_ID: Record<string, string> = {
  credits_300: "creditos_100",
  credits_700: "creditos_200",
  credits_1500: "creditos_500",
  creative_20: "imagens_10",
  creative_35: "imagens_20",
  creative_50: "imagens_30",
  video_10: "videos_10",
  video_20: "videos_20",
  video_30: "videos_30",
};

async function getPlayBillingService(): Promise<DigitalGoodsServiceLike | null> {
  if (typeof window === "undefined") return null;
  const playWindow = window as WindowWithDigitalGoods;
  if (typeof playWindow.getDigitalGoodsService !== "function") return null;

  try {
    return await playWindow.getDigitalGoodsService(PLAY_BILLING_METHOD);
  } catch {
    return null;
  }
}

export async function isGooglePlayBillingAvailable(): Promise<boolean> {
  return (await getPlayBillingService()) !== null;
}

async function assertProductAvailable(productId: string): Promise<void> {
  const service = await getPlayBillingService();
  if (!service) throw new Error("google_play_billing_unavailable");

  const details = await service.getDetails([productId]);
  if (!details.some((item) => item.itemId === productId)) {
    throw new Error(`google_play_product_unavailable:${productId}`);
  }
}

async function requestPurchaseToken(productId: string): Promise<{
  purchaseToken: string;
  response: PaymentResponse;
}> {
  await assertProductAvailable(productId);

  const methodData = [
    {
      supportedMethods: PLAY_BILLING_METHOD,
      data: { sku: productId },
    },
  ];

  const request = new PaymentRequest(methodData);
  const response = await request.show();
  const details = response.details as { purchaseToken?: unknown } | null;
  const purchaseToken = typeof details?.purchaseToken === "string" ? details.purchaseToken : "";

  if (!purchaseToken) {
    await response.complete("fail");
    throw new Error("google_play_purchase_token_missing");
  }

  return { purchaseToken, response };
}

async function confirmWithBackend(
  endpoint: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || payload.ok === false) {
    const message = typeof payload.error === "string" ? payload.error : "google_play_backend_confirmation_failed";
    throw new Error(message);
  }

  return payload;
}

export async function purchaseGooglePlayOneTime(productId: string): Promise<Record<string, unknown>> {
  const { purchaseToken, response } = await requestPurchaseToken(productId);

  try {
    const payload = await confirmWithBackend("/api/google-play/one-time/confirm", {
      productId,
      purchaseToken,
    });
    await response.complete("success");
    return payload;
  } catch (error) {
    await response.complete("fail");
    throw error;
  }
}

export async function purchaseGooglePlaySubscription(
  productId: string,
  basePlanId: string,
): Promise<Record<string, unknown>> {
  const { purchaseToken, response } = await requestPurchaseToken(productId);

  try {
    const payload = await confirmWithBackend("/api/google-play/subscription/confirm", {
      productId,
      basePlanId,
      purchaseToken,
    });
    await response.complete("success");
    return payload;
  } catch (error) {
    await response.complete("fail");
    throw error;
  }
}
