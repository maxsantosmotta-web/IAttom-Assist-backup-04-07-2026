import fs from "node:fs";

const appPath = new URL("../src/App.tsx", import.meta.url);
let source = fs.readFileSync(appPath, "utf8");

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

const newBlock = `const BROWSER_STATE_OWNER_KEY = "iattom_browser_owner_v1";

function clearUserScopedBrowserState(): void {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key): key is string => Boolean(key));
    for (const key of keys) {
      if (key.startsWith("iattom_") && key !== BROWSER_STATE_OWNER_KEY) {
        localStorage.removeItem(key);
      }
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

function ClerkQueryInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    let storedOwner: string | null = null;
    try {
      storedOwner = localStorage.getItem(BROWSER_STATE_OWNER_KEY);
    } catch { /* armazenamento indisponível */ }

    // Sem proprietário gravado também é tratado como migração insegura:
    // limpa estados antigos uma única vez antes de vincular este navegador à conta atual.
    if (userId && storedOwner !== userId) {
      clearUserScopedBrowserState();
      try { localStorage.setItem(BROWSER_STATE_OWNER_KEY, userId); } catch { /* ignore */ }
      qc.clear();
    } else if (!userId && storedOwner) {
      clearUserScopedBrowserState();
      try { localStorage.removeItem(BROWSER_STATE_OWNER_KEY); } catch { /* ignore */ }
      qc.clear();
    } else if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      qc.clear();
    }

    prevUserIdRef.current = userId;
  }), [addListener, qc]);

  return null;
}`;

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
} else if (!source.includes("BROWSER_STATE_OWNER_KEY") || !source.includes("clearUserScopedBrowserState")) {
  throw new Error("Clerk browser-state isolation marker not found");
}

fs.writeFileSync(appPath, source);
console.log("Browser state is isolated and cleared whenever the authenticated account changes");
