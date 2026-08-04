import fs from "node:fs";

const creditsPath = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
const billingPath = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);

let credits = fs.readFileSync(creditsPath, "utf8");
let billing = fs.readFileSync(billingPath, "utf8");

const translatePattern = /function translateDescription\(desc: string\): string \{[\s\S]*?\n\}/;
const translateReplacement = `function translateDescription(desc: string): string {
  const exact = descriptionTranslations[desc];
  if (exact) return exact;

  const normalized = desc.trim();
  const lower = normalized.toLowerCase();
  const commercialPlanName = (value: string): string => {
    const key = value.trim().toLowerCase();
    return planDisplayNames[key] ?? value.trim().toUpperCase();
  };
  const translatePlanTokens = (value: string): string => value.replace(
    /\b(business|agency|pro|premium|start)\b/gi,
    (token) => commercialPlanName(token),
  );

  if (/assinatura.+ativad[ao]/i.test(normalized)) {
    return translatePlanTokens(normalized);
  }

  if (/altera[cç][aã]o|upgrade|downgrade/i.test(normalized)) {
    return translatePlanTokens(normalized);
  }

  if (lower.includes("plan subscription activated")) {
    const planKey = lower.split(" plan subscription activated")[0]?.trim() ?? "";
    return \`Assinatura \${commercialPlanName(planKey)} ativada\`;
  }

  if (lower.includes("compra de créditos avulsos")) return "Compra de créditos";
  if (lower.includes("compra de criativos avulsos")) return "Compra de imagens";
  if (lower.includes("compra de pacote de vídeos")) return "Compra de vídeos";
  if (lower.includes("uso do gerador criativo")) return "Criação de imagem";
  if (lower.includes("uso do criador de campanha")) return "Criação de campanha";
  if (lower.includes("uso do validador de produtos")) return "Validação de produto";
  if (lower.includes("uso do buscador de produtos")) return "Busca de produto";
  if (lower.includes("criação de prompt")) return "Criação de prompt";
  if (lower.includes("refund") || lower.includes("reembolso") || lower.includes("estorno")) return "Reembolso";

  return normalized;
}`;

if (!translatePattern.test(credits)) {
  throw new Error("Credits transaction translation function was not found");
}
credits = credits.replace(translatePattern, translateReplacement);

const singleRefresh = "        await Promise.all([refetchSub(), refetchMe(), refetchCredits()]);";
const pollingRefresh = `        for (let attempt = 0; attempt < 5; attempt += 1) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getGetStripeSubscriptionQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() }),
          ]);
          await Promise.all([refetchSub(), refetchMe(), refetchCredits()]);
          if (attempt < 4) await new Promise((resolve) => window.setTimeout(resolve, 900));
        }`;

if (billing.includes(singleRefresh)) {
  billing = billing.replace(singleRefresh, pollingRefresh);
}

for (const marker of [
  "translatePlanTokens(normalized)",
  "/\\b(business|agency|pro|premium|start)\\b/gi",
]) {
  if (!credits.includes(marker)) {
    throw new Error(`Billing history plan-label marker missing: ${marker}`);
  }
}

fs.writeFileSync(creditsPath, credits);
fs.writeFileSync(billingPath, billing);
console.log("Billing history uses commercial plan names; existing Stripe refresh flow was preserved.");
