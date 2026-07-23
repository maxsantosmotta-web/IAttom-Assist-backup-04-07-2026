import fs from "node:fs";

const webhookPath = new URL("../src/lib/webhookHandlers.ts", import.meta.url);
let source = fs.readFileSync(webhookPath, "utf8");

const importAnchor = 'import { logger } from "./logger.js";';
const canonicalImport = `import {
  handleCanonicalSubscriptionChange,
  handleCanonicalSubscriptionDeleted,
} from "./stripeCanonicalSubscription.js";`;

if (!source.includes(canonicalImport)) {
  if (!source.includes(importAnchor)) {
    throw new Error("Webhook logger import anchor not found");
  }
  source = source.replace(importAnchor, `${importAnchor}\n${canonicalImport}`);
}

const changeCall = "await handleSubscriptionChange(";
const deletedCall = "await handleSubscriptionDeleted(";

if (!source.includes(changeCall)) {
  throw new Error("Subscription change call marker not found");
}
if (!source.includes(deletedCall)) {
  throw new Error("Subscription deleted call marker not found");
}

source = source
  .replaceAll(changeCall, "await handleCanonicalSubscriptionChange(")
  .replaceAll(deletedCall, "await handleCanonicalSubscriptionDeleted(");

fs.writeFileSync(webhookPath, source);
console.log("Stripe subscription webhooks now preserve consumed balances, extra packages, and remaining active subscriptions");
