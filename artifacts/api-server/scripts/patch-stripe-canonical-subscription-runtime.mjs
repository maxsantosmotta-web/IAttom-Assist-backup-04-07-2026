import fs from "node:fs";

const canonicalPath = new URL("../src/lib/stripeCanonicalSubscription.ts", import.meta.url);
let canonicalSource = fs.readFileSync(canonicalPath, "utf8");

const legacyKeyLine = '  const legacyChangeKey = `subscription:${subscription.id}:${itemPriceId}:${targetPlan}`;\n';
canonicalSource = canonicalSource.replace(legacyKeyLine, "");

const legacyGrantBlock = `    const [existingGeneralCurrent] = await tx
      .select({ id: creditsTransactions.id })
      .from(creditsTransactions)
      .where(eq(creditsTransactions.stripeSessionId, \`\${changeKey}:general\`))
      .limit(1);
    const [existingGeneralLegacy] = existingGeneralCurrent
      ? [existingGeneralCurrent]
      : await tx
          .select({ id: creditsTransactions.id })
          .from(creditsTransactions)
          .where(eq(creditsTransactions.stripeSessionId, \`\${legacyChangeKey}:general\`))
          .limit(1);

    const [existingCreativeCurrent] = await tx
      .select({ id: creditsTransactions.id })
      .from(creditsTransactions)
      .where(eq(creditsTransactions.stripeSessionId, \`\${changeKey}:creative\`))
      .limit(1);
    const [existingCreativeLegacy] = existingCreativeCurrent
      ? [existingCreativeCurrent]
      : await tx
          .select({ id: creditsTransactions.id })
          .from(creditsTransactions)
          .where(eq(creditsTransactions.stripeSessionId, \`\${legacyChangeKey}:creative\`))
          .limit(1);

    const existingGeneral = existingGeneralCurrent ?? existingGeneralLegacy;
    const existingCreative = existingCreativeCurrent ?? existingCreativeLegacy;`;

const periodGrantBlock = `    const [existingGeneral] = await tx
      .select({ id: creditsTransactions.id })
      .from(creditsTransactions)
      .where(eq(creditsTransactions.stripeSessionId, \`\${changeKey}:general\`))
      .limit(1);

    const [existingCreative] = await tx
      .select({ id: creditsTransactions.id })
      .from(creditsTransactions)
      .where(eq(creditsTransactions.stripeSessionId, \`\${changeKey}:creative\`))
      .limit(1);`;

if (canonicalSource.includes(legacyGrantBlock)) {
  canonicalSource = canonicalSource.replace(legacyGrantBlock, periodGrantBlock);
} else if (
  !canonicalSource.includes("const [existingGeneral] = await tx") ||
  !canonicalSource.includes("const [existingCreative] = await tx")
) {
  throw new Error("Canonical subscription period idempotency marker not found");
}

if (canonicalSource.includes("legacyChangeKey") || canonicalSource.includes("existingGeneralLegacy") || canonicalSource.includes("existingCreativeLegacy")) {
  throw new Error("Legacy subscription idempotency still blocks period compensation");
}

fs.writeFileSync(canonicalPath, canonicalSource);

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

const reconcileImport = 'import { reconcileCheckoutSession } from "../lib/webhookHandlers.js";';
const stripeClientImport = 'import { getUncachableStripeClient } from "../lib/stripeClient.js";';
const canonicalRouteImport = 'import { handleCanonicalSubscriptionChange } from "../lib/stripeCanonicalSubscription.js";';

if (!stripeRoute.includes(stripeClientImport)) {
  if (!stripeRoute.includes(reconcileImport)) {
    throw new Error("Stripe reconcile import anchor not found");
  }
  stripeRoute = stripeRoute.replace(reconcileImport, `${reconcileImport}\n${stripeClientImport}`);
}

if (!stripeRoute.includes(canonicalRouteImport)) {
  if (!stripeRoute.includes(stripeClientImport)) {
    throw new Error("Stripe client import anchor not found");
  }
  stripeRoute = stripeRoute.replace(stripeClientImport, `${stripeClientImport}\n${canonicalRouteImport}`);
}

const canonicalLatestRoute = `router.post(
  "/stripe/reconcile-latest",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkUserId = (req as AuthenticatedRequest).clerkUserId;

    try {
      const [user] = await db
        .select({
          stripeCustomerId: users.stripeCustomerId,
          stripeSubscriptionId: users.stripeSubscriptionId,
        })
        .from(users)
        .where(eq(users.clerkId, clerkUserId));

      if (!user?.stripeCustomerId || !user.stripeSubscriptionId) {
        return res.status(404).json({ ok: false, message: "Assinatura Stripe não encontrada" });
      }

      const stripe = await getUncachableStripeClient();
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      const subscriptionCustomerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      if (subscriptionCustomerId !== user.stripeCustomerId) {
        return res.status(403).json({ ok: false, message: "Assinatura não pertence ao usuário autenticado" });
      }

      if (
        subscription.metadata?.clerkUserId &&
        subscription.metadata.clerkUserId !== clerkUserId
      ) {
        return res.status(403).json({ ok: false, message: "Metadados da assinatura não pertencem ao usuário autenticado" });
      }

      const result = await handleCanonicalSubscriptionChange(subscription);
      if (!result.ok) {
        return res.status(422).json(result);
      }

      return res.json(result);
    } catch (err) {
      req.log.error({ err, clerkUserId }, "Reconcile latest subscription failed");
      const message = err instanceof Error ? err.message : "Falha desconhecida";
      return res.status(500).json({ ok: false, message });
    }
  },
);

`;

const latestStart = stripeRoute.indexOf('router.post(\n  "/stripe/reconcile-latest"');
const reconcileSessionMarker = 'router.post(\n  "/stripe/reconcile-session",';
const reconcileSessionStart = stripeRoute.indexOf(reconcileSessionMarker);

if (reconcileSessionStart === -1) {
  throw new Error("Reconcile session route marker not found");
}

if (latestStart === -1) {
  stripeRoute =
    stripeRoute.slice(0, reconcileSessionStart) +
    canonicalLatestRoute +
    stripeRoute.slice(reconcileSessionStart);
} else {
  const latestEnd = stripeRoute.indexOf(reconcileSessionMarker, latestStart);
  if (latestEnd === -1) {
    throw new Error("Existing reconcile-latest route end marker not found");
  }
  stripeRoute =
    stripeRoute.slice(0, latestStart) +
    canonicalLatestRoute +
    stripeRoute.slice(latestEnd);
}

fs.writeFileSync(stripeRoutePath, stripeRoute);
console.log("Stripe canonical reconciliation uses only subscription, price and current billing period idempotency");