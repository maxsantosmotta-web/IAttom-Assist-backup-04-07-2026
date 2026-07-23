import fs from "node:fs";

const stripeRoutePath = new URL("../src/routes/stripe.ts", import.meta.url);
let source = fs.readFileSync(stripeRoutePath, "utf8");

const routeStart = source.indexOf('router.get(\n  "/stripe/subscription"');
const routeEnd = source.indexOf('router.post(\n  "/stripe/start/checkout"', routeStart);

if (routeStart === -1 || routeEnd === -1) {
  throw new Error("Stripe subscription route markers not found");
}

const replacement = `router.get(
  "/stripe/subscription",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    try {
      const stripe = await getUncachableStripeClient();
      const customerIds = new Set<string>();
      if (user.stripeCustomerId) customerIds.add(user.stripeCustomerId);

      const customersByEmail = await stripe.customers.list({ email: user.email, limit: 100 });
      for (const customer of customersByEmail.data) {
        if (!customer.deleted) customerIds.add(customer.id);
      }

      const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, business: 2, agency: 3 };
      let activeSubscription: any = null;
      let activeCustomerId: string | null = null;
      let activePlanKey: string | null = null;

      for (const customerId of customerIds) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 100,
        });

        for (const subscription of subscriptions.data) {
          if (subscription.status !== "active" && subscription.status !== "trialing" && subscription.status !== "past_due") continue;

          const firstItem = subscription.items.data[0];
          let planKey = subscription.metadata?.planKey ||
            (firstItem ? ALLOWED_PLAN_PRICE_IDS.get(firstItem.price.id) : undefined);

          if (!planKey && firstItem) {
            const productId = typeof firstItem.price.product === "string"
              ? firstItem.price.product
              : firstItem.price.product.id;
            const product = await stripe.products.retrieve(productId);
            planKey = product.metadata?.plan;
          }

          if (planKey !== "pro" && planKey !== "business" && planKey !== "agency") continue;

          const candidateRank = PLAN_RANK[planKey] ?? -1;
          const activeRank = activePlanKey ? (PLAN_RANK[activePlanKey] ?? -1) : -1;
          if (!activeSubscription || candidateRank > activeRank || (candidateRank === activeRank && subscription.created > activeSubscription.created)) {
            activeSubscription = subscription;
            activeCustomerId = customerId;
            activePlanKey = planKey;
          }
        }
      }

      if (!activeSubscription || !activeCustomerId || !activePlanKey) {
        return res.json({
          hasSubscription: false,
          status: null,
          planKey: user.plan ?? "free",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          stripeCustomerId: user.stripeCustomerId ?? null,
          stripeSubscriptionId: user.stripeSubscriptionId ?? null,
        });
      }

      const metadataChanged =
        user.plan !== activePlanKey ||
        user.stripeCustomerId !== activeCustomerId ||
        user.stripeSubscriptionId !== activeSubscription.id ||
        user.stripeSubscriptionStatus !== activeSubscription.status;

      if (metadataChanged) {
        await db.update(users)
          .set({
            plan: activePlanKey as "pro" | "business" | "agency",
            stripeCustomerId: activeCustomerId,
            stripeSubscriptionId: activeSubscription.id,
            stripeSubscriptionStatus: activeSubscription.status,
            planSelected: true,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkUserId));
      }

      const currentPeriodEnd = Number(activeSubscription.current_period_end ?? 0);
      return res.json({
        hasSubscription: true,
        status: activeSubscription.status,
        planKey: activePlanKey,
        currentPeriodEnd: currentPeriodEnd > 0 ? new Date(currentPeriodEnd * 1000).toISOString() : null,
        cancelAtPeriodEnd: Boolean(activeSubscription.cancel_at_period_end),
        stripeCustomerId: activeCustomerId,
        stripeSubscriptionId: activeSubscription.id,
      });
    } catch (err) {
      req.log.error({ err, clerkUserId }, "Direct Stripe subscription lookup failed");
      return res.status(500).json({ error: "Falha ao consultar e sincronizar a assinatura" });
    }
  },
);

`;

source = source.slice(0, routeStart) + replacement + source.slice(routeEnd);
fs.writeFileSync(stripeRoutePath, source);
console.log("Stripe subscription lookup selects the highest active plan without overwriting balances");
