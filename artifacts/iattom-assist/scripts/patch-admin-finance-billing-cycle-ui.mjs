import fs from "node:fs";

const financePath = new URL("../src/pages/admin/AdminFinance.tsx", import.meta.url);
let source = fs.readFileSync(financePath, "utf8");

source = source
  .replace(/\n\s*priceId\?: string \| null;\n\s*interval\?: string \| null;/g, "")
  .replace(/\n\s*annualSubscriptions: \{\n\s*total: number;\n\s*start: number;\n\s*premium: number;\n\s*pro: number;\n\s*\};/g, "")
  .replace(/\n\s*\{item\.type === "subscription" && \(\n\s*<p className="mt-1 break-all text-\[10px\] text-amber-300\/80">\n\s*priceId: \{item\.priceId \?\? "não informado"\} · interval: \{item\.interval \?\? "não informado"\}\n\s*<\/p>\n\s*\)\}/g, "");

const annualHeading = '<h3 className="mt-1 text-base font-semibold text-white">Planos Anuais</h3>';
const chartsAnchor = '      <div className="grid gap-6 lg:grid-cols-2">';
const headingIndex = source.indexOf(annualHeading);
if (headingIndex !== -1) {
  const cardStart = source.lastIndexOf('      <Card className="relative overflow-hidden', headingIndex);
  const cardEnd = source.indexOf(chartsAnchor, headingIndex);
  if (cardStart === -1 || cardEnd === -1) throw new Error("Annual Finance block cleanup anchors not found");
  source = source.slice(0, cardStart) + source.slice(cardEnd);
}

for (const forbidden of [
  ">Planos Anuais</h3>",
  "summary?.annualSubscriptions?.total",
  "priceId: {item.priceId",
  "interval: {item.interval",
]) {
  if (source.includes(forbidden)) throw new Error(`Annual Finance UI cleanup failed: ${forbidden}`);
}

fs.writeFileSync(financePath, source);
console.log("Failed annual Finance block and visible diagnostics removed; remaining Finance UI preserved.");
