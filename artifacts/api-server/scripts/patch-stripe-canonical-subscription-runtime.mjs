import fs from "node:fs";

const webhookPath = new URL("../src/lib/webhookHandlers.ts", import.meta.url);
let source = fs.readFileSync(webhookPath, "utf8");

const importAnchor = 'import { logger } from "./logger.js";';
const changeImport = 'import { handleCanonicalSubscriptionChange } from "./stripeCanonicalSubscription.js";';
const deletedImport = 'import { handleCanonicalSubscriptionDeleted } from "./stripeCanonicalSubscription.js";';

if (!source.includes(changeImport) && !source.includes("handleCanonicalSubscriptionChange,")) {
  if (!source.includes(importAnchor)) {
    throw new Error("Webhook logger import anchor not found");
  }
  source = source.replace(importAnchor, `${importAnchor}\n${changeImport}`);
}

if (!source.includes(deletedImport) && !source.includes("handleCanonicalSubscriptionDeleted,")) {
  const existingChangeImport = 'import { handleCanonicalSubscriptionChange } from "./stripeCanonicalSubscription.js";';
  if (source.includes(existingChangeImport)) {
    source = source.replace(existingChangeImport, `${existingChangeImport}\n${deletedImport}`);
  } else if (source.includes(importAnchor)) {
    source = source.replace(importAnchor, `${importAnchor}\n${deletedImport}`);
  } else {
    throw new Error("Canonical subscription import anchor not found");
  }
}

const oldChangeCall = "await handleSubscriptionChange(";
const canonicalChangeCall = "await handleCanonicalSubscriptionChange(";
const oldDeletedCall = "await handleSubscriptionDeleted(";
const canonicalDeletedCall = "await handleCanonicalSubscriptionDeleted(";

if (source.includes(oldChangeCall)) {
  source = source.replaceAll(oldChangeCall, canonicalChangeCall);
} else if (!source.includes(canonicalChangeCall)) {
  throw new Error("Subscription change call marker not found");
}

if (source.includes(oldDeletedCall)) {
  source = source.replaceAll(oldDeletedCall, canonicalDeletedCall);
} else if (!source.includes(canonicalDeletedCall)) {
  throw new Error("Subscription deleted call marker not found");
}

fs.writeFileSync(webhookPath, source);

const stripeRoutePath = new URL("../src/routes/stripe.ts", import.meta.url);
let stripeRoute = fs.readFileSync(stripeRoutePath, "utf8");

const stripeClientImport = 'import { getUncachableStripeClient } from "../lib/stripeClient.js";';
if (!stripeRoute.includes(stripeClientImport)) {
  const reconcileImport = 'import { reconcileCheckoutSession } from "../lib/webhookHandlers.js";';
  if (!stripeRoute.includes(reconcileImport)) {
    throw new Error("Stripe reconcile import anchor not found");
  }
  stripeRoute = stripeRoute.replace(reconcileImport, `${reconcileImport}\n${stripeClientImport}`);
}

const latestRouteMarker = '"/stripe/reconcile-latest"';
if (!stripeRoute.includes(latestRouteMarker)) {
  const portalMarker = 'router.post(\n  "/stripe/portal",';
  if (!stripeRoute.includes(portalMarker)) {
    throw new Error("Stripe portal route marker not found");
  }

  const latestRoute = `router.post(
  "/stripe/reconcile-latest",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

    try {
      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId })
        .from(users)
        .where(eq(users.clerkId, clerkUserId));

      if (!user?.stripeCustomerId) {
        return res.status(404).json({ ok: false, message: "Cliente Stripe não encontrado" });
      }

      const stripe = await getUncachableStripeClient();
      const sessions = await stripe.checkout.sessions.list({
        customer: user.stripeCustomerId,
        limit: 20,
      });

      const session = sessions.data.find(
        (item) =>
          item.status === "complete" &&
          item.mode === "subscription" &&
          item.client_reference_id === clerkUserId,
      );

      if (!session) {
        return res.status(404).json({ ok: false, message: "Pagamento concluído não encontrado" });
      }

      const result = await reconcileCheckoutSession(session.id, clerkUserId);
      return res.json(result);
    } catch (err) {
      req.log.error({ err }, "Reconcile latest session failed");
      return res.status(500).json({ ok: false, error: "Reconciliation failed" });
    }
  },
);

`;

  stripeRoute = stripeRoute.replace(portalMarker, latestRoute + portalMarker);
}

fs.writeFileSync(stripeRoutePath, stripeRoute);
console.log("Stripe canonical webhooks and latest completed checkout reconciliation are active");
