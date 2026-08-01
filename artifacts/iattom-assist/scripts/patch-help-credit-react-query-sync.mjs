import { readFileSync, writeFileSync } from "node:fs";

const helpUrl = new URL("../src/components/IAttomHelpPanel.tsx", import.meta.url);
const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);

let help = readFileSync(helpUrl, "utf8");
let credits = readFileSync(creditsUrl, "utf8");

// O IAttom Help consome somente o saldo geral. No painel do usuário ele não
// possui contador, carregamento, consulta ou franquia próprios.
credits = credits
  .replace(/\n\s*const \[helpUsed, setHelpUsed\] = useState<[^;]+;?/g, "")
  .replace(/\n\s*const \[helpUsed, setHelpUsed\] = useState\([^;]+;?/g, "")
  .replace(/\n\s*const \[helpLoading, setHelpLoading\] = useState<[^;]+;?/g, "")
  .replace(/\n\s*const \[helpLoading, setHelpLoading\] = useState\([^;]+;?/g, "")
  .replace(/\n\s*const loadHelpUsage = async[\s\S]*?\n\s*};/g, "")
  .replace(/\n\s*const \{ data: helpUsageData[^;]*?\} = useQuery\([\s\S]*?queryKey:\s*\["iattom-help-usage"\][\s\S]*?\n\s*}\);/g, "")
  .replace(/const \[videoOk, helpOk\] = await Promise\.all\(\[\s*loadVideoBalance\(\),\s*loadHelpUsage\(\),\s*\]\);/g, "const videoOk = await loadVideoBalance();")
  .replace(/\(videoOk && helpOk\)/g, "videoOk")
  .replace(/\n\s*if \(!helpOk\) void loadHelpUsage\(\);/g, "")
  .replace(/void loadVideoBalance\(\);\s*void loadHelpUsage\(\);/g, "void loadVideoBalance();")
  .replace(/\s*void loadHelpUsage\(\);/g, "")
  .replace(/\s*<Card\b(?:(?!<Card\b)[\s\S])*?IAttom Help(?:(?!<Card\b)[\s\S])*?<\/Card>/g, "")
  .replace(/\s*<div\b(?:(?!<div\b)[\s\S])*?IAttom Help(?:(?!<div\b)[\s\S])*?<\/div>/g, "")
  .replace(/\s*,?\s*HelpCircle\s*,?/g, ", ")
  .replace(/,\s*,/g, ",");

// Mantém o carregamento do saldo de vídeos como a única leitura adicional
// do módulo Créditos. A consulta deve encerrar ao desmontar a tela.
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
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
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

// Se a versão anterior possuía recuperação coordenada, transforma em uma
// única carga de vídeo por entrada, sem retry oculto e sem timer do Help.
credits = credits.replace(
  /  useEffect\(\(\) => \{\n\s*let cancelled = false;[\s\S]*?const loadOnEntry = async \(\) => \{[\s\S]*?const videoOk = await loadVideoBalance\(\);[\s\S]*?\n\s*};\n[\s\S]*?return \(\) => \{[\s\S]*?\n\s*};\n\s*}\, \[\]\);/g,
  isolatedVideoEntry,
);

// O Help continua atualizando o saldo geral e o histórico depois de uma
// resposta concluída. Isso preserva registro do usuário e contagem do ADM.
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
console.log("User Credits now contains only general, image and video counters; Help remains in general balance, history and ADM.");
