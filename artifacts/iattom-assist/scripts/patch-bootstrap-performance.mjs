import { readFileSync, writeFileSync } from "node:fs";

const appUrl = new URL("../src/App.tsx", import.meta.url);
let source = readFileSync(appUrl, "utf8");

const before = `function UserBootstrap({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const syncUser = useSyncUser();
  const syncedUserIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "syncing" | "ready" | "error">("idle");
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (syncedUserIdRef.current === user.id) {
      setStatus("ready");
      return;
    }

    const email = user.primaryEmailAddress?.emailAddress?.trim();
    if (!email) {
      setSyncError("Não foi possível identificar o e-mail da conta.");
      setStatus("error");
      return;
    }

    let cancelled = false;
    setStatus("syncing");
    setSyncError("");

    syncUser.mutateAsync({
      data: {
        email,
        name: user.fullName ?? user.firstName ?? undefined,
      },
    }).then(async () => {
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      if (!cancelled) {
        syncedUserIdRef.current = user.id;
        setStatus("ready");
      }
    }).catch((error: unknown) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : "Não foi possível sincronizar sua conta.";
      setSyncError(message);
      setStatus("error");
    });

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, user?.id]);

  if (!isLoaded || (isSignedIn && status !== "ready")) {
    if (status === "error") {
      return <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a] px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm font-semibold text-white">Não foi possível preparar sua conta</p>
          <p className="mt-2 text-xs text-zinc-500">{syncError}</p>
          <button type="button" onClick={() => { syncedUserIdRef.current = null; setStatus("idle"); window.location.reload(); }} className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300">Tentar novamente</button>
        </div>
      </div>;
    }
    return <div className="min-h-[100dvh] bg-[#0a0a0a]" />;
  }

  return <>{children}</>;
}`;

const after = `function UserBootstrap({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const syncUser = useSyncUser();
  const syncedUserIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "syncing" | "ready" | "error">("idle");
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const syncKey = \`iattom_bootstrap_synced_\${user.id}\`;
    if (syncedUserIdRef.current === user.id || sessionStorage.getItem(syncKey) === "1") {
      syncedUserIdRef.current = user.id;
      setStatus("ready");
      return;
    }

    const email = user.primaryEmailAddress?.emailAddress?.trim();
    if (!email) {
      setSyncError("Não foi possível identificar o e-mail da conta.");
      setStatus("error");
      return;
    }

    let cancelled = false;
    setStatus("syncing");
    setSyncError("");

    syncUser.mutateAsync({
      data: {
        email,
        name: user.fullName ?? user.firstName ?? undefined,
      },
    }).then(async () => {
      sessionStorage.setItem(syncKey, "1");
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      if (!cancelled) {
        syncedUserIdRef.current = user.id;
        setStatus("ready");
      }
    }).catch((error: unknown) => {
      sessionStorage.removeItem(syncKey);
      if (cancelled) return;
      const message = error instanceof Error ? error.message : "Não foi possível sincronizar sua conta.";
      setSyncError(message);
      setStatus("error");
    });

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, user?.id]);

  if (!isLoaded || (isSignedIn && status !== "ready")) {
    if (status === "error") {
      return <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a] px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm font-semibold text-white">Não foi possível preparar sua conta</p>
          <p className="mt-2 text-xs text-zinc-500">{syncError}</p>
          <button type="button" onClick={() => { if (user) sessionStorage.removeItem(\`iattom_bootstrap_synced_\${user.id}\`); syncedUserIdRef.current = null; setStatus("idle"); window.location.reload(); }} className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300">Tentar novamente</button>
        </div>
      </div>;
    }
    return <div className="min-h-[100dvh] bg-[#0a0a0a]" />;
  }

  return <>{children}</>;
}`;

if (source.includes(after)) {
  console.log("Dashboard bootstrap performance patch already applied.");
} else if (source.includes(before)) {
  source = source.replace(before, after);
  writeFileSync(appUrl, source);
  console.log("Dashboard bootstrap now reuses the verified session sync.");
} else {
  throw new Error("Dashboard bootstrap performance marker was not found");
}
