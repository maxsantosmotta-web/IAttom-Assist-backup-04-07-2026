import { readFileSync, writeFileSync } from "node:fs";

const helpUrl = new URL("../src/components/IAttomHelpPanel.tsx", import.meta.url);
const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);

let help = readFileSync(helpUrl, "utf8");
let credits = readFileSync(creditsUrl, "utf8");

function removeFunctionByMarker(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return source;

  const lineStart = source.lastIndexOf("\n", markerIndex) + 1;
  const bodyStart = source.indexOf("{", markerIndex);
  if (bodyStart < 0) return source;

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        while (source[end] === ";" || source[end] === "\r" || source[end] === "\n") end += 1;
        return source.slice(0, lineStart) + source.slice(end);
      }
    }
  }

  throw new Error(`Unable to remove function block: ${marker}`);
}

function removeJsxCardContaining(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return source;

  const prefix = source.slice(0, markerIndex);
  const openings = [...prefix.matchAll(/<Card\b(?!Content)[^>]*>/g)];
  const opening = openings.at(-1);
  if (!opening || opening.index === undefined) {
    throw new Error(`Unable to locate Credits card containing: ${marker}`);
  }

  const start = opening.index;
  const tokenPattern = /<\/?Card\b(?!Content)[^>]*>/g;
  tokenPattern.lastIndex = start;
  let depth = 0;
  let token;

  while ((token = tokenPattern.exec(source)) !== null) {
    const value = token[0];
    if (value.startsWith("</")) depth -= 1;
    else if (!value.endsWith("/>")) depth += 1;

    if (depth === 0) {
      let end = tokenPattern.lastIndex;
      while (source[end] === "\r" || source[end] === "\n" || source[end] === " ") end += 1;
      return source.slice(0, start) + source.slice(end);
    }
  }

  throw new Error(`Unable to close Credits card containing: ${marker}`);
}

// Remove o cartão inteiro do IAttom Help no módulo Créditos do usuário.
// Não altera o painel Help, o histórico, a cobrança geral nem o ADM.
while (credits.includes("IAttom Help")) {
  credits = removeJsxCardContaining(credits, "IAttom Help");
}

// Remove estados e função exclusivos do contador antigo do Help.
credits = credits
  .replace(/\n\s*const\s*\[\s*helpUsed\s*,\s*setHelpUsed\s*\]\s*=\s*useState(?:<[^>]*>)?\([^;]*\);?/g, "")
  .replace(/\n\s*const\s*\[\s*helpLoading\s*,\s*setHelpLoading\s*\]\s*=\s*useState(?:<[^>]*>)?\([^;]*\);?/g, "")
  .replace(/\n\s*const\s*\{[^}]*helpUsageData[^}]*\}\s*=\s*useQuery\([\s\S]*?\n\s*\}\);?/g, "")
  .replace(/\s*,?\s*HelpCircle\s*,?/g, ", ")
  .replace(/,\s*,/g, ",");

credits = removeFunctionByMarker(credits, "const loadHelpUsage = async");

// Converte qualquer carga coordenada antiga em carga exclusiva do vídeo.
credits = credits
  .replace(
    /const \[videoOk, helpOk\] = await Promise\.all\(\[\s*loadVideoBalance\([^)]*\),\s*loadHelpUsage\([^)]*\),\s*\]\);/g,
    "const videoOk = await loadVideoBalance();",
  )
  .replace(/\(videoOk && helpOk\)/g, "videoOk")
  .replace(/\n\s*if \(!helpOk\) void loadHelpUsage\([^)]*\);/g, "")
  .replace(/void loadVideoBalance\([^)]*\);\s*void loadHelpUsage\([^)]*\);/g, "void loadVideoBalance();")
  .replace(/\n\s*void loadHelpUsage\([^)]*\);/g, "");

// Mantém somente uma leitura adicional no módulo: saldo de vídeos.
const oldVideoLoader = `  const loadVideoBalance = async () => {
    setVideoLoading(true);
    try {
      const response = await fetch("/api/videos/balance", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("video balance request failed");
      const video = await response.json() as { videoBalance?: number };
      setVideoBalance(Number(video.videoBalance ?? 0));
    } catch {
      // Mantém o último saldo válido em falhas temporárias.
    } finally {
      setVideoLoading(false);
    }
  };`;

const isolatedVideoLoader = `  const loadVideoBalance = async (signal?: AbortSignal): Promise<boolean> => {
    setVideoLoading(true);
    try {
      const response = await fetch("/api/videos/balance", { credentials: "include", cache: "no-store", signal });
      if (!response.ok) throw new Error("video balance request failed");
      const video = await response.json() as { videoBalance?: number };
      setVideoBalance(Number(video.videoBalance ?? 0));
      return true;
    } catch {
      return false;
    } finally {
      if (!signal?.aborted) setVideoLoading(false);
    }
  };`;

if (credits.includes(oldVideoLoader)) {
  credits = credits.replace(oldVideoLoader, isolatedVideoLoader);
}

const simpleVideoEntry = `  useEffect(() => {
    void loadVideoBalance();
  }, []);`;
const isolatedVideoEntry = `  useEffect(() => {
    const controller = new AbortController();
    void loadVideoBalance(controller.signal);
    return () => controller.abort("credits-unmounted");
  }, []);`;

if (credits.includes(simpleVideoEntry)) {
  credits = credits.replace(simpleVideoEntry, isolatedVideoEntry);
}

// Remove recuperação coordenada antiga com retry/timer e instala uma única
// carga de vídeo por entrada no módulo.
credits = credits.replace(
  /  useEffect\(\(\) => \{\n\s*let cancelled = false;[\s\S]*?const loadOnEntry = async \(\) => \{[\s\S]*?const videoOk = await loadVideoBalance\(\);[\s\S]*?\n\s*};\n[\s\S]*?return \(\) => \{[\s\S]*?\n\s*};\n\s*}, \[\]\);/g,
  isolatedVideoEntry,
);

// O Help continua invalidando apenas o saldo geral e o histórico após uso.
if (!help.includes('import { useQueryClient } from "@tanstack/react-query";')) {
  help = help.replace(
    'import { useUser } from "@clerk/react";',
    'import { useUser } from "@clerk/react";\nimport { useQueryClient } from "@tanstack/react-query";\nimport { getGetCreditsBalanceQueryKey, getListCreditTransactionsQueryKey } from "@workspace/api-client-react";',
  );
}

const userMarker = `  const { user } = useUser();\n  const userId = user?.id;`;
const queryClientBlock = `  const { user } = useUser();\n  const userId = user?.id;\n  const queryClient = useQueryClient();`;
if (help.includes(userMarker) && !help.includes("const queryClient = useQueryClient();")) {
  help = help.replace(userMarker, queryClientBlock);
}

const finallyMarker = `        fetchUsage();\n      }\n    }\n  };`;
const finallyReplacement = `        fetchUsage();\n        void queryClient.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });\n        void queryClient.invalidateQueries({ queryKey: getListCreditTransactionsQueryKey() });\n      }\n    }\n  };`;
if (help.includes(finallyMarker)) {
  help = help.replace(finallyMarker, finallyReplacement);
}
help = help.replace(/\n\s*void queryClient\.invalidateQueries\(\{ queryKey: \["iattom-help-usage"\] \}\);/g, "");

for (const marker of [
  "const queryClient = useQueryClient();",
  "getGetCreditsBalanceQueryKey()",
  "getListCreditTransactionsQueryKey()",
]) {
  if (!help.includes(marker)) throw new Error(`Help general-credit synchronization marker missing: ${marker}`);
}

for (const forbidden of [
  "helpUsed",
  "helpLoading",
  "loadHelpUsage",
  "helpUsageData",
  'queryKey: ["iattom-help-usage"]',
  'fetch("/api/help/usage"',
  "IAttom Help",
]) {
  if (credits.includes(forbidden)) throw new Error(`User Credits still contains Help-specific loading: ${forbidden}`);
}

if (!credits.includes("/api/videos/balance")) {
  throw new Error("User Credits video balance was removed unexpectedly");
}

writeFileSync(helpUrl, help);
writeFileSync(creditsUrl, credits);
console.log("User Credits contains only general, image and video counters; Help remains in general balance, history and ADM.");
