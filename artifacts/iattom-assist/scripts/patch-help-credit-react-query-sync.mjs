import { readFileSync, writeFileSync } from "node:fs";

const helpUrl = new URL("../src/components/IAttomHelpPanel.tsx", import.meta.url);
const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);

let help = readFileSync(helpUrl, "utf8");
let credits = readFileSync(creditsUrl, "utf8");

// Credits: use a canonical React Query cache entry for Help usage.
if (!credits.includes('import { useQuery } from "@tanstack/react-query";')) {
  credits = credits.replace(
    'import { useLocation } from "wouter";',
    'import { useLocation } from "wouter";\nimport { useQuery } from "@tanstack/react-query";',
  );
}

const oldHelpState = `  const [helpUsed, setHelpUsed] = useState(0);`;
const newHelpState = `  const { data: helpUsageData } = useQuery({
    queryKey: ["iattom-help-usage"],
    queryFn: async () => {
      const response = await fetch("/api/help/usage", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("help usage request failed");
      return response.json() as Promise<{ used?: number }>;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const helpUsed = Number(helpUsageData?.used ?? 0);`;
if (credits.includes(oldHelpState)) {
  credits = credits.replace(oldHelpState, newHelpState);
}

credits = credits.replace(
  /\n  const loadHelpUsage = async \(\) => \{[\s\S]*?\n  \};\n/,
  "\n",
);
credits = credits.replace(
  `  useEffect(() => {\n    void loadVideoBalance();\n    void loadHelpUsage();\n  }, []);`,
  `  useEffect(() => {\n    void loadVideoBalance();\n  }, []);`,
);

// Help panel: invalidate only the existing React Query caches after a completed response.
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
  'queryKey: ["iattom-help-usage"]',
  "const queryClient = useQueryClient();",
  "getGetCreditsBalanceQueryKey()",
  "getListCreditTransactionsQueryKey()",
]) {
  if (!credits.includes(marker) && !help.includes(marker)) {
    throw new Error(`Safe Help credit sync marker missing: ${marker}`);
  }
}

if (help.includes('window.dispatchEvent(new CustomEvent("iattom-help-usage-updated"')) {
  throw new Error("Legacy custom-event Help sync must not be present");
}

writeFileSync(helpUrl, help);
writeFileSync(creditsUrl, credits);
console.log("IAttom Help now refreshes credits and usage through React Query without global events.");
