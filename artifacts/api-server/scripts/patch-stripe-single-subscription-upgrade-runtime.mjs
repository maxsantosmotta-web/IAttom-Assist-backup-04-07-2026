import fs from "node:fs";

const stripeRoutePath = new URL("../src/routes/stripe.ts", import.meta.url);
let source = fs.readFileSync(stripeRoutePath, "utf8");

const importAnchor = 'import { reconcileCheckoutSession } from "../lib/webhookHandlers.js";';
const upgradeImport = `import {
  createOrUpgradeStripeSubscription,
  StripeSubscriptionUpgradeError,
} from "../lib/stripeSubscriptionUpgrade.js";`;

if (!source.includes(upgradeImport)) {
  if (!source.includes(importAnchor)) {
    throw new Error("Stripe route import anchor not found");
  }
  source = source.replace(importAnchor, `${importAnchor}\n${upgradeImport}`);
}

const checkoutStart = source.indexOf("const CheckoutBodySchema = z.object({");
const checkoutEnd = source.indexOf('router.post(\n  "/stripe/reconcile-session"', checkoutStart);

if (checkoutStart === -1 || checkoutEnd === -1) {
  throw new Error("Stripe checkout route markers not found");
}

const replacement = `const CheckoutBodySchema = z.object({
  priceId: z.string().min(1),
  planKey: z.enum(["free", "pro", "business", "agency"]),
});

router.post(
  "/stripe/checkout",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = CheckoutBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "priceId and valid planKey are required" });
    }

    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;
    const { priceId, planKey } = parsed.data;

    try {
      if (priceId === "free" || planKey === "free") {
        const url = await createFreeStartCheckoutSession(clerkUserId);
        return res.json({ url, action: "checkout", targetPlan: "free" });
      }

      const result = await createOrUpgradeStripeSubscription(
        clerkUserId,
        priceId,
        planKey,
      );
      return res.json(result);
    } catch (err: unknown) {
      if (err instanceof StripeSubscriptionUpgradeError) {
        const status = err.code === "MULTIPLE_ACTIVE_SUBSCRIPTIONS" ? 409 : 400;
        req.log.warn(
          { code: err.code, clerkUserId, planKey },
          "Stripe subscription action blocked safely",
        );
        return res.status(status).json({ error: err.message, code: err.code });
      }

      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("not configured")) {
        req.log.warn("Stripe checkout attempted but billing is not configured");
        return res.status(503).json({ error: "Faturamento não disponível neste ambiente." });
      }

      req.log.error({ err, clerkUserId, planKey }, "Failed to create or upgrade Stripe subscription");
      return res.status(500).json({ error: "Falha ao processar assinatura" });
    }
  },
);

`;

source = source.slice(0, checkoutStart) + replacement + source.slice(checkoutEnd);
fs.writeFileSync(stripeRoutePath, source);
console.log("Stripe checkout now creates one subscription and upgrades the existing subscription item safely");
