import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY não configurada");
}

const stripe = new Stripe(secretKey);
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
const PLAN_RANK = new Map([
  ["free", 0],
  ["pro", 1],
  ["business", 2],
  ["agency", 3],
  ["start", 1],
  ["premium", 2],
]);

async function identifyPlan(subscription) {
  const metadataPlan = subscription.metadata?.planKey ?? subscription.metadata?.plan;
  if (metadataPlan) return metadataPlan.toLowerCase();

  const item = subscription.items?.data?.[0];
  if (!item?.price) return "unknown";

  const productId = typeof item.price.product === "string"
    ? item.price.product
    : item.price.product?.id;
  if (!productId) return "unknown";

  const product = await stripe.products.retrieve(productId);
  return String(product.metadata?.plan ?? product.metadata?.planKey ?? product.name ?? "unknown").toLowerCase();
}

function rankPlan(plan) {
  const normalized = String(plan).toLowerCase();
  if (PLAN_RANK.has(normalized)) return PLAN_RANK.get(normalized);
  if (normalized.includes("pro")) return 3;
  if (normalized.includes("premium") || normalized.includes("business")) return 2;
  if (normalized.includes("start")) return 1;
  return -1;
}

const affected = [];
let scannedCustomers = 0;
let startingAfter;

do {
  const page = await stripe.customers.list({ limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });

  for (const customer of page.data) {
    scannedCustomers += 1;
    const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 100 });
    const active = subscriptions.data.filter((subscription) => ACTIVE_STATUSES.has(subscription.status));
    if (active.length <= 1) continue;

    const enriched = [];
    for (const subscription of active) {
      const plan = await identifyPlan(subscription);
      enriched.push({
        id: subscription.id,
        plan,
        rank: rankPlan(plan),
        status: subscription.status,
        created: subscription.created,
        currentPeriodEnd: subscription.current_period_end ?? null,
      });
    }

    enriched.sort((a, b) => b.rank - a.rank || b.created - a.created);
    const keep = enriched[0];
    const cancel = enriched.slice(1);

    affected.push({
      customerId: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
      activeSubscriptionCount: enriched.length,
      keep,
      cancel,
    });
  }

  startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
} while (startingAfter);

const report = {
  mode: "preview_only",
  generatedAt: new Date().toISOString(),
  scannedCustomers,
  affectedCustomers: affected.length,
  subscriptionsToKeep: affected.length,
  subscriptionsToCancel: affected.reduce((sum, customer) => sum + customer.cancel.length, 0),
  affected,
};

console.log(JSON.stringify(report, null, 2));
