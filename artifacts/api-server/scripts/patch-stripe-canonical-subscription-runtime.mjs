import fs from "node:fs";

const webhookPath = new URL("../src/lib/webhookHandlers.ts", import.meta.url);
let source = fs.readFileSync(webhookPath, "utf8");

const importAnchor = 'import { logger } from "./logger.js";';
const canonicalChangeName = "handleCanonicalSubscriptionChange";
const canonicalDeletedName = "handleCanonicalSubscriptionDeleted";

if (!source.includes(canonicalChangeName)) {
  if (!source.includes(importAnchor)) {
    throw new Error("Webhook logger import anchor not found");
  }
  source = source.replace(
    importAnchor,
    `${importAnchor}\nimport { ${canonicalChangeName} } from "./stripeCanonicalSubscription.js";`,
  );
}

if (!source.includes(canonicalDeletedName)) {
  const canonicalImportLine = `import { ${canonicalChangeName} } from "./stripeCanonicalSubscription.js";`;
  if (source.includes(canonicalImportLine)) {
    source = source.replace(
      canonicalImportLine,
      `import { ${canonicalChangeName}, ${canonicalDeletedName} } from "./stripeCanonicalSubscription.js";`,
    );
  } else if (source.includes(importAnchor)) {
    source = source.replace(
      importAnchor,
      `${importAnchor}\nimport { ${canonicalDeletedName} } from "./stripeCanonicalSubscription.js";`,
    );
  } else {
    throw new Error("Webhook canonical import anchor not found");
  }
}

const changeCall = "await handleSubscriptionChange(";
const canonicalChangeCall = "await handleCanonicalSubscriptionChange(";
const deletedCall = "await handleSubscriptionDeleted(";
const canonicalDeletedCall = "await handleCanonicalSubscriptionDeleted(";

if (!source.includes(changeCall) && !source.includes(canonicalChangeCall)) {
  throw new Error("Subscription change call marker not found");
}
if (!source.includes(deletedCall) && !source.includes(canonicalDeletedCall)) {
  throw new Error("Subscription deleted call marker not found");
}

source = source
  .replaceAll(changeCall, canonicalChangeCall)
  .replaceAll(deletedCall, canonicalDeletedCall);

fs.writeFileSync(webhookPath, source);
console.log("Stripe subscription webhooks now preserve consumed balances, extra packages, and remaining active subscriptions");
