import { readFileSync, writeFileSync } from "node:fs";

const hookUrl = new URL("../src/hooks/useSavedItems.ts", import.meta.url);
let source = readFileSync(hookUrl, "utf8");

const oldDelays = "    const retryDelays = [0, 300, 700];";
const newDelays = "    const retryDelays = [0, 250, 500, 1000, 1500, 2500, 3000];";

if (!source.includes(newDelays)) {
  if (!source.includes(oldDelays)) {
    throw new Error("Saved-items Clerk retry marker not found");
  }
  source = source.replace(oldDelays, newDelays);
}

if (!source.includes(newDelays)) {
  throw new Error("Saved-items authenticated loading retry was not applied");
}

writeFileSync(hookUrl, source, "utf8");
console.log("Shared saved-item loading now waits safely for the Clerk session before failing.");

await import("./patch-analytics-authenticated-loading.mjs");
