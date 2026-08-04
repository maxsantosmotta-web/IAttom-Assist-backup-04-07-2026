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

    if (!user.stripeCustomerId) {
      return res.json({
        hasSubscription: false,
        status: null,
        planKey: user.plan ?? "free",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
    }

    try {
      const stripe = await getUncachableStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 100,
      });

      const activeSubscription = subscriptions.data
        .filter((subscription) =>
          subscription.status === "active" ||
          subscription.status === "trialing" ||
          subscription.status === "past_due"
        )
        .sort((a, b) => b.created - a.created)[0] ?? null;

      if (!activeSubscription) {
        return res.json({
          hasSubscription: false,
          status: null,
          planKey: user.plan ?? "free",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: null,
        });
      }

      const subscriptionCustomerId =
        typeof activeSubscription.customer === "string"
          ? activeSubscription.customer
          : activeSubscription.customer.id;

      if (subscriptionCustomerId !== user.stripeCustomerId) {
        return res.status(403).json({ error: "Assinatura não pertence ao usuário autenticado" });
      }

      const firstItem = activeSubscription.items.data[0];
      let resolvedPlan = activeSubscription.metadata?.planKey ||
        firstItem?.price.metadata?.plan ||
        null;

      if (!resolvedPlan && firstItem) {
        const productId = typeof firstItem.price.product === "string"
          ? firstItem.price.product
          : firstItem.price.product.id;
        const product = await stripe.products.retrieve(productId);
        resolvedPlan = product.metadata?.plan || null;
      }

      const validResolvedPlan =
        resolvedPlan === "pro" || resolvedPlan === "business" || resolvedPlan === "agency"
          ? resolvedPlan
          : null;
      const existingPaidPlan =
        user.plan === "pro" || user.plan === "business" || user.plan === "agency"
          ? user.plan
          : null;
      const effectivePlan = validResolvedPlan ?? existingPaidPlan;

      if (!effectivePlan) {
        req.log.error(
          { clerkUserId, stripeCustomerId: user.stripeCustomerId, subscriptionId: activeSubscription.id },
          "Active Stripe subscription found without a resolvable paid plan",
        );
        return res.status(422).json({ error: "Assinatura ativa sem plano reconhecido" });
      }

      const metadataChanged =
        user.plan !== effectivePlan ||
        user.stripeSubscriptionId !== activeSubscription.id ||
        user.stripeSubscriptionStatus !== activeSubscription.status ||
        user.planSelected !== true;

      if (metadataChanged) {
        await db.update(users)
          .set({
            plan: effectivePlan,
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
        planKey: effectivePlan,
        currentPeriodEnd: currentPeriodEnd > 0
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
        cancelAtPeriodEnd: Boolean(activeSubscription.cancel_at_period_end),
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: activeSubscription.id,
      });
    } catch (err) {
      req.log.error({ err, clerkUserId }, "Authenticated live Stripe subscription lookup failed");
      return res.status(500).json({ error: "Falha ao consultar a assinatura" });
    }
  },
);

`;

source = source.slice(0, routeStart) + replacement + source.slice(routeEnd);

const patchedRouteEnd = source.indexOf(
  'router.post(\n  "/stripe/start/checkout"',
  routeStart,
);
const patchedRoute = source.slice(routeStart, patchedRouteEnd);

for (const forbidden of [
  "stripe.customers.list({ email: user.email",
  "customersByEmail",
  "PLAN_RANK",
  "getSubscriptionByCustomerId(user.stripeCustomerId)",
]) {
  if (patchedRoute.includes(forbidden)) {
    throw new Error(`Unsafe subscription lookup remained in patched route: ${forbidden}`);
  }
}

for (const required of [
  "stripe.subscriptions.list({",
  "customer: user.stripeCustomerId",
  "subscriptionCustomerId !== user.stripeCustomerId",
  "hasSubscription: true",
  "stripeSubscriptionStatus: activeSubscription.status",
]) {
  if (!patchedRoute.includes(required)) {
    throw new Error(`Authenticated live Stripe subscription marker missing: ${required}`);
  }
}

for (const forbiddenBalanceField of [
  "credits:",
  "creativeCredits:",
  "videoBalance:",
  "helpMessagesUsed:",
]) {
  if (patchedRoute.includes(forbiddenBalanceField)) {
    throw new Error(`Subscription access repair must not change balances: ${forbiddenBalanceField}`);
  }
}

fs.writeFileSync(stripeRoutePath, source);
console.log("Paid subscription access now uses the authenticated user's live Stripe customer without changing balances.");
