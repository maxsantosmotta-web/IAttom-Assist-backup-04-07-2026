import { readFileSync, writeFileSync } from "node:fs";

const helpUrl = new URL("../src/components/IAttomHelpPanel.tsx", import.meta.url);
const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);

let help = readFileSync(helpUrl, "utf8");
let credits = readFileSync(creditsUrl, "utf8");

const hasCoordinatedCreditLoading =
  credits.includes("const [videoBalance, setVideoBalance] = useState<number | null>(null);") &&
  credits.includes("const [helpUsed, setHelpUsed] = useState<number | null>(null);") &&
  credits.includes("const loadVideoBalance = async") &&
  credits.includes("const loadHelpUsage = async") &&
  credits.includes("void loadVideoBalance(); void loadHelpUsage();");

if (hasCoordinatedCreditLoading) {
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
  const resilientVideoLoader = `  const loadVideoBalance = async (): Promise<boolean> => {
    setVideoLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/api/videos/balance", { credentials: "include", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("video balance request failed");
        const video = await response.json() as { videoBalance?: number };
        setVideoBalance(Number(video.videoBalance ?? 0));
        return true;
      } finally {
        window.clearTimeout(timeoutId);
      }
    } catch {
      return false;
    } finally {
      setVideoLoading(false);
    }
  };`;

  const oldHelpLoader = `  const loadHelpUsage = async () => {
    setHelpLoading(true);
    try {
      const response = await fetch("/api/help/usage", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("help usage request failed");
      const help = await response.json() as { used?: number };
      setHelpUsed(Number(help.used ?? 0));
    } catch {
      // Mantém o último contador válido em falhas temporárias.
    } finally {
      setHelpLoading(false);
    }
  };`;
  const resilientHelpLoader = `  const loadHelpUsage = async (): Promise<boolean> => {
    setHelpLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/api/help/usage", { credentials: "include", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("help usage request failed");
        const help = await response.json() as { used?: number };
        setHelpUsed(Number(help.used ?? 0));
        return true;
      } finally {
        window.clearTimeout(timeoutId);
      }
    } catch {
      return false;
    } finally {
      setHelpLoading(false);
    }
  };`;

  if (credits.includes(oldVideoLoader)) credits = credits.replace(oldVideoLoader, resilientVideoLoader);
  if (credits.includes(oldHelpLoader)) credits = credits.replace(oldHelpLoader, resilientHelpLoader);

  const oldEntryEffect = `  useEffect(() => {
    void loadVideoBalance();
    void loadHelpUsage();
  }, []);`;
  const resilientEntryEffect = `  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;

    const loadOnEntry = async () => {
      const [videoOk, helpOk] = await Promise.all([
        loadVideoBalance(),
        loadHelpUsage(),
      ]);
      if (cancelled || (videoOk && helpOk)) return;

      retryTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (!videoOk) void loadVideoBalance();
        if (!helpOk) void loadHelpUsage();
      }, 900);
    };

    const entryTimer = window.setTimeout(() => {
      void loadOnEntry();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(entryTimer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, []);`;

  if (credits.includes(oldEntryEffect)) {
    credits = credits.replace(oldEntryEffect, resilientEntryEffect);
  } else if (!credits.includes("const loadOnEntry = async")) {
    throw new Error("Credits automatic entry loading marker not found");
  }
}

if (!hasCoordinatedCreditLoading) {
  // Compatibilidade com a implementação antiga baseada em React Query.
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
      throw new Error("Credits Help/video loading implementation not recognized");
    }
    credits = credits.replace(oldStateBlock, queryStateBlock);
  }

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
}

// O painel Help invalida as fontes persistidas somente após resposta concluída.
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
  "const queryClient = useQueryClient();",
  "getGetCreditsBalanceQueryKey()",
  "getListCreditTransactionsQueryKey()",
]) {
  if (!help.includes(marker)) {
    throw new Error(`Help credit synchronization marker missing: ${marker}`);
  }
}

const hasValidCreditCards = hasCoordinatedCreditLoading || (
  credits.includes('queryKey: ["iattom-video-balance"]') &&
  credits.includes('queryKey: ["iattom-help-usage"]') &&
  credits.includes("videoBalanceData === undefined") &&
  credits.includes("helpUsageData === undefined")
);

if (!hasValidCreditCards) {
  throw new Error("Credits Help/video synchronization was not installed");
}
if (hasCoordinatedCreditLoading && !credits.includes("const loadOnEntry = async")) {
  throw new Error("Credits automatic entry recovery was not installed");
}
if (credits.includes("const [videoBalance, setVideoBalance] = useState(0)") || credits.includes("const [helpUsed, setHelpUsed] = useState(0)")) {
  throw new Error("False zero Help/video state still exists");
}
if (help.includes('window.dispatchEvent(new CustomEvent("iattom-help-usage-updated"')) {
  throw new Error("Legacy custom-event Help sync must not be present");
}

writeFileSync(helpUrl, help);
writeFileSync(creditsUrl, credits);
console.log("Credits loads video and Help automatically on entry, with timeout and one recovery attempt.");
