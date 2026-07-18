import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = readFileSync(billingUrl, "utf8");

const declarationPresent = source.includes("const hasActivePaidPlan =");
if (!declarationPresent) {
  throw new Error("FREE billing runtime patch expected hasActivePaidPlan declaration");
}

const remainingLegacyReferences = (source.match(/\bhasActiveSub\b/g) ?? []).length;
if (remainingLegacyReferences > 0) {
  source = source.replaceAll("hasActiveSub", "hasActivePaidPlan");
  writeFileSync(billingUrl, source);
  console.log(`Removed ${remainingLegacyReferences} legacy hasActiveSub reference(s) from Billing runtime.`);
} else {
  console.log("Billing runtime has no legacy hasActiveSub references.");
}
