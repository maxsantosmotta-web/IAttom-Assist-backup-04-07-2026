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
