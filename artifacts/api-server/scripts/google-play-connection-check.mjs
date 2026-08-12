import { GoogleAuth } from "google-auth-library";

const PACKAGE_NAME = "com.iattomassist.app";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const ENV_NAME = "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON";

function getCredentials() {
  const raw = process.env[ENV_NAME];
  if (!raw) throw new Error(`${ENV_NAME}_not_configured`);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${ENV_NAME}_invalid_json`);
  }

  if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") {
    throw new Error(`${ENV_NAME}_missing_required_fields`);
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
  };
}

async function getJson(client, url) {
  const response = await client.request({ url, method: "GET" });
  return response.data ?? {};
}

async function main() {
  const auth = new GoogleAuth({
    credentials: getCredentials(),
    scopes: [SCOPE],
  });
  const client = await auth.getClient();

  const subscriptionsUrl = `${API_BASE}/applications/${encodeURIComponent(PACKAGE_NAME)}/subscriptions`;
  const oneTimeUrl = `${API_BASE}/applications/${encodeURIComponent(PACKAGE_NAME)}/oneTimeProducts`;

  const [subscriptions, oneTimeProducts] = await Promise.all([
    getJson(client, subscriptionsUrl),
    getJson(client, oneTimeUrl),
  ]);

  const subscriptionIds = Array.isArray(subscriptions.subscriptions)
    ? subscriptions.subscriptions.map((item) => item?.productId).filter(Boolean)
    : [];
  const oneTimeIds = Array.isArray(oneTimeProducts.oneTimeProducts)
    ? oneTimeProducts.oneTimeProducts.map((item) => item?.productId).filter(Boolean)
    : [];

  console.log("GOOGLE_PLAY_CONNECTION_CHECK=SUCCESS");
  console.log(`PACKAGE_NAME=${PACKAGE_NAME}`);
  console.log(`SUBSCRIPTIONS=${subscriptionIds.sort().join(",")}`);
  console.log(`ONE_TIME_PRODUCTS=${oneTimeIds.sort().join(",")}`);
}

main().catch((error) => {
  const status = error?.response?.status ?? error?.code ?? "unknown";
  const message = error instanceof Error ? error.message : String(error);
  console.error("GOOGLE_PLAY_CONNECTION_CHECK=FAILED");
  console.error(`STATUS=${status}`);
  console.error(`ERROR=${message}`);
  process.exit(1);
});
