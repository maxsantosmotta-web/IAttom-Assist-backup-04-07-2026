import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = readFileSync(billingUrl, "utf8");

const usesPlansUnavailable = source.includes("plansUnavailable ?");
const declaresPlansUnavailable = source.includes("const plansUnavailable");

if (usesPlansUnavailable && !declaresPlansUnavailable) {
  const stableMarker = "  const creditsLeft =";

  if (source.includes(stableMarker)) {
    source = source.replace(
      stableMarker,
      "  const plansUnavailable = plans.length === 0 && !plansLoading;\n\n" + stableMarker,
    );
    console.log("Billing plansUnavailable declaration restored before credits state.");
  } else {
    source = source.replaceAll("plansUnavailable ?", "false ?");
    console.warn("Billing plansUnavailable condition disabled because no safe declaration marker was found.");
  }

  writeFileSync(billingUrl, source);
} else {
  console.log("Billing plansUnavailable guard already satisfied.");
}
