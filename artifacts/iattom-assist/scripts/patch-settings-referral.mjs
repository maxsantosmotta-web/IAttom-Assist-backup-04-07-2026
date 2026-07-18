import { readFileSync, writeFileSync } from "node:fs";

function patchFile(relativePath, replacements) {
  const path = new URL(relativePath, import.meta.url);
  let source = readFileSync(path, "utf8");
  for (const [before, after, required = false] of replacements) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) {
      if (required) throw new Error(`Required patch marker not found in ${relativePath}`);
      continue;
    }
    source = source.replaceAll(before, after);
  }
  writeFileSync(path, source);
}

patchFile("../src/pages/dashboard/Settings.tsx", [
  ['import { PLAN_CREDITS, PLAN_PRICES } from "@/lib/credits";', 'import { PLAN_CREDITS, PLAN_NAMES, PLAN_PRICES } from "@/lib/credits";'],
  ["const planInfo = PLAN_PRICES[plan];\n  const planCredits = PLAN_CREDITS[plan];", "const planInfo = PLAN_PRICES[plan] ?? PLAN_PRICES.free;\n  const planCredits = Number(PLAN_CREDITS[plan] ?? PLAN_CREDITS.free ?? 0) || 0;"],
  ["{me.credits.toLocaleString()}", "{(Number(me?.credits) || 0).toLocaleString()}"],
  ["{planInfo?.label ?? plan.toUpperCase()}", "{PLAN_NAMES[plan] ?? plan.toUpperCase()}"],
  ['{planInfo?.monthlyDisplay ?? "—"} — cobrado mensalmente', '{plan === "free" ? "Plano gratuito de demonstração" : (planInfo?.monthlyDisplay ?? "—") + " — cobrado mensalmente"}'],
]);

patchFile("../src/components/IAttomHelpPanel.tsx", [
  ['import { useUser } from "@clerk/react";', 'import { useUser } from "@clerk/react";\nimport { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";'],
  ["  const { user } = useUser();\n  const userId = user?.id;", "  const { user } = useUser();\n  const userId = user?.id;\n  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 60_000, enabled: !!userId } });\n  const isFreePlan = me?.plan === \"free\" && me?.planSelected === true;\n  const helpAccessLoading = !!userId && me === undefined;"],
  ["{usage !== null && (usage.limit === 0 || usage.remaining === 0) ? (", "{helpAccessLoading || isFreePlan || (usage !== null && (usage.limit === 0 || usage.remaining === 0)) ? ("],
  ['{usage.limit === 0\n                      ? "O IAttom Help não está disponível no plano gratuito."\n                      : "Limite de mensagens atingido para este ciclo."}', '{helpAccessLoading\n                      ? "Verificando disponibilidade do IAttom Help..."\n                      : isFreePlan || usage?.limit === 0\n                        ? "O IAttom Help não está disponível no plano gratuito."\n                        : "Limite de mensagens atingido para este ciclo."}'],
]);

patchFile("../src/components/layout/SidebarLayout.tsx", [
  ["  useSyncUser, useGetMe, getGetMeQueryKey,", "  useGetMe, getGetMeQueryKey,"],
  ["  const syncUser = useSyncUser({\n    mutation: {\n      onSuccess: () => {\n        // Invalidate both me and credits so the sidebar reflects real balance immediately after claim/sync.\n        void qc.invalidateQueries({ queryKey: getGetMeQueryKey() });\n        void qc.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });\n      },\n      onError: () => {\n        // Sync failure is non-blocking — sidebar may show stale data until next mount.\n      },\n    },\n  });\n", ""],
  ["  useEffect(() => {\n    if (isLoaded && isSignedIn && user) {\n      const email = user.primaryEmailAddress?.emailAddress;\n      const name = user.fullName ?? user.firstName ?? undefined;\n      if (email) syncUser.mutate({ data: { email, name } });\n    }\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [isLoaded, isSignedIn]);\n\n", ""],
]);

const referralBefore = [
  "  useEffect(() => {", "    setLoading(true);", "    (async () => {", "      try {", "        const token = await getToken();",
  "        const res = await fetch(`${basePath}/api/referral/my`, {", "          headers: { Authorization: `Bearer ${token}` },", "        });",
  "        if (res.ok) setData(await res.json());", "      } finally {", "        setLoading(false);", "      }", "    })();", "  }, [refreshTick, getToken]);",
].join("\n");
const referralAfter = [
  "  useEffect(() => {", "    const controller = new AbortController();", "    let cancelled = false;",
  "    const loadReferral = async (attempt = 0): Promise<void> => {", "      setLoading(true);", "      setLoadError(\"\");", "      try {",
  "        const res = await fetch(`${basePath}/api/referral/my`, { credentials: \"include\", signal: controller.signal });",
  "        const raw = await res.json().catch(() => null);", "        if (res.status === 429 && attempt < 2) {",
  "          await new Promise((resolve) => window.setTimeout(resolve, 900 * (attempt + 1)));", "          if (!cancelled) await loadReferral(attempt + 1);", "          return;", "        }",
  "        if (!res.ok || !raw?.code) throw new Error(raw?.error ?? `Não foi possível carregar as indicações (HTTP ${res.status}).`);",
  "        if (!cancelled) setData({", "          code: String(raw.code),", "          shareUrl: String(raw.shareUrl ?? `${window.location.origin}/sign-up?ref=${raw.code}`),",
  "          totalUses: Number(raw.totalUses) || 0,", "          creditsEarned: Number(raw.creditsEarned) || 0,", "          referrerBonus: Number(raw.referrerBonus) || 50,",
  "          referredBonus: Number(raw.referredBonus) || 25,", "          recentReferrals: Array.isArray(raw.recentReferrals) ? raw.recentReferrals.filter(Boolean) : [],", "        });",
  "      } catch (error) {", "        if (cancelled || (error instanceof DOMException && error.name === \"AbortError\")) return;", "        setData(null);",
  "        setLoadError(error instanceof Error ? error.message : \"Não foi possível carregar o código.\");", "      } finally {", "        if (!cancelled) setLoading(false);", "      }", "    };",
  "    void loadReferral();", "    return () => { cancelled = true; controller.abort(); };", "  }, [refreshTick]);",
].join("\n");

patchFile("../src/pages/dashboard/Referral.tsx", [
  ['import { useAuth } from "@clerk/react";', ""], ["  const { getToken } = useAuth();\n", ""],
  ["const [loading, setLoading] = useState(true);", "const [loading, setLoading] = useState(true);\n  const [loadError, setLoadError] = useState(\"\");"],
  [referralBefore, referralAfter],
  ["        const token = await getToken();\n      const res = await fetch(`${basePath}/api/referral/use`, {\n        method: \"POST\",\n        headers: { Authorization: `Bearer ${token}`, \"Content-Type\": \"application/json\" },", "      const res = await fetch(`${basePath}/api/referral/use`, {\n        method: \"POST\",\n        headers: { \"Content-Type\": \"application/json\" },\n        credentials: \"include\","],
  ['<span className="text-2xl font-mono font-bold text-primary tracking-widest">{data?.code ?? "Carregando..."}</span>', '<span className={`font-mono font-bold tracking-widest ${loadError ? "text-sm text-red-400" : "text-2xl text-primary"}`}>{data?.code ?? loadError ?? "Código indisponível"}</span>'],
  ["{data && data.recentReferrals.length > 0 && (", "{data && Array.isArray(data.recentReferrals) && data.recentReferrals.length > 0 && ("],
]);

patchFile("../src/pages/dashboard/Billing.tsx", [
  ["query: { queryKey: getGetStripePlansQueryKey(), retry: false, staleTime: 0 },", "query: { queryKey: getGetStripePlansQueryKey(), retry: 2, retryDelay: (attempt) => 800 * (attempt + 1), staleTime: 300_000, refetchOnMount: false },"],
  ["query: { queryKey: getGetStripeSubscriptionQueryKey(), retry: false, staleTime: 0 },", "query: { queryKey: getGetStripeSubscriptionQueryKey(), retry: 1, retryDelay: 800, staleTime: 60_000, enabled: me?.plan !== \"free\" },"],
  ["query: { queryKey: getGetCreditsBalanceQueryKey(), retry: false, staleTime: 0 },", "query: { queryKey: getGetCreditsBalanceQueryKey(), retry: 1, retryDelay: 800, staleTime: 60_000, enabled: !!me },"],
]);

patchFile("../src/components/PlanComparisonModal.tsx", [
  ["const sortedPlans  = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey));", "const sortedPlans = plans.filter((plan) => plan.planKey !== \"free\").sort((a, b) => PLAN_ORDER.indexOf(a.planKey) - PLAN_ORDER.indexOf(b.planKey));", true],
  ["{[0,1,2,3].map((i) => (", "{[0,1,2].map((i) => ("],
  ["grid-cols-2 lg:grid-cols-4 gap-4", "grid-cols-1 sm:grid-cols-3 gap-4"],
  ["grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", "grid-cols-1 sm:grid-cols-3 gap-4"],
]);

console.log("Validated runtime patches applied.");
