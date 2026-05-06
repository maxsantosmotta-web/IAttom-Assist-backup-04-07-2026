import { getUncachableStripeClient } from "./stripeClient.js";

const PLANS = [
  {
    key: "pro",
    name: "Pro Plan",
    description: "For entrepreneurs and solopreneurs. 500 credits/month.",
    amount: 7900,
  },
  {
    key: "business",
    name: "Business Plan",
    description: "For growing businesses and teams. 2,000 credits/month.",
    amount: 19900,
  },
  {
    key: "agency",
    name: "Agency Plan",
    description:
      "For agencies and power users. 10,000 credits/month.",
    amount: 49900,
  },
];

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  console.log("Seeding Stripe products and prices...\n");

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `metadata['plan']:'${plan.key}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      const existingProduct = existing.data[0];
      console.log(
        `[SKIP] ${plan.name} already exists (${existingProduct.id})`,
      );

      const prices = await stripe.prices.list({
        product: existingProduct.id,
        active: true,
      });

      if (prices.data.length > 0) {
        console.log(`       Price: ${prices.data[0].id} ($${plan.amount / 100}/mo)\n`);
      }
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { plan: plan.key },
    });
    console.log(`[CREATE] Product: ${product.name} (${product.id})`);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amount,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { plan: plan.key },
    });
    console.log(`         Price: ${price.id} ($${plan.amount / 100}/mo)\n`);
  }

  console.log("Done. Run the API server to sync data to your database.");
}

seedProducts().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
