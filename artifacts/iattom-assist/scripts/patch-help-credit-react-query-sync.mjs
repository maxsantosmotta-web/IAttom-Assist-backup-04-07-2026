import { readFileSync, writeFileSync } from "node:fs";

const helpUrl = new URL("../src/components/IAttomHelpPanel.tsx", import.meta.url);
const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);

let help = readFileSync(helpUrl, "utf8");
let credits = readFileSync(creditsUrl, "utf8");

// This patch runs after patch-centralize-credit-balances.mjs and only replaces
// the temporary zero states created there with canonical React Query reads.
if (!credits.includes('import { useQuery } from "@tanstack/react-query";')) {
  credits = credits.replace(
    'import { useLocation } from "wouter";',
    'import { useLocation } from "wouter";\nimport { useQuery } from "@tanstack/react-query";',
  );
}

const oldStateBlock = `  const [videoBalance, setVideoBalance] = useState(0);
  const [helpUsed, setHelpUsed] = useState(0);`;
const queryStateBlock = `  const { data: videoBalanceData } = useQuery({
    queryKey: ["iattom-video-balance"],
    queryFn: async () => {
      const response = await fetch("/api/videos/balance", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("video balance request failed");
      const payload = await response.json() as { videoBalance?: number };
      return Number(payload.videoBalance ?? 0);
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const { data: helpUsageData } = useQuery({
    queryKey: ["iattom-help-usage"],
    queryFn: async () => {
      const response = await fetch("/api/help/usage", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("help usage request failed");
      return response.json() as Promise<{ used?: number }>;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });`;

if (!credits.includes(queryStateBlock)) {
  if (!credits.includes(oldStateBlock)) {
    throw new Error("Credits temporary Help/video state marker not found");
  }
  credits = credits.replace(oldStateBlock, queryStateBlock);
}

const loadersBlock = `
  const loadVideoBalance = async () => {
    try {
      const response = await fetch("/api/videos/balance", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("video balance request failed");
      const video = await response.json() as { videoBalance?: number };
      setVideoBalance(Number(video.videoBalance ?? 0));
    } catch {
      // Não substitui um saldo válido por zero quando houver falha temporária.
    }
  };

  const loadHelpUsage = async () => {
    try {
      const response = await fetch("/api/help/usage", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("help usage request failed");
      const help = await response.json() as { used?: number };
      setHelpUsed(Number(help.used ?? 0));
    } catch {
      // O uso do Help é independente do saldo de vídeos.
    }
  };

  useEffect(() => {
    void loadVideoBalance();
    void loadHelpUsage();
  }, []);`;
credits = credits.replace(loadersBlock, "");

const oldVideoValue = `<p className="text-3xl font-bold text-white tabular-nums">{videoBalance.toLocaleString("pt-BR")}</p>`;
const newVideoValue = `{videoBalanceData === undefined ? (
            <Skeleton className="h-9 w-16 bg-white/5" />
          ) : (
            <p className="text-3xl font-bold text-white tabular-nums">{videoBalanceData.toLocaleString("pt-BR")}</p>
          )}`;
if (!credits.includes(newVideoValue)) {
  if (!credits.includes(oldVideoValue)) throw new Error("Video card value marker not found");
  credits = credits.replace(oldVideoValue, newVideoValue);
}

const oldHelpValue = `<p className="text-3xl font-bold text-white tabular-nums">{helpUsed.toLocaleString("pt-BR")}</p>`;
const newHelpValue = `{helpUsageData === undefined ? (
            <Skeleton className="h-9 w-16 bg-white/5" />
          ) : (
            <p className="text-3xl font-bold text-white tabular-nums">{Number(helpUsageData.used ?? 0).toLocaleString("pt-BR")}</p>
          )}`;
if (!credits.includes(newHelpValue)) {
  if (!credits.includes(oldHelpValue)) throw new Error("Help card value marker not found");
  credits = credits.replace(oldHelpValue, newHelpValue);
}

// Help panel: invalidate the existing caches only after a completed response.
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
const finallyReplacement = `        fetchUsage();\n        void queryClient.invalidateQueries({ queryKey: ["iattom-help-usage"] });\n        void queryClient.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });\n        void queryClient.invalidateQueries({ queryKey: getListCreditTransactionsQueryKey() });\n      }\n    }\n  };`;
if (help.includes(finallyMarker) && !help.includes('invalidateQueries({ queryKey: ["iattom-help-usage"] })')) {
  help = help.replace(finallyMarker, finallyReplacement);
}

for (const marker of [
  'queryKey: ["iattom-video-balance"]',
  'queryKey: ["iattom-help-usage"]',
  "videoBalanceData === undefined",
  "helpUsageData === undefined",
  "const queryClient = useQueryClient();",
  "getGetCreditsBalanceQueryKey()",
  "getListCreditTransactionsQueryKey()",
]) {
  if (!credits.includes(marker) && !help.includes(marker)) {
    throw new Error(`Credit persistence marker missing: ${marker}`);
  }
}

if (credits.includes("const [videoBalance, setVideoBalance] = useState(0)") || credits.includes("const [helpUsed, setHelpUsed] = useState(0)")) {
  throw new Error("False zero Help/video state still exists");
}
if (help.includes('window.dispatchEvent(new CustomEvent("iattom-help-usage-updated"')) {
  throw new Error("Legacy custom-event Help sync must not be present");
}

writeFileSync(helpUrl, help);
writeFileSync(creditsUrl, credits);
console.log("Help and video cards now wait for persisted backend values instead of rendering false zeroes.");
