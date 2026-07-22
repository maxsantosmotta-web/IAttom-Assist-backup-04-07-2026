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

      let activeSubscription: any = null;
      let activeCustomerId: string | null = null;

      for (const customerId of customerIds) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 100,
        });
        const active = subscriptions.data
          .filter((subscription) => subscription.status === "active" || subscription.status === "trialing")
          .sort((a, b) => b.created - a.created)[0];
        if (active && (!activeSubscription || active.created > activeSubscription.created)) {
          activeSubscription = active;
          activeCustomerId = customerId;
        }
      }

      if (!activeSubscription || !activeCustomerId) {
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

      const firstItem = activeSubscription.items.data[0];
      let planKey = activeSubscription.metadata?.planKey ||
        (firstItem ? ALLOWED_PLAN_PRICE_IDS.get(firstItem.price.id) : undefined);

      if (!planKey && firstItem) {
        const productId = typeof firstItem.price.product === "string"
          ? firstItem.price.product
          : firstItem.price.product.id;
        const product = await stripe.products.retrieve(productId);
        planKey = product.metadata?.plan;
      }

      if (planKey !== "pro" && planKey !== "business" && planKey !== "agency") {
        req.log.error(
          { clerkUserId, subscriptionId: activeSubscription.id, priceId: firstItem?.price?.id, planKey },
          "Active Stripe subscription plan could not be identified",
        );
        return res.status(422).json({ error: "Plano da assinatura ativa não identificado" });
      }

      const subscriptionChanged =
        user.plan !== planKey ||
        user.stripeSubscriptionId !== activeSubscription.id;

      const metadataChanged =
        user.stripeCustomerId !== activeCustomerId ||
        user.stripeSubscriptionStatus !== activeSubscription.status;

      if (subscriptionChanged) {
        const balanceBefore = user.credits ?? 0;
        await db.update(users)
          .set({
            plan: planKey,
            credits: 20,
            creativeCredits: 40,
            stripeCustomerId: activeCustomerId,
            stripeSubscriptionId: activeSubscription.id,
            stripeSubscriptionStatus: activeSubscription.status,
            planSelected: true,
            helpMessagesUsed: 0,
            helpUsedResetAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkUserId));

        if (balanceBefore !== 20) {
          await db.insert(creditsTransactions).values({
            clerkUserId,
            amount: 20 - balanceBefore,
            type: "credit",
            description: "Assinatura Stripe ativada ou plano alterado",
            balanceBefore,
            balanceAfter: 20,
          });
        }

        req.log.info(
          { clerkUserId, customerId: activeCustomerId, subscriptionId: activeSubscription.id, planKey },
          "Paid subscription activated from Stripe",
        );
      } else if (metadataChanged) {
        await db.update(users)
          .set({
            stripeCustomerId: activeCustomerId,
            stripeSubscriptionStatus: activeSubscription.status,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkUserId));
      }

      const currentPeriodEnd = Number(activeSubscription.current_period_end ?? 0);
      return res.json({
        hasSubscription: true,
        status: activeSubscription.status,
        planKey,
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
console.log("Stripe subscription sync preserves already-consumed plan and creative credits");
