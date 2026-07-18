import { readFileSync, writeFileSync } from "node:fs";

const appUrl = new URL("../src/App.tsx", import.meta.url);
let source = readFileSync(appUrl, "utf8");
let changed = false;

const apiNamespaceImport = 'import * as AuthApi from "@workspace/api-client-react";';
if (source.includes("function UserBootstrap") && !source.includes(apiNamespaceImport)) {
  const marker = 'import { PlanGate } from "@/components/PlanGate";';
  if (!source.includes(marker)) throw new Error("PlanGate import marker not found while binding auth bootstrap API");
  source = source.replace(marker, `${marker}\n${apiNamespaceImport}`);
  changed = true;
}

if (source.includes("const syncUser = useSyncUser();")) {
  source = source.replace("const syncUser = useSyncUser();", "const syncUser = AuthApi.useSyncUser();");
  changed = true;
}

if (source.includes("queryKey: getGetMeQueryKey()")) {
  source = source.replaceAll("queryKey: getGetMeQueryKey()", "queryKey: AuthApi.getGetMeQueryKey()");
  changed = true;
}

if (source.includes("useUser()") && !source.includes("useUser, AuthenticateWithRedirectCallback")) {
  const before = 'import { ClerkProvider, Show, useClerk, AuthenticateWithRedirectCallback } from "@clerk/react";';
  const after = 'import { ClerkProvider, Show, useClerk, useUser, AuthenticateWithRedirectCallback } from "@clerk/react";';
  if (!source.includes(before)) throw new Error("Clerk import marker not found while repairing auth runtime imports");
  source = source.replace(before, after);
  changed = true;
}

if (source.includes("function UserBootstrap") && !source.includes("AuthApi.useSyncUser()")) {
  throw new Error("UserBootstrap is not bound to AuthApi.useSyncUser");
}
if (source.includes("function UserBootstrap") && !source.includes(apiNamespaceImport)) {
  throw new Error("AuthApi namespace import is missing");
}
if (source.includes("useUser()") && !source.includes("useClerk, useUser")) {
  throw new Error("useUser runtime import is still missing");
}
if (/\buseSyncUser\s*\(\)/.test(source)) {
  throw new Error("Unbound useSyncUser call remains in App.tsx");
}

if (changed) writeFileSync(appUrl, source);
console.log(changed ? "Auth bootstrap API binding repaired and verified." : "Auth bootstrap API binding already valid.");
