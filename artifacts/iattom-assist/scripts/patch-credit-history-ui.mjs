import fs from "node:fs";

const pagePath = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
let source = fs.readFileSync(pagePath, "utf8");

const oldQuery = `  const { data: txData, isLoading: txLoading, isFetching: fetchingTx, refetch: refetchTx } = useListCreditTransactions(
    {},
    { query: { queryKey: getListCreditTransactionsQueryKey() } },
  );`;
const newQuery = `  const { data: txData, isLoading: txLoading, isFetching: fetchingTx, isError: txError, refetch: refetchTx } = useListCreditTransactions(
    {},
    { query: { queryKey: getListCreditTransactionsQueryKey(), staleTime: 0 } },
  );`;
if (source.includes(oldQuery)) source = source.replace(oldQuery, newQuery);
else if (!source.includes("isError: txError")) throw new Error("Consulta do histórico não encontrada");

const helperAnchor = `function translateDescription(desc: string): string {
  return descriptionTranslations[desc] ?? desc;
}`;
const helperReplacement = `${helperAnchor}

function isCreativeTransaction(tx: { balanceType?: string | null; description?: string }): boolean {
  return tx.balanceType === "creative" || /imagem|criativo/i.test(tx.description ?? "");
}

function formatTransactionAmount(tx: { amount: number; balanceType?: string | null; description?: string }): string {
  const creative = isCreativeTransaction(tx);
  const value = creative ? tx.amount / 10 : tx.amount;
  const unit = creative ? (Math.abs(value) === 1 ? " imagem" : " imagens") : " créditos";
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("pt-BR")}${unit}`;
}

function formatTransactionBalance(tx: { balanceAfter: number; balanceType?: string | null; description?: string }): string {
  const creative = isCreativeTransaction(tx);
  const value = creative ? tx.balanceAfter / 10 : tx.balanceAfter;
  return `${value.toLocaleString("pt-BR")} ${creative ? (value === 1 ? "imagem" : "imagens") : "créditos"}`;
}`;
if (!source.includes("function isCreativeTransaction")) {
  if (!source.includes(helperAnchor)) throw new Error("Âncora dos formatadores do histórico não encontrada");
  source = source.replace(helperAnchor, helperReplacement);
}

const emptyBlock = `          ) : !txData?.transactions.length ? (
            <div className="py-16 text-center">
              <Zap className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">Use um dos módulos para ver seu histórico aqui.</p>
            </div>
          ) : (`;
const errorAwareBlock = `          ) : txError ? (
            <div className="py-16 text-center">
              <Zap className="w-8 h-8 text-red-400/30 mx-auto mb-3" />
              <p className="text-sm text-red-300">Não foi possível carregar o histórico.</p>
              <button onClick={() => void refetchTx()} className="text-xs text-primary mt-2 hover:underline">Tentar novamente</button>
            </div>
          ) : !txData?.transactions.length ? (
            <div className="py-16 text-center">
              <Zap className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">Compras, upgrades e consumos aparecerão aqui.</p>
            </div>
          ) : (`;
if (source.includes(emptyBlock)) source = source.replace(emptyBlock, errorAwareBlock);
else if (!source.includes("Não foi possível carregar o histórico")) throw new Error("Estado vazio do histórico não encontrado");

const amountBlock = `                        {tx.amount >= 0 ? "+" : ""}
                        {tx.amount}`;
if (source.includes(amountBlock)) source = source.replace(amountBlock, `{formatTransactionAmount(tx as typeof tx & { balanceType?: string | null })}`);
else if (!source.includes("formatTransactionAmount(tx")) throw new Error("Valor da transação não encontrado");

const balanceBlock = `                        {tx.balanceAfter}`;
if (source.includes(balanceBlock)) source = source.replace(balanceBlock, `{formatTransactionBalance(tx as typeof tx & { balanceType?: string | null })}`);
else if (!source.includes("formatTransactionBalance(tx")) throw new Error("Saldo da transação não encontrado");

const descriptionBlock = `                        {tx.feature && (
                          <span className="text-xs text-muted-foreground">
                            {featureLabels[tx.feature] ?? tx.feature}
                          </span>
                        )}`;
const descriptionReplacement = `${descriptionBlock}
                        {(tx as typeof tx & { balanceType?: string | null }).balanceType && (
                          <span className="text-[11px] uppercase tracking-wide text-white/30 block mt-0.5">
                            {(tx as typeof tx & { balanceType?: string | null }).balanceType === "creative" ? "Saldo de imagens" : "Saldo geral"}
                          </span>
                        )}`;
if (!source.includes("Saldo de imagens")) {
  if (!source.includes(descriptionBlock)) throw new Error("Descrição da transação não encontrada");
  source = source.replace(descriptionBlock, descriptionReplacement);
}

fs.writeFileSync(pagePath, source);
console.log("Histórico do usuário agora mostra upgrades, pacotes, créditos e imagens em unidades reais.");
