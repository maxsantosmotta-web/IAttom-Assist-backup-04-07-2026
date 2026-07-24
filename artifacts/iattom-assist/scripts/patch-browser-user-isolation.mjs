import fs from "node:fs";

const appPath = new URL("../src/App.tsx", import.meta.url);
let source = fs.readFileSync(appPath, "utf8");

source = source
  .replace(
    'import { useEffect, useRef, useState, lazy, Suspense } from "react";',
    'import { useEffect, useRef, useState, lazy, Suspense, type ReactNode } from "react";',
  )
  .replace(
    'import { ClerkProvider, Show, useClerk, AuthenticateWithRedirectCallback } from "@clerk/react";',
    'import { ClerkProvider, Show, useClerk, useUser, AuthenticateWithRedirectCallback } from "@clerk/react";',
  );

const oldBlock = `function ClerkQueryInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) qc.clear();
    prevUserIdRef.current = userId;
  }), [addListener, qc]);
  return null;
}`;

const previousPatchedBlockStart = 'const BROWSER_STATE_OWNER_KEY = "iattom_browser_owner_v1";';
const previousPatchedBlockEnd = '\n\nconst BLOCKED_MSG =';

const strongBlock = `const BROWSER_STATE_OWNER_KEY = "iattom_browser_owner_v1";

function clearUserScopedBrowserState(): void {
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
}

function BrowserUserBoundary({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const qc = useQueryClient();
  const [, forceRender] = useState(0);
  const userId = isLoaded && isSignedIn ? (user?.id ?? null) : null;

  let storedOwner: string | null = null;
  try { storedOwner = localStorage.getItem(BROWSER_STATE_OWNER_KEY); } catch { /* armazenamento indisponível */ }

  const ownerMatches = isLoaded && (userId ? storedOwner === userId : storedOwner === null);

  useEffect(() => {
    if (!isLoaded || ownerMatches) return;

    clearUserScopedBrowserState();
    try {
      if (userId) localStorage.setItem(BROWSER_STATE_OWNER_KEY, userId);
      else localStorage.removeItem(BROWSER_STATE_OWNER_KEY);
    } catch { /* armazenamento indisponível */ }

    qc.clear();
    forceRender((value) => value + 1);
  }, [isLoaded, ownerMatches, qc, userId]);

  if (!isLoaded || !ownerMatches) return <LoadingScreen />;
  return <>{children}</>;
}`;

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, strongBlock);
} else {
  const start = source.indexOf(previousPatchedBlockStart);
  const end = start === -1 ? -1 : source.indexOf(previousPatchedBlockEnd, start);
  if (start === -1 || end === -1) throw new Error("Clerk browser-state isolation marker not found");
  source = source.slice(0, start) + strongBlock + source.slice(end);
}

source = source.replace('      <ClerkQueryInvalidator />\n', "");
source = source.replace(
  '      <ErrorBoundary resetKey={location}><Switch>',
  '      <BrowserUserBoundary><ErrorBoundary resetKey={location}><Switch>',
);
source = source.replace(
  '      </Switch></ErrorBoundary>\n      <Toaster />',
  '      </Switch></ErrorBoundary></BrowserUserBoundary>\n      <Toaster />',
);

if (!source.includes("function BrowserUserBoundary") || !source.includes("<BrowserUserBoundary><ErrorBoundary")) {
  throw new Error("Browser user boundary was not installed");
}
if (source.includes("<ClerkQueryInvalidator />")) {
  throw new Error("Legacy post-mount user invalidator is still active");
}

fs.writeFileSync(appPath, source);
console.log("Dashboard mounting is blocked until browser state belongs to the authenticated account");
