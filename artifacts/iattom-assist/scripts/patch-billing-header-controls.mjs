import { readFileSync, writeFileSync } from "node:fs";

const sidebarUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let sidebarSource = readFileSync(sidebarUrl, "utf8");
sidebarSource = sidebarSource.replace('      "/dashboard/billing": "Assinatura e Planos",\n', "");
writeFileSync(sidebarUrl, sidebarSource, "utf8");

const billingUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = readFileSync(billingUrl, "utf8");

if (!source.includes('data-iattom-billing-controls="true"')) {
  const buttonPattern = /([ \t]*)<Button\b(?=[\s\S]*?onClick=\{handleBillingRefresh\})(?=[\s\S]*?Atualizar\s*<\/Button>)[\s\S]*?<\/Button>/;
  const match = source.match(buttonPattern);

  if (!match) {
    throw new Error("Billing refresh control not found");
  }

  const indent = match[1];
  const originalButton = match[0].trimStart()
    .replace(/className="[^"]*"/, 'className="h-9 border-white/10 text-xs gap-1.5"');

  const controls = `${indent}<div data-iattom-billing-controls="true" className="flex items-center gap-2 shrink-0 mt-1">\n${indent}  ${originalButton.replace(/\n/g, `\n${indent}  `)}\n${indent}  <Button type="button" size="sm" variant="outline" onClick={() => window.location.assign("/dashboard")} className="h-9 border-white/10 text-xs">\n${indent}    Voltar\n${indent}  </Button>\n${indent}</div>`;

  source = source.replace(match[0], controls);
}

for (const marker of [
  'data-iattom-billing-controls="true"',
  'onClick={handleBillingRefresh}',
  'onClick={() => window.location.assign("/dashboard")}',
]) {
  if (!source.includes(marker)) throw new Error(`Billing marker missing: ${marker}`);
}

writeFileSync(billingUrl, source, "utf8");
console.log("Billing controls standardized while preserving the existing refresh function.");
