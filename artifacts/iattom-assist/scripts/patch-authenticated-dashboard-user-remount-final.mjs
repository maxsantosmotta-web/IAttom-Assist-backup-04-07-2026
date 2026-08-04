import fs from "node:fs";

const appPath = new URL("../src/App.tsx", import.meta.url);
let source = fs.readFileSync(appPath, "utf8");

if (!source.includes('useAuth')) {
  const clerkImport = 'import { ClerkProvider, Show, useClerk, AuthenticateWithRedirectCallback } from "@clerk/react";';
  const clerkImportWithAuth = 'import { ClerkProvider, Show, useClerk, useAuth, AuthenticateWithRedirectCallback } from "@clerk/react";';
  if (!source.includes(clerkImport)) throw new Error("Final dashboard user remount Clerk import marker not found");
  source = source.replace(clerkImport, clerkImportWithAuth);
}

const dashboardStart = `function ProtectedDashboard() {
  return <>`;
const dashboardStartPatched = `function ProtectedDashboard() {
  const { isLoaded, userId } = useAuth();
  if (!isLoaded || !userId) return <LoadingScreen />;
  return <div key={userId}>`;

if (!source.includes("const { isLoaded, userId } = useAuth();")) {
  if (!source.includes(dashboardStart)) throw new Error("Final ProtectedDashboard start marker not found");
  source = source.replace(dashboardStart, dashboardStartPatched);
}

const dashboardEnd = `  </>;
}

function ProtectedAdmin()`;
const dashboardEndPatched = `  </div>;
}

function ProtectedAdmin()`;

if (!source.includes("return <div key={userId}>")) {
  throw new Error("Final dashboard keyed remount start was not installed");
}

if (source.includes(dashboardEnd)) {
  source = source.replace(dashboardEnd, dashboardEndPatched);
} else if (!source.includes(`  </div>;
}

function ProtectedAdmin()`)) {
  throw new Error("Final ProtectedDashboard end marker not found");
}

for (const marker of [
  'useAuth, AuthenticateWithRedirectCallback',
  'const { isLoaded, userId } = useAuth();',
  'if (!isLoaded || !userId) return <LoadingScreen />;',
  'return <div key={userId}>',
]) {
  if (!source.includes(marker)) throw new Error(`Final dashboard user remount marker missing: ${marker}`);
}

fs.writeFileSync(appPath, source, "utf8");
console.log("Authenticated dashboard now mounts only with the real Clerk user and remounts on account change.");
