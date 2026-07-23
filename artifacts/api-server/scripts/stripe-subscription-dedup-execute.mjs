import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY não configurada");
}

const REQUIRED_CONFIRMATION = "CONFIRMAR_RECONCILIACAO_GLOBAL_STRIPE";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length);
if (confirmation !== REQUIRED_CONFIRMATION) {
  console.error(JSON.stringify({
    mode: "blocked",
    reason: "confirmation_required",
    requiredArgument: `--confirm=${REQUIRED_CONFIRMATION}`,
    changed: false,
  }, null, 2));
  process.exit(2);
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
  if (metadataPlan) return String(metadataPlan).toLowerCase();

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
  if (normalized.includes("premium") || normalized.includes("business")) return 2;
  if (normalized.includes("start")) return 1;
  if (normalized.includes("pro")) return 3;
  return -1;
}

async function loadActiveSubscriptions(customerId) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  const enriched = [];
  for (const subscription of subscriptions.data.filter((item) => ACTIVE_STATUSES.has(item.status))) {
    const plan = await identifyPlan(subscription);
    enriched.push({
      subscription,
      plan,
      rank: rankPlan(plan),
      created: subscription.created,
    });
  }

  enriched.sort((a, b) => b.rank - a.rank || b.created - a.created);
  return enriched;
}

const report = {
  mode: "execute",
  startedAt: new Date().toISOString(),
  scannedCustomers: 0,
  affectedCustomers: 0,
  canceledSubscriptions: 0,
  skippedCustomers: 0,
  failedCustomers: 0,
  results: [],
};

let startingAfter;
do {
  const page = await stripe.customers.list({
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  });

  for (const customer of page.data) {
    report.scannedCustomers += 1;
    const before = await loadActiveSubscriptions(customer.id);
    if (before.length <= 1) continue;

    report.affectedCustomers += 1;
    const keep = before[0];
    const candidates = before.slice(1);

    if (keep.rank < 0 || candidates.some((candidate) => candidate.rank < 0)) {
      report.skippedCustomers += 1;
      report.results.push({
        customerId: customer.id,
        email: customer.email ?? null,
        status: "skipped_unknown_plan",
        plans: before.map((item) => ({ id: item.subscription.id, plan: item.plan, rank: item.rank })),
      });
      continue;
    }

    const customerResult = {
      customerId: customer.id,
      email: customer.email ?? null,
      status: "pending",
      keep: { id: keep.subscription.id, plan: keep.plan, rank: keep.rank },
      canceled: [],
    };

    try {
      for (const candidate of candidates) {
        const latestKeep = await stripe.subscriptions.retrieve(keep.subscription.id);
        const latestCandidate = await stripe.subscriptions.retrieve(candidate.subscription.id);

        if (!ACTIVE_STATUSES.has(latestKeep.status)) {
          throw new Error(`Assinatura preservada ${latestKeep.id} deixou de estar ativa`);
        }
        if (!ACTIVE_STATUSES.has(latestCandidate.status)) {
          continue;
        }

        await stripe.subscriptions.cancel(latestCandidate.id, {
          invoice_now: false,
          prorate: false,
        });

        customerResult.canceled.push({
          id: latestCandidate.id,
          plan: candidate.plan,
        });
        report.canceledSubscriptions += 1;
      }

      const after = await loadActiveSubscriptions(customer.id);
      if (after.length !== 1 || after[0].subscription.id !== keep.subscription.id) {
        throw new Error(`Verificação final falhou: ${after.length} assinaturas ativas restantes`);
      }

      customerResult.status = "reconciled";
    } catch (error) {
      report.failedCustomers += 1;
      customerResult.status = "failed";
      customerResult.error = error instanceof Error ? error.message : String(error);
    }

    report.results.push(customerResult);
  }

  startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
} while (startingAfter);

report.finishedAt = new Date().toISOString();
console.log(JSON.stringify(report, null, 2));

if (report.failedCustomers > 0) {
  process.exitCode = 1;
}
