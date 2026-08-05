import fs from "node:fs";

const financePath = new URL("../src/pages/admin/AdminFinance.tsx", import.meta.url);
const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);

let finance = fs.readFileSync(financePath, "utf8");
let overview = fs.readFileSync(overviewPath, "utf8");
let activity = fs.readFileSync(activityPath, "utf8");

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
  annualSalesHistory: {
    total: number;
    start: number;
    premium: number;
    pro: number;
  };
  recentMovements: FinancialMovement[];`;
if (!finance.includes("annualSubscriptions: {\n    total: number;")) {
  if (!finance.includes(summaryTypeAnchor)) throw new Error("Finance annual UI type anchor not found");
  finance = finance.replace(summaryTypeAnchor, summaryTypeReplacement);
} else if (!finance.includes("annualSalesHistory: {\n    total: number;")) {
  finance = finance.replace(
    `  annualSubscriptions: {
    total: number;
    start: number;
    premium: number;
    pro: number;
  };
  recentMovements: FinancialMovement[];`,
    `  annualSubscriptions: {
    total: number;
    start: number;
    premium: number;
    pro: number;
  };
  annualSalesHistory: {
    total: number;
    start: number;
    premium: number;
    pro: number;
  };
  recentMovements: FinancialMovement[];`,
  );
}

const chartsAnchor = `      <div className="grid gap-6 lg:grid-cols-2">`;
const annualBlock = `      <Card className="relative overflow-hidden border-white/[0.07] bg-[#0d1015] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.22)]">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Assinaturas</p>
          <h3 className="mt-1 text-base font-semibold text-white">Planos Anuais</h3>
          <p className="mt-1 text-xs text-zinc-600">Assinaturas anuais ativas no Stripe.</p>
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
if (!finance.includes(">Planos Anuais</h3>")) {
  if (!finance.includes(chartsAnchor)) throw new Error("Finance annual UI insertion anchor not found");
  finance = finance.replace(chartsAnchor, annualBlock + chartsAnchor);
}

const annualHistoryBlock = `      <Card className="relative overflow-hidden border-white/[0.07] bg-[#0d1015] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_18px_45px_rgba(0,0,0,.22)]">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Histórico</p>
          <h3 className="mt-1 text-base font-semibold text-white">Vendas de Planos Anuais</h3>
          <p className="mt-1 text-xs text-zinc-600">Pagamentos anuais confirmados, mesmo após cancelamento ou exclusão.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-white/[0.06] bg-black/15 p-4">
            <p className="text-2xl font-bold text-white">{summary?.annualSalesHistory?.total ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">Total vendido</p>
          </div>
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.035] p-4">
            <p className="text-2xl font-bold text-emerald-300">{summary?.annualSalesHistory?.start ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">START</p>
          </div>
          <div className="rounded-xl border border-violet-400/10 bg-violet-400/[0.035] p-4">
            <p className="text-2xl font-bold text-violet-300">{summary?.annualSalesHistory?.premium ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">PREMIUM</p>
          </div>
          <div className="rounded-xl border border-rose-400/10 bg-rose-400/[0.035] p-4">
            <p className="text-2xl font-bold text-rose-300">{summary?.annualSalesHistory?.pro ?? 0}</p>
            <p className="mt-1 text-xs text-zinc-500">PRO</p>
          </div>
        </div>
      </Card>

`;
if (!finance.includes(">Vendas de Planos Anuais</h3>")) {
  if (!finance.includes(chartsAnchor)) throw new Error("Finance annual history insertion anchor not found");
  finance = finance.replace(chartsAnchor, annualHistoryBlock + chartsAnchor);
}

const growthInterfaceAnchor = `  activationRate: number;
  newUsersThisWeek: number;`;
const growthInterfaceReplacement = `  activationRate: number;
  activeUsers: number;
  todayActions: number;
  newUsersThisWeek: number;`;
if (!overview.includes("  activeUsers: number;")) {
  if (!overview.includes(growthInterfaceAnchor)) throw new Error("Overview GrowthStats interface anchor not found");
  overview = overview.replace(growthInterfaceAnchor, growthInterfaceReplacement);
}

overview = overview.replace(
  'value={(stats?.activeUsers ?? 0).toString()}',
  'value={(growthStats?.activeUsers ?? 0).toString()}',
);
if (!overview.includes('value={(growthStats?.activeUsers ?? 0).toString()}')) {
  throw new Error("Overview active users metric was not connected to backend growth data");
}

const mediaStateAnchor = `  const [mediaMetrics, setMediaMetrics] = useState<MediaMetric[]>([]);`;
if (!activity.includes("const [realTodayActions, setRealTodayActions]")) {
  if (!activity.includes(mediaStateAnchor)) throw new Error("Activity metric state anchor not found");
  activity = activity.replace(
    mediaStateAnchor,
    `${mediaStateAnchor}\n  const [realTodayActions, setRealTodayActions] = useState<number | null>(null);`,
  );
}

const analyticsFetchBlock = `        const response = await fetch(\`${"${BASE}"}/api/admin/analytics?refresh=\${Date.now()}\`, {
          headers: token ? { Authorization: \`Bearer \${token}\` } : {},
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json() as { featureUsage?: MediaMetric[] };
        if (!cancelled) setMediaMetrics(data.featureUsage ?? []);`;
const metricsFetchBlock = `        const headers = token ? { Authorization: \`Bearer \${token}\` } : {};
        const [analyticsResponse, growthResponse] = await Promise.all([
          fetch(\`${"${BASE}"}/api/admin/analytics?refresh=\${Date.now()}\`, {
            headers,
            credentials: "include",
            cache: "no-store",
          }),
          fetch(\`${"${BASE}"}/api/admin/growth-stats?refresh=\${Date.now()}\`, {
            headers,
            credentials: "include",
            cache: "no-store",
          }),
        ]);
        if (analyticsResponse.ok) {
          const data = await analyticsResponse.json() as { featureUsage?: MediaMetric[] };
          if (!cancelled) setMediaMetrics(data.featureUsage ?? []);
        }
        if (growthResponse.ok) {
          const growth = await growthResponse.json() as { todayActions?: number };
          if (!cancelled) setRealTodayActions(Number(growth.todayActions ?? 0));
        }`;
if (!activity.includes("growthResponse")) {
  if (!activity.includes(analyticsFetchBlock)) throw new Error("Activity analytics fetch anchor not found");
  activity = activity.replace(analyticsFetchBlock, metricsFetchBlock);
}

activity = activity.replace(
  `        if (!cancelled) setMediaMetrics([]);`,
  `        if (!cancelled) {
          setMediaMetrics([]);
          setRealTodayActions(null);
        }`,
);

activity = activity.replace(
  `{ label: "Hoje", value: isLoading ? null : kpis.today, sub: "ações registradas",`,
  `{ label: "Hoje", value: isLoading ? null : (realTodayActions ?? kpis.today), sub: "ações registradas",`,
);
if (!activity.includes('(realTodayActions ?? kpis.today)')) {
  throw new Error("Activity Hoje card was not connected without changing chart return shape");
}

for (const marker of [
  ">Planos Anuais</h3>",
  "summary?.annualSubscriptions?.total",
  "summary?.annualSubscriptions?.start",
  "summary?.annualSubscriptions?.premium",
  "summary?.annualSubscriptions?.pro",
  ">Vendas de Planos Anuais</h3>",
  "summary?.annualSalesHistory?.total",
  "summary?.annualSalesHistory?.start",
  "summary?.annualSalesHistory?.premium",
  "summary?.annualSalesHistory?.pro",
]) {
  if (!finance.includes(marker)) throw new Error(`Finance annual UI marker missing: ${marker}`);
}
for (const marker of [
  "activeUsers: number;",
  'value={(growthStats?.activeUsers ?? 0).toString()}',
]) {
  if (!overview.includes(marker)) throw new Error(`Overview live metric marker missing: ${marker}`);
}
for (const marker of [
  "const [realTodayActions, setRealTodayActions]",
  "/api/admin/growth-stats?refresh=",
  "realTodayActions ?? kpis.today",
]) {
  if (!activity.includes(marker)) throw new Error(`Activity live metric marker missing: ${marker}`);
}

for (const forbidden of [
  "priceId?: string | null",
  "interval?: string | null",
  "priceId: {item.priceId",
  "interval: {item.interval",
]) {
  if (finance.includes(forbidden)) throw new Error(`Visible Finance diagnostic detected: ${forbidden}`);
}

fs.writeFileSync(financePath, finance);
fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(activityPath, activity);
console.log("Active annual plans, permanent annual sales history and existing live metrics are connected.");
