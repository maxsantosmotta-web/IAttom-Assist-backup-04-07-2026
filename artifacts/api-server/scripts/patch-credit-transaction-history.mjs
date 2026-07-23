import fs from "node:fs";

const routePath = new URL("../src/routes/credits.ts", import.meta.url);
let source = fs.readFileSync(routePath, "utf8");

const oldBlock = `  res.json(ListCreditTransactionsResponse.parse({
    transactions: txList,
    total,
    balance: (userRow?.credits ?? 0) + (userRow?.extraCredits ?? 0),
  }));`;

const newBlock = `  // Retorne o histórico sem derrubar a resposta quando feature/balanceType forem nulos.
  // Assinaturas, upgrades e pacotes não possuem feature de módulo, mas continuam
  // sendo transações válidas e devem aparecer integralmente para o usuário.
  res.json({
    transactions: txList.map((transaction) => ({
      ...transaction,
      feature: transaction.feature ?? null,
      balanceType: transaction.balanceType ?? null,
    })),
    total,
    balance: (userRow?.credits ?? 0) + (userRow?.extraCredits ?? 0),
  });`;

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
} else if (!source.includes("Retorne o histórico sem derrubar a resposta")) {
  throw new Error("Bloco de resposta do histórico de créditos não encontrado");
}

fs.writeFileSync(routePath, source);
console.log("Histórico de transações agora aceita assinaturas, upgrades, pacotes e consumos com campos nulos.");
