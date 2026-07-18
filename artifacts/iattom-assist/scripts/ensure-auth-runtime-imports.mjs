import { readFileSync, writeFileSync } from "node:fs";

const appUrl = new URL("../src/App.tsx", import.meta.url);
let source = readFileSync(appUrl, "utf8");
let changed = false;

if (source.includes("useSyncUser()") && !source.includes("import { useSyncUser, getGetMeQueryKey } from \"@workspace/api-client-react\";")) {
  const marker = 'import { PlanGate } from "@/components/PlanGate";';
  if (!source.includes(marker)) throw new Error("PlanGate import marker not found while repairing auth runtime imports");
  source = source.replace(marker, `${marker}\nimport { useSyncUser, getGetMeQueryKey } from "@workspace/api-client-react";`);
  changed = true;
}

if (source.includes("useUser()") && !source.includes("useUser, AuthenticateWithRedirectCallback")) {
  const before = 'import { ClerkProvider, Show, useClerk, AuthenticateWithRedirectCallback } from "@clerk/react";';
  const after = 'import { ClerkProvider, Show, useClerk, useUser, AuthenticateWithRedirectCallback } from "@clerk/react";';
  if (!source.includes(before)) throw new Error("Clerk import marker not found while repairing auth runtime imports");
  source = source.replace(before, after);
  changed = true;
}

if (source.includes("useSyncUser()") && !source.includes("useSyncUser, getGetMeQueryKey")) {
  throw new Error("useSyncUser runtime import is still missing");
}
if (source.includes("useUser()") && !source.includes("useClerk, useUser")) {
  throw new Error("useUser runtime import is still missing");
}

if (changed) writeFileSync(appUrl, source);
console.log(changed ? "Auth runtime imports repaired and verified." : "Auth runtime imports already valid.");
