import { readFileSync, writeFileSync } from "node:fs";

const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
let source = readFileSync(creditsUrl, "utf8");

if (source.includes("credit-history-infinite-scroll")) {
  console.log("Credit history incremental scroll already applied.");
  process.exit(0);
}

source = source.replace(
  /import \{ useEffect, useState \} from "react";/,
  'import { useEffect, useState, type UIEvent } from "react";',
);

if (!source.includes('type UIEvent')) {
  source = source.replace(
    'import { motion } from "framer-motion";',
    'import { motion } from "framer-motion";\nimport { useEffect, useState, type UIEvent } from "react";',
  );
}

const queryMarker = `  const { data: txData, isLoading: txLoading, isFetching: fetchingTx, isError: txError, refetch: refetchTx } = useListCreditTransactions(
    {},
    { query: { queryKey: getListCreditTransactionsQueryKey(), staleTime: 0 } },
  );`;

if (!source.includes(queryMarker)) {
  throw new Error("Credit transaction query marker not found");
}

source = source.replace(
  queryMarker,
  `${queryMarker}\n\n  // credit-history-infinite-scroll\n  const [loadedTransactions, setLoadedTransactions] = useState<any[]>([]);\n  const [visibleTransactionCount, setVisibleTransactionCount] = useState(10);\n  const [fetchedTransactionCount, setFetchedTransactionCount] = useState(0);\n  const [loadingMoreTransactions, setLoadingMoreTransactions] = useState(false);\n\n  useEffect(() => {\n    const initialTransactions = txData?.transactions ?? [];\n    setLoadedTransactions(initialTransactions.filter((tx) => !isTechnicalMaintenanceDescription(tx.description)));\n    setFetchedTransactionCount(initialTransactions.length);\n    setVisibleTransactionCount(10);\n  }, [txData]);\n\n  const handleTransactionHistoryScroll = async (event: UIEvent<HTMLDivElement>) => {\n    const element = event.currentTarget;\n    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 80;\n    if (!nearBottom || loadingMoreTransactions) return;\n\n    if (visibleTransactionCount < loadedTransactions.length) {\n      setVisibleTransactionCount((current) => Math.min(current + 10, loadedTransactions.length));\n      return;\n    }\n\n    const totalTransactions = txData?.total ?? loadedTransactions.length;\n    if (fetchedTransactionCount >= totalTransactions) return;\n\n    setLoadingMoreTransactions(true);\n    try {\n      const response = await fetch(\n        \`/api/credits/transactions?limit=50&offset=\${fetchedTransactionCount}\`,\n        { credentials: "include" },\n      );\n      if (!response.ok) throw new Error("Failed to load additional credit transactions");\n\n      const nextPage = await response.json() as { transactions?: any[] };\n      const rawTransactions = nextPage.transactions ?? [];\n      const visibleNextTransactions = rawTransactions.filter(\n        (tx) => !isTechnicalMaintenanceDescription(tx.description),\n      );\n\n      setFetchedTransactionCount((current) => current + rawTransactions.length);\n      setLoadedTransactions((current) => {\n        const existingIds = new Set(current.map((tx) => tx.id));\n        const uniqueNext = visibleNextTransactions.filter((tx) => !existingIds.has(tx.id));\n        return [...current, ...uniqueNext];\n      });\n      setVisibleTransactionCount((current) => current + 10);\n    } catch (error) {\n      console.error("Unable to load more credit transactions", error);\n    } finally {\n      setLoadingMoreTransactions(false);\n    }\n  };`,
);

source = source.replace(
  /  const visibleTransactions = \(txData\?\.transactions\.filter\([\s\S]*?\) \?\? \[\]\)\.slice\(0, 10\);/,
  `  const visibleTransactions = loadedTransactions.slice(0, visibleTransactionCount);`,
);

source = source.replace(
  `<span className="text-xs text-muted-foreground">{visibleTransactions.length} movimentações</span>`,
  `<span className="text-xs text-muted-foreground">{txData.total.toLocaleString("pt-BR")} movimentações</span>`,
);

source = source.replace(
  `<div className="overflow-x-auto">\n              <table className="w-full text-sm">`,
  `<div\n              onScroll={handleTransactionHistoryScroll}\n              className="max-h-[560px] overflow-auto"\n            >\n              <table className="w-full text-sm">`,
);

source = source.replace(
  `<thead>\n                  <tr className="border-b border-white/5">`,
  `<thead className="sticky top-0 z-10 bg-[#111111]">\n                  <tr className="border-b border-white/5">`,
);

source = source.replace(
  `                </tbody>\n              </table>`,
  `                  {loadingMoreTransactions && (\n                    <tr>\n                      <td colSpan={5} className="px-5 py-4 text-center text-xs text-muted-foreground">\n                        Carregando mais movimentações...\n                      </td>\n                    </tr>\n                  )}\n                </tbody>\n              </table>`,
);

const requiredMarkers = [
  "credit-history-infinite-scroll",
  "handleTransactionHistoryScroll",
  "visibleTransactionCount",
  "max-h-[560px] overflow-auto",
  "sticky top-0 z-10",
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) throw new Error(`Missing credit history marker: ${marker}`);
}

if (source.includes(".slice(0, 10);")) {
  throw new Error("Legacy fixed ten-transaction cut is still present");
}

writeFileSync(creditsUrl, source);
console.log("Credit history now keeps ten rows initially and loads the complete history while scrolling.");
