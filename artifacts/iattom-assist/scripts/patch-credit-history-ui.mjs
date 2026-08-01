import fs from "node:fs";

const pagePath = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
const source = fs.readFileSync(pagePath, "utf8");

const requiredMarkers = [
  "isError: txError",
  "function isCreativeTransaction",
  "function formatTransactionAmount",
  "function formatTransactionBalance",
  "handleTransactionHistoryScroll",
  "visibleTransactions",
  "formatTransactionAmount(tx)",
  "formatTransactionBalance(tx)",
];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Histórico consolidado ausente em Credits.tsx: ${marker}`);
  }
}

const obsoleteMarkers = [
  "formatTransactionAmount(tx as typeof tx & { balanceType?: string | null })",
  "formatTransactionBalance(tx as typeof tx & { balanceType?: string | null })",
  "(tx as typeof tx & { balanceType?: string | null }).balanceType",
];

for (const marker of obsoleteMarkers) {
  if (source.includes(marker)) {
    throw new Error(`Cast obsoleto ainda presente em Credits.tsx: ${marker}`);
  }
}

console.log("Histórico de créditos já está consolidado na fonte; nenhuma reescrita aplicada.");
