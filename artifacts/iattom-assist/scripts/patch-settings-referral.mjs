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
    "  const { user } = useUser();\n  const userId = user?.id;\n  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 0, enabled: !!userId } });\n  const isFreePlan = me?.plan === \"free\" && me?.planSelected === true;\n  const helpAccessLoading = !!userId && me === undefined;",
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
    `  useEffect(() => {\n    if (isLoaded && isSignedIn && user) {\n      const email = user.primaryEmailAddress?.emailAddress;\n      const name = user.fullName ?? user.firstName ?? undefined;\n      if (email) syncUser.mutate({ data: { email, name } });\n    }\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [isLoaded, isSignedIn]);`,
    `  useEffect(() => {\n    if (isLoaded && isSignedIn && user) {\n      const email = user.primaryEmailAddress?.emailAddress;\n      const name = user.fullName ?? user.firstName ?? undefined;\n      const syncKey = \`iattom_user_synced_\${user.id}\`;\n      if (!email || sessionStorage.getItem(syncKey) === \"1\") return;\n\n      sessionStorage.setItem(syncKey, \"1\");\n      syncUser.mutate(\n        { data: { email, name } },\n        { onError: () => sessionStorage.removeItem(syncKey) },\n      );\n    }\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [isLoaded, isSignedIn]);`,
  ],
  [
    `              {isActive && (\n                <motion.div\n                  layoutId="nav-active-pill"\n                  className="absolute inset-0 rounded-xl bg-primary/[0.10]"\n                  transition={{ type: "spring", stiffness: 420, damping: 38 }}\n                />\n              )}\n              <motion.div\n                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full bg-primary origin-center"\n                initial={false}\n                animate={{ height: isActive ? 20 : 0, opacity: isActive ? 1 : 0 }}\n                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}\n              />`,
    `              {isActive && (\n                <>\n                  <div className="absolute inset-0 rounded-xl bg-primary/[0.10]" />\n                  <div className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />\n                </>\n              )}`,
  ],
]);

patchFile("../src/pages/dashboard/Referral.tsx", [
  [
    "const [loading, setLoading] = useState(true);",
    "const [loading, setLoading] = useState(true);\n  const [loadError, setLoadError] = useState(\"\");",
  ],
  [
    "setLoading(true);\n    (async () => {\n      try {\n        const token = await getToken();\n        const res = await fetch(`${basePath}/api/referral/my`, {\n          headers: { Authorization: `Bearer ${token}` },\n        });\n        if (res.ok) setData(await res.json());\n      } finally {\n        setLoading(false);\n      }\n    })();",
    "setLoading(true);\n    setLoadError(\"\");\n    (async () => {\n      const controller = new AbortController();\n      const timeoutId = window.setTimeout(() => controller.abort(), 12000);\n      try {\n        const token = await getToken();\n        if (!token) throw new Error(\"Sessão não disponível\");\n        const res = await fetch(`${basePath}/api/referral/my`, {\n          headers: { Authorization: `Bearer ${token}` },\n          credentials: \"include\",\n          signal: controller.signal,\n        });\n        const raw = await res.json().catch(() => null);\n        if (!res.ok || !raw?.code) throw new Error(raw?.error ?? \"Código de indicação indisponível\");\n        setData({\n          code: String(raw.code),\n          shareUrl: String(raw.shareUrl ?? `${window.location.origin}/sign-up?ref=${raw.code}`),\n          totalUses: Number(raw.totalUses) || 0,\n          creditsEarned: Number(raw.creditsEarned) || 0,\n          referrerBonus: Number(raw.referrerBonus) || 50,\n          referredBonus: Number(raw.referredBonus) || 25,\n          recentReferrals: Array.isArray(raw.recentReferrals) ? raw.recentReferrals.filter(Boolean) : [],\n        });\n      } catch (error) {\n        setData(null);\n        setLoadError(error instanceof DOMException && error.name === \"AbortError\"\n          ? \"A solicitação demorou demais. Toque em Atualizar.\"\n          : (error instanceof Error ? error.message : \"Não foi possível carregar o código.\"));\n      } finally {\n        window.clearTimeout(timeoutId);\n        setLoading(false);\n      }\n    })();",
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

console.log("Settings FREE plan, stable user navigation, single-session user sync, IAttom Help access and referral runtime fixes applied.");