import { readFileSync, writeFileSync } from "node:fs";

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = readFileSync(billingUrl, "utf8");

const usesPlansUnavailable = source.includes("plansUnavailable ?");
const declaresPlansUnavailable = source.includes("const plansUnavailable");

if (usesPlansUnavailable && !declaresPlansUnavailable) {
  const loadingLine = "  const isLoading    = plansLoading || subLoading;";
  const finiteLoadingLine = "  const isLoading    = (plansLoading && plans.length === 0) || (subLoading && !subscription);";
  const declaration = "\n  const plansUnavailable = plans.length === 0 && !plansLoading;";

  if (source.includes(finiteLoadingLine)) {
    source = source.replace(finiteLoadingLine, finiteLoadingLine + declaration);
  } else if (source.includes(loadingLine)) {
    source = source.replace(loadingLine, loadingLine + declaration);
  } else {
    throw new Error("Billing loading declaration was not found for plansUnavailable guard");
  }

  writeFileSync(billingUrl, source);
  console.log("Billing plansUnavailable declaration restored.");
} else {
  console.log("Billing plansUnavailable guard already satisfied.");
}
