import { readFile, writeFile } from "node:fs/promises";

const fileUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
const source = await readFile(fileUrl, "utf8");
const oldCode = "const handleBillingRefresh = () => { void refetchPlans(); void refetchSub(); void refetchMe(); void refetchCredits(); };";
const newCode = "const handleBillingRefresh = () => { window.location.reload(); };";

if (source.includes(newCode)) {
  console.log("Billing browser refresh already applied.");
} else {
  if (!source.includes(oldCode)) {
    throw new Error("Billing refresh handler marker not found.");
  }
  await writeFile(fileUrl, source.replace(oldCode, newCode), "utf8");
  console.log("Billing refresh now reloads the browser page.");
}

// Run last so Help/Credits synchronization is applied after all source-rewriting patches.
await import("./patch-help-credit-react-query-sync.mjs");

const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
let credits = await readFile(creditsUrl, "utf8");
const partialRefresh = 'onClick={() => { void refetchBalance(); void refetchTx(); void loadVideoBalance(); void loadHelpUsage(); }}';
const fullRefresh = 'onClick={() => window.location.reload()}';

if (credits.includes(partialRefresh)) {
  credits = credits.replace(partialRefresh, fullRefresh);
  await writeFile(creditsUrl, credits, "utf8");
} else if (!credits.includes(fullRefresh)) {
  throw new Error("Credits full refresh handler marker not found.");
}

console.log("Credits refresh reloads the entire screen, including all balances and history.");
