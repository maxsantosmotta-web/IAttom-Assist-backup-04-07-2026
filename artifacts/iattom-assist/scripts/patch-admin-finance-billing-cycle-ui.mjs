import fs from "node:fs";

const financePath = new URL("../src/pages/admin/AdminFinance.tsx", import.meta.url);
let source = fs.readFileSync(financePath, "utf8");

const annualTypeBlock = `  annualSubscriptions: {
    total: number;
    start: number;
    premium: number;
    pro: number;
  };
`;
source = source.replace(annualTypeBlock, "");

const annualBlockStart = `      <Card className="relative overflow-hidden border-white/[0.07] bg-[#0d1015] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.22)]">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Assinaturas</p>
          <h3 className="mt-1 text-base font-semibold text-white">Planos Anuais</h3>`;
const chartsAnchor = `      <div className="grid gap-6 lg:grid-cols-2">`;

const start = source.indexOf(annualBlockStart);
if (start !== -1) {
  const end = source.indexOf(chartsAnchor, start);
  if (end === -1) throw new Error("Finance annual block end anchor not found");
  source = source.slice(0, start) + source.slice(end);
}

for (const forbidden of [
  ">Planos Anuais</h3>",
  "summary?.annualSubscriptions?.total",
  "summary?.annualSubscriptions?.start",
  "summary?.annualSubscriptions?.premium",
  "summary?.annualSubscriptions?.pro",
]) {
  if (source.includes(forbidden)) throw new Error(`Finance annual block was not fully removed: ${forbidden}`);
}

fs.writeFileSync(financePath, source);
console.log("Admin Finance annual plans block removed; all other finance content preserved.");
