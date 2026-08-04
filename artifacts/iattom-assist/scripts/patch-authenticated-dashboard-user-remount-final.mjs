import fs from "node:fs";

const appPath = new URL("../src/App.tsx", import.meta.url);
let source = fs.readFileSync(appPath, "utf8");

source = source
  .replace(
    'import { useEffect, useRef, useState, lazy, Suspense } from "react";',
    'import { Fragment, useEffect, useRef, useState, lazy, Suspense, type ReactNode } from "react";',
  )
  .replace(
    'import { useEffect, useRef, useState, lazy, Suspense, type ReactNode } from "react";',
    'import { Fragment, useEffect, useRef, useState, lazy, Suspense, type ReactNode } from "react";',
  )
  .replace(
    'import { ClerkProvider, Show, useClerk, AuthenticateWithRedirectCallback } from "@clerk/react";',
    'import { ClerkProvider, Show, useClerk, useUser, AuthenticateWithRedirectCallback } from "@clerk/react";',
  );

const blockStart = 'const BROWSER_STATE_OWNER_KEY = "iattom_browser_owner_v1";';
const blockEnd = '\n\nconst BLOCKED_MSG =';
const start = source.indexOf(blockStart);
const end = start === -1 ? -1 : source.indexOf(blockEnd, start);

if (start === -1 || end === -1) {
  throw new Error("Final global browser isolation block was not found after frontend patches");
}

const globalBlock = `const BROWSER_STATE_OWNER_KEY = "iattom_browser_owner_v1";
const USER_SCOPED_INDEXED_DATABASES = ["iattom_assets_db"];

async function clearUserScopedBrowserState(): Promise<void> {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key): key is string => Boolean(key));
    for (const key of keys) {
      if (key.startsWith("iattom_") && key !== BROWSER_STATE_OWNER_KEY) localStorage.removeItem(key);
    }
  } catch { /* armazenamento indisponível */ }

  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
      .filter((key): key is string => Boolean(key));
    for (const key of keys) {
      if (key.startsWith("iattom_")) sessionStorage.removeItem(key);
    }
  } catch { /* armazenamento indisponível */ }

  if (typeof indexedDB !== "undefined") {
    await Promise.all(USER_SCOPED_INDEXED_DATABASES.map((databaseName) => new Promise<void>((resolve) => {
      try {
        const request = indexedDB.deleteDatabase(databaseName);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      } catch {
        resolve();
      }
    })));
  }
}

function BrowserUserBoundary({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const qc = useQueryClient();
  const userId = isLoaded && isSignedIn ? (user?.id ?? null) : null;
  const [readyOwner, setReadyOwner] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    void (async () => {
      let storedOwner: string | null = null;
      try { storedOwner = localStorage.getItem(BROWSER_STATE_OWNER_KEY); } catch { /* armazenamento indisponível */ }

      if (storedOwner !== userId) {
        await clearUserScopedBrowserState();
        try {
          if (userId) localStorage.setItem(BROWSER_STATE_OWNER_KEY, userId);
          else localStorage.removeItem(BROWSER_STATE_OWNER_KEY);
        } catch { /* armazenamento indisponível */ }
        qc.clear();
      }

      if (!cancelled) setReadyOwner(userId);
    })();

    return () => { cancelled = true; };
  }, [isLoaded, qc, userId]);

  if (!isLoaded || readyOwner !== userId) return <LoadingScreen />;
  return <Fragment key={userId ?? "signed-out"}>{children}</Fragment>;
}`;

source = source.slice(0, start) + globalBlock + source.slice(end);

if (!source.includes("<BrowserUserBoundary><ErrorBoundary")) {
  source = source.replace(
    '      <ErrorBoundary resetKey={location}><Switch>',
    '      <BrowserUserBoundary><ErrorBoundary resetKey={location}><Switch>',
  );
  source = source.replace(
    '      </Switch></ErrorBoundary>\n      <Toaster />',
    '      </Switch></ErrorBoundary></BrowserUserBoundary>\n      <Toaster />',
  );
}

for (const marker of [
  'USER_SCOPED_INDEXED_DATABASES = ["iattom_assets_db"]',
  'await clearUserScopedBrowserState();',
  'readyOwner !== userId',
  'return <Fragment key={userId ?? "signed-out"}>{children}</Fragment>;',
  '<BrowserUserBoundary><ErrorBoundary',
]) {
  if (!source.includes(marker)) throw new Error(`Final global user isolation marker missing: ${marker}`);
}

fs.writeFileSync(appPath, source, "utf8");
console.log("Global account switching now clears browser state and IndexedDB before remounting the authenticated tree.");

await import("./patch-canonical-image-library-endpoint.mjs");
await import("./patch-official-library-image-selection.mjs");

const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);
let activitySource = fs.readFileSync(activityPath, "utf8");
const activityActionAnchor = `    const actionChart = Object.entries(actionMap)\n      .filter(([, value]) => value > 0)`;
const activityActionFiltered = `    const actionChart = Object.entries(actionMap)\n      .filter(([label, value]) => value > 0 && !["Buscar Produtos", "Buscas de produtos executadas"].includes(label))`;
if (activitySource.includes(activityActionAnchor)) {
  activitySource = activitySource.replace(activityActionAnchor, activityActionFiltered);
} else if (!activitySource.includes('!["Buscar Produtos", "Buscas de produtos executadas"].includes(label)')) {
  throw new Error("Admin Activity action chart anchor not found");
}
fs.writeFileSync(activityPath, activitySource, "utf8");

const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
let analyticsSource = fs.readFileSync(analyticsPath, "utf8");
const analyticsFilterAnchor = `  const featureData = (analytics?.featureUsage ?? [])\n    .filter((f) => String(f.name ?? "").trim().toLowerCase() !== "prompt")`;
const analyticsFilterReplacement = `  const featureData = (analytics?.featureUsage ?? [])\n    .filter((f) => {\n      const key = String(f.name ?? "").trim().toLowerCase().replaceAll("_", " ");\n      return key !== "prompt" && key !== "find products" && key !== "validate products";\n    })`;
if (analyticsSource.includes(analyticsFilterAnchor)) {
  analyticsSource = analyticsSource.replace(analyticsFilterAnchor, analyticsFilterReplacement);
} else if (!analyticsSource.includes('key !== "find products" && key !== "validate products"')) {
  throw new Error("Admin Analytics feature filter anchor not found");
}
fs.writeFileSync(analyticsPath, analyticsSource, "utf8");

const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
let overviewSource = fs.readFileSync(overviewPath, "utf8");
const overviewAnchor = `  const featureDonut = (analytics?.featureUsage ?? []).slice(0, 8).map((item, index) => ({`;
const overviewReplacement = `  const featureDonut = (analytics?.featureUsage ?? [])\n    .filter((item) => {\n      const key = String(item.name ?? "").trim().toLowerCase().replaceAll("_", " ");\n      return key !== "find products" && key !== "validate products";\n    })\n    .slice(0, 8)\n    .map((item, index) => ({`;
if (overviewSource.includes(overviewAnchor)) {
  overviewSource = overviewSource.replace(overviewAnchor, overviewReplacement);
} else if (!overviewSource.includes('key !== "find products" && key !== "validate products"')) {
  throw new Error("Admin Overview feature chart anchor not found");
}
fs.writeFileSync(overviewPath, overviewSource, "utf8");

for (const [name, content, markers] of [
  ["AdminActivity", activitySource, ['!["Buscar Produtos", "Buscas de produtos executadas"].includes(label)']],
  ["AdminAnalytics", analyticsSource, ['key !== "find products" && key !== "validate products"']],
  ["AdminOverview", overviewSource, ['key !== "find products" && key !== "validate products"']],
]) {
  for (const marker of markers) {
    if (!content.includes(marker)) throw new Error(`${name} legacy product chart marker missing: ${marker}`);
  }
}

console.log("Legacy product chart blocks are excluded only from the requested ADM charts.");
