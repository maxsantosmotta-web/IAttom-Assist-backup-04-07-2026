import { readFileSync, writeFileSync } from "node:fs";

function patchFile(relativePath, replacements) {
  const path = new URL(relativePath, import.meta.url);
  let source = readFileSync(path, "utf8");

  for (const [before, after] of replacements) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) {
      console.warn(`Skipping patch already absent from ${relativePath}: ${before}`);
      continue;
    }
    source = source.replaceAll(before, after);
  }

  writeFileSync(path, source);
}

patchFile("../src/pages/dashboard/Settings.tsx", [
  [
    'import { PLAN_CREDITS, PLAN_PRICES } from "@/lib/credits";',
    'import { PLAN_CREDITS, PLAN_NAMES, PLAN_PRICES } from "@/lib/credits";',
  ],
  [
    "const planInfo = PLAN_PRICES[plan];\n  const planCredits = PLAN_CREDITS[plan];",
    "const planInfo = PLAN_PRICES[plan] ?? PLAN_PRICES.free;\n  const planCredits = Number(PLAN_CREDITS[plan] ?? PLAN_CREDITS.free ?? 0) || 0;",
  ],
  [
    "const planInfo = PLAN_PRICES[plan] ?? PLAN_PRICES.free;\n  const planCredits = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free ?? 0;",
    "const planInfo = PLAN_PRICES[plan] ?? PLAN_PRICES.free;\n  const planCredits = Number(PLAN_CREDITS[plan] ?? PLAN_CREDITS.free ?? 0) || 0;",
  ],
  [
    "{me.credits.toLocaleString()}",
    "{(Number(me?.credits) || 0).toLocaleString()}",
  ],
  [
    "{planInfo?.label ?? plan.toUpperCase()}",
    "{PLAN_NAMES[plan] ?? plan.toUpperCase()}",
  ],
  [
    '{planInfo?.monthlyDisplay ?? "—"} — cobrado mensalmente',
    '{plan === "free" ? "Plano gratuito de demonstração" : (planInfo?.monthlyDisplay ?? "—") + " — cobrado mensalmente"}',
  ],
]);

patchFile("../src/components/IAttomHelpPanel.tsx", [
  [
    'import { useUser } from "@clerk/react";',
    'import { useUser } from "@clerk/react";\nimport { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";',
  ],
  [
    "  const { user } = useUser();\n  const userId = user?.id;",
    "  const { user } = useUser();\n  const userId = user?.id;\n  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000, enabled: !!userId } });\n  const isFreePlan = me?.plan === \"free\" && me?.planSelected === true;\n  const helpAccessLoading = !!userId && me === undefined;",
  ],
  [
    "{usage !== null && (usage.limit === 0 || usage.remaining === 0) ? (",
    "{helpAccessLoading || isFreePlan || (usage !== null && (usage.limit === 0 || usage.remaining === 0)) ? (",
  ],
  [
    "{usage.limit === 0\n                      ? \"O IAttom Help não está disponível no plano gratuito.\"\n                      : \"Limite de mensagens atingido para este ciclo.\"}",
    "{helpAccessLoading\n                      ? \"Verificando disponibilidade do IAttom Help...\"\n                      : isFreePlan || usage?.limit === 0\n                        ? \"O IAttom Help não está disponível no plano gratuito.\"\n                        : \"Limite de mensagens atingido para este ciclo.\"}",
  ],
]);

patchFile("../src/components/layout/SidebarLayout.tsx", [
  [
    "  useSyncUser, useGetMe, getGetMeQueryKey,",
    "  useGetMe, getGetMeQueryKey,",
  ],
  [
`  const syncUser = useSyncUser({
    mutation: {
      onSuccess: () => {
        // Invalidate both me and credits so the sidebar reflects real balance immediately after claim/sync.
        void qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });
      },
      onError: () => {
        // Sync failure is non-blocking — sidebar may show stale data until next mount.
      },
    },
  });
`,
    "",
  ],
  [
`  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress;
      const name = user.fullName ?? user.firstName ?? undefined;
      if (email) syncUser.mutate({ data: { email, name } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

`,
    "",
  ],
]);

patchFile("../src/pages/dashboard/Referral.tsx", [
  [
    'import { useAuth } from "@clerk/react";',
    "",
  ],
  [
    "  const { getToken } = useAuth();\n",
    "",
  ],
  [
    "const [loading, setLoading] = useState(true);",
    "const [loading, setLoading] = useState(true);\n  const [loadError, setLoadError] = useState(\"\");",
  ],
  [
`  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${basePath}/api/referral/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshTick, getToken]);`,
`  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const loadReferral = async (attempt = 0): Promise<void> => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await fetch(`${basePath}/api/referral/my`, {
          credentials: "include",
          signal: controller.signal,
        });
        const raw = await res.json().catch(() => null);

        if (res.status === 429 && attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 900 * (attempt + 1)));
          if (!cancelled) await loadReferral(attempt + 1);
          return;
        }

        if (!res.ok || !raw?.code) {
          throw new Error(raw?.error ?? `Não foi possível carregar as indicações (HTTP ${res.status}).`);
        }

        if (!cancelled) {
          setData({
            code: String(raw.code),
            shareUrl: String(raw.shareUrl ?? `${window.location.origin}/sign-up?ref=${raw.code}`),
            totalUses: Number(raw.totalUses) || 0,
            creditsEarned: Number(raw.creditsEarned) || 0,
            referrerBonus: Number(raw.referrerBonus) || 50,
            referredBonus: Number(raw.referredBonus) || 25,
            recentReferrals: Array.isArray(raw.recentReferrals) ? raw.recentReferrals.filter(Boolean) : [],
          });
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        setData(null);
        setLoadError(error instanceof Error ? error.message : "Não foi possível carregar o código.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadReferral();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refreshTick]);`,
  ],
  [
`        const token = await getToken();
      const res = await fetch(`${basePath}/api/referral/use`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },`,
`      const res = await fetch(`${basePath}/api/referral/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",`,
  ],
  [
    "<span className=\"text-2xl font-mono font-bold text-primary tracking-widest\">{data?.code ?? \"Carregando...\"}</span>",
    "<span className={`font-mono font-bold tracking-widest ${loadError ? \"text-sm text-red-400\" : \"text-2xl text-primary\"}`}>{data?.code ?? loadError ?? \"Código indisponível\"}</span>",
  ],
  [
    "onClick={copyCode}\n                className=\"ml-auto p-1.5 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-white/[0.06] transition-colors\"",
    "onClick={copyCode}\n                disabled={!data}\n                className=\"ml-auto p-1.5 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed\"",
  ],
  [
    "onClick={copyLink}\n              className=\"bg-primary text-black hover:bg-primary/90 font-semibold px-5 gap-2 shrink-0\"",
    "onClick={copyLink}\n              disabled={!data}\n              className=\"bg-primary text-black hover:bg-primary/90 font-semibold px-5 gap-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed\"",
  ],
  [
    "{data && data.recentReferrals.length > 0 && (",
    "{data && Array.isArray(data.recentReferrals) && data.recentReferrals.length > 0 && (",
  ],
]);

patchFile("../src/pages/dashboard/Billing.tsx", [
  [
    "query: { queryKey: getGetStripePlansQueryKey(), retry: false, staleTime: 0 },",
    "query: { queryKey: getGetStripePlansQueryKey(), retry: 2, retryDelay: (attempt) => 800 * (attempt + 1), staleTime: 300_000, refetchOnMount: false },",
  ],
  [
    "query: { queryKey: getGetStripeSubscriptionQueryKey(), retry: false, staleTime: 0 },",
    "query: { queryKey: getGetStripeSubscriptionQueryKey(), retry: 1, retryDelay: 800, staleTime: 60_000, enabled: me?.plan !== \"free\" },",
  ],
  [
    "const { data: me, isFetching: fetchingMe, refetch: refetchMe } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 0 } });",
    "const { data: me, isFetching: fetchingMe, refetch: refetchMe } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: 1, staleTime: 60_000 } });",
  ],
  [
    "query: { queryKey: getGetCreditsBalanceQueryKey(), retry: false, staleTime: 0 },",
    "query: { queryKey: getGetCreditsBalanceQueryKey(), retry: 1, retryDelay: 800, staleTime: 60_000, enabled: !!me },",
  ],
]);

patchFile("../src/components/PlanComparisonModal.tsx", [
  [
    "const sortedPlans  = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey));",
    "const sortedPlans = plans\n    .filter((plan) => plan.planKey !== \"free\")\n    .sort((a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey));",
  ],
  [
    '<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">',
    '<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">',
  ],
  [
    "{[0,1,2,3].map((i) => (",
    "{[0,1,2].map((i) => (",
  ],
  [
    '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">',
    '<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">',
  ],
]);

console.log("Rapid navigation request pressure, referral retry, billing cache and upgrade modal fixes applied.");