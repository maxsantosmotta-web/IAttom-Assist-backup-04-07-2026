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
      const subscription = await getSubscriptionByCustomerId(user.stripeCustomerId);

      if (!subscription) {
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

      const isActive =
        subscription.status === "active" ||
        subscription.status === "trialing" ||
        subscription.status === "past_due";
      const currentPeriodEnd = Number(subscription.current_period_end ?? 0);

      return res.json({
        hasSubscription: isActive,
        status: subscription.status,
        planKey: user.plan ?? "free",
        currentPeriodEnd: currentPeriodEnd > 0
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId ?? subscription.id,
      });
    } catch (err) {
      req.log.error({ err, clerkUserId }, "Authenticated Stripe subscription lookup failed");
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
]) {
  if (patchedRoute.includes(forbidden)) {
    throw new Error(`Unsafe subscription lookup remained in patched route: ${forbidden}`);
  }
}

if (!patchedRoute.includes("if (!user.stripeCustomerId)")) {
  throw new Error("Authenticated Stripe customer guard was not applied");
}

fs.writeFileSync(stripeRoutePath, source);
console.log("Stripe subscription lookup is isolated to the authenticated user's stored customer ID.");
