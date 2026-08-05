import fs from "node:fs";

const financePath = new URL("../src/pages/admin/AdminFinance.tsx", import.meta.url);
let source = fs.readFileSync(financePath, "utf8");

const summaryTypeAnchor = `  mrrByPlan: {
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
  recentMovements: FinancialMovement[];`;
const summaryTypeReplacement = `  mrrByPlan: {
    free: number;
    pro: number;
    business: number;
    agency: number;
  };
  annualSubscriptions: {
    total: number;
    start: number;
    premium: number;
    pro: number;
  };
  recentMovements: FinancialMovement[];`;
if (!source.includes("annualSubscriptions: {\n    total: number;")) {
  if (!source.includes(summaryTypeAnchor)) throw new Error("Finance annual block type anchor not found");
  source = source.replace(summaryTypeAnchor, summaryTypeReplacement);
}

const chartsAnchor = `      <div className="grid gap-6 lg:grid-cols-2">`;
const annualBlock = `      <Card className="relative overflow-hidden border-white/[0.07] bg-[#0d1015] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.22)]">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Assinaturas</p>
          <h3 className="mt-1 text-base font-semibold text-white">Planos Anuais</h3>
          <p className="mt-1 text-xs text-zinc-600">Assinaturas anuais confirmadas e atualmente ativas.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-white/[0.06] bg-black/15 p-4">
            <p className="text-2xl font-bold text-white">{summary?.annualSubscriptions?.total ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">Total anual</p>
          </div>
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.035] p-4">
            <p className="text-2xl font-bold text-emerald-300">{summary?.annualSubscriptions?.start ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">START</p>
          </div>
          <div className="rounded-xl border border-violet-400/10 bg-violet-400/[0.035] p-4">
            <p className="text-2xl font-bold text-violet-300">{summary?.annualSubscriptions?.premium ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">PREMIUM</p>
          </div>
          <div className="rounded-xl border border-rose-400/10 bg-rose-400/[0.035] p-4">
            <p className="text-2xl font-bold text-rose-300">{summary?.annualSubscriptions?.pro ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">PRO</p>
          </div>
        </div>
      </Card>

`;
if (!source.includes("<h3 className=\"mt-1 text-base font-semibold text-white\">Planos Anuais</h3>")) {
  if (!source.includes(chartsAnchor)) throw new Error("Finance annual block insertion anchor not found");
  source = source.replace(chartsAnchor, annualBlock + chartsAnchor);
}

for (const marker of [
  "annualSubscriptions:",
  ">Planos Anuais</h3>",
  "summary?.annualSubscriptions?.total",
  "summary?.annualSubscriptions?.start",
  "summary?.annualSubscriptions?.premium",
  "summary?.annualSubscriptions?.pro",
]) {
  if (!source.includes(marker)) throw new Error(`Finance annual block marker missing: ${marker}`);
}

fs.writeFileSync(financePath, source);
console.log("Admin Finance annual plans block restored in final frontend source.");
