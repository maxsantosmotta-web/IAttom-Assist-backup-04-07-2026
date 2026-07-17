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
    "const planInfo = PLAN_PRICES[plan] ?? PLAN_PRICES.free;\n  const planCredits = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free ?? 0;",
    "const planInfo = PLAN_PRICES[plan] ?? PLAN_PRICES.free;\n  const planCredits = Number(PLAN_CREDITS[plan] ?? PLAN_CREDITS.free ?? 0) || 0;",
  ],
  [
    "{me.credits.toLocaleString()}",
    "{(Number(me?.credits) || 0).toLocaleString()}",
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

console.log("Settings and referral runtime fixes applied.");