import fs from "node:fs";

const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);
const translationsPath = new URL("../src/lib/eventTranslations.ts", import.meta.url);

let overview = fs.readFileSync(overviewPath, "utf8");
let analytics = fs.readFileSync(analyticsPath, "utf8");
let activity = fs.readFileSync(activityPath, "utf8");
let translations = fs.readFileSync(translationsPath, "utf8");

for (const [from, to] of [
  ['Creative: "Criar Imagem e Vídeo"', 'Creative: "Gerar Imagem"'],
  ['creative: "Criar Imagem e Vídeo"', 'creative: "Gerar Imagem"'],
  ['Creative: "Criativos"', 'Creative: "Gerar Imagem"'],
  ['creative: "Criativo"', 'creative: "Gerar Imagem"'],
]) {
  overview = overview.replaceAll(from, to);
  analytics = analytics.replaceAll(from, to);
  translations = translations.replaceAll(from, to);
}

for (const sourceName of ["overview", "analytics"]) {
  let source = sourceName === "overview" ? overview : analytics;
  if (!source.includes('"Video Effect": "Vídeo com Efeito"')) {
    source = source.replace('"Video Script": "Scripts de Vídeo",', '"Video Script": "Scripts de Vídeo",\n  "Video Effect": "Vídeo com Efeito",');
  }
  if (sourceName === "overview") overview = source; else analytics = source;
}

translations = translations
  .replaceAll('creative: "Criar Imagem e Vídeo"', 'creative: "Gerar Imagem"')
  .replaceAll('Creative: "Criar Imagem e Vídeo"', 'Creative: "Gerar Imagem"');
if (!translations.includes('video_effect: "Vídeo com Efeito"')) {
  translations = translations.replace('video_script: "Scripts de Vídeo",', 'video_script: "Scripts de Vídeo",\n  video_effect: "Vídeo com Efeito",');
}

if (!activity.includes("mediaAnalytics")) {
  activity = activity.replace('import { useMemo } from "react";', 'import { useEffect, useMemo, useState } from "react";');
  activity = activity.replace(
    "  const { toast } = useToast();",
    `  const { toast } = useToast();
  const [mediaAnalytics, setMediaAnalytics] = useState<Array<{ name: string; count: number }>>([]);`,
  );
  activity = activity.replace(
    "  const items = activity ?? [];",
    `  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const response = await fetch(\`${"${BASE}"}/api/admin/analytics?refresh=\${Date.now()}\`, {
          headers: token ? { Authorization: \`Bearer \${token}\` } : {},
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json() as { featureUsage?: Array<{ name: string; count: number }> };
        if (!cancelled) setMediaAnalytics(data.featureUsage ?? []);
      } catch {
        if (!cancelled) setMediaAnalytics([]);
      }
    })();
    return () => { cancelled = true; };
  }, [getToken, isFetching]);

  const items = activity ?? [];`,
  );
}

if (!activity.includes("canonicalMediaCounts")) {
  activity = activity.replace(
    "    const moduleMap: Record<string, { count: number; rawKey: string }> = {};",
    `    const canonicalMediaCounts = new Map(
      mediaAnalytics.map((item) => [item.name.toLowerCase().replaceAll(" ", "_"), Number(item.count ?? 0)]),
    );
    const moduleMap: Record<string, { count: number; rawKey: string }> = {};`,
  );
  activity = activity.replace(
    "    const moduleChart = Object.entries(moduleMap)",
    `    if (canonicalMediaCounts.has("creative")) moduleMap.creative = { count: canonicalMediaCounts.get("creative") ?? 0, rawKey: "creative" };
    if (canonicalMediaCounts.has("video_effect")) moduleMap.video_effect = { count: canonicalMediaCounts.get("video_effect") ?? 0, rawKey: "video_effect" };
    const moduleChart = Object.entries(moduleMap)`,
  );
  activity = activity.replace(
    "    const actionChart = Object.entries(actionMap)",
    `    for (const key of ["Criativos Gerados", "Imagens e vídeos criados", "Imagens geradas", "Gerar Imagem", "Vídeo com Efeito"]) delete actionMap[key];
    if (canonicalMediaCounts.has("creative")) actionMap["Gerar Imagem"] = canonicalMediaCounts.get("creative") ?? 0;
    if (canonicalMediaCounts.has("video_effect")) actionMap["Vídeo com Efeito"] = canonicalMediaCounts.get("video_effect") ?? 0;
    const actionChart = Object.entries(actionMap)`,
  );
  activity = activity.replace("  }, [items]);", "  }, [items, mediaAnalytics]);
}

for (const fileName of ["overview", "analytics"]) {
  let source = fileName === "overview" ? overview : analytics;
  source = source.replaceAll('return "Imagens e vídeos criados"', 'return "Gerar Imagem"');
  source = source.replaceAll('return "Criativos Gerados"', 'return "Gerar Imagem"');
  source = source.replaceAll('if (/discover|descoberta/i.test(base))', 'if (/find.?products|product.*discover|discover|descoberta|buscar.*produto/i.test(base))');
  if (fileName === "overview") overview = source; else analytics = source;
}

for (const marker of ["Gerar Imagem", "Vídeo com Efeito", "canonicalMediaCounts", "mediaAnalytics"]) {
  if (!overview.includes(marker) && !analytics.includes(marker) && !activity.includes(marker) && !translations.includes(marker)) {
    throw new Error(`Canonical media marker missing: ${marker}`);
  }
}

fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(analyticsPath, analytics);
fs.writeFileSync(activityPath, activity);
fs.writeFileSync(translationsPath, translations);
console.log("Admin media charts now subtract Vídeo com Efeito from Gerar Imagem and use the same canonical counts.");
