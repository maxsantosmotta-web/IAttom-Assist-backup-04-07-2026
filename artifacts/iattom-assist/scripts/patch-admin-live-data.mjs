import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const before = "if (res.ok) setGrowthStats(await res.json() as GrowthStats);";
const after = `if (res.ok) {
          const raw = await res.json() as Partial<GrowthStats>;
          setGrowthStats({
            mrr: Number(raw.mrr) || 0,
            activeSubscribers: Number(raw.activeSubscribers) || 0,
            totalUsers: Number(raw.totalUsers) || 0,
            conversionRate: Number(raw.conversionRate) || 0,
            activationRate: Number(raw.activationRate) || 0,
            newUsersThisWeek: Number(raw.newUsersThisWeek) || 0,
            newUsersThisMonth: Number(raw.newUsersThisMonth) || 0,
            creditsSpentThisMonth: Number(raw.creditsSpentThisMonth) || 0,
            churnRisk: Array.isArray(raw.churnRisk) ? raw.churnRisk : [],
            planBreakdown: {
              free: Number(raw.planBreakdown?.free) || 0,
              pro: Number(raw.planBreakdown?.pro) || 0,
              business: Number(raw.planBreakdown?.business) || 0,
              agency: Number(raw.planBreakdown?.agency) || 0,
            },
          });
        } else {
          const [statsRes, analyticsRes] = await Promise.all([
            fetch(\`\${BASE}/api/admin/stats\`, {
              headers: { Authorization: \`Bearer \${token}\` },
              credentials: "include",
            }),
            fetch(\`\${BASE}/api/admin/analytics\`, {
              headers: { Authorization: \`Bearer \${token}\` },
              credentials: "include",
            }),
          ]);

          const fallbackStats = statsRes.ok ? await statsRes.json() as any : {};
          const fallbackAnalytics = analyticsRes.ok ? await analyticsRes.json() as any : {};
          const planRows = Array.isArray(fallbackAnalytics?.planRevenue) ? fallbackAnalytics.planRevenue : [];
          const planUsers = (name: string) => Number(planRows.find((row: any) => String(row?.plan ?? "").toLowerCase() === name)?.users) || 0;
          const planMrr = planRows.reduce((sum: number, row: any) => sum + (Number(row?.mrr) || 0), 0);
          const free = Number(fallbackStats?.planBreakdown?.free) || planUsers("free");
          const pro = Number(fallbackStats?.planBreakdown?.pro) || planUsers("pro");
          const business = Number(fallbackStats?.planBreakdown?.business) || planUsers("business");
          const agency = Number(fallbackStats?.planBreakdown?.agency) || planUsers("agency");
          const totalUsers = Number(fallbackStats?.totalUsers) || 0;
          const activeSubscribers = pro + business + agency;
          const totalProjects = Number(fallbackStats?.totalProjects) || 0;

          setGrowthStats({
            mrr: planMrr,
            activeSubscribers,
            totalUsers,
            conversionRate: totalUsers > 0 ? Math.round((activeSubscribers / totalUsers) * 1000) / 10 : 0,
            activationRate: totalUsers > 0 ? Math.round((Math.min(totalProjects, totalUsers) / totalUsers) * 1000) / 10 : 0,
            newUsersThisWeek: 0,
            newUsersThisMonth: Number(fallbackStats?.newUsersThisMonth) || 0,
            creditsSpentThisMonth: 0,
            churnRisk: [],
            planBreakdown: { free, pro, business, agency },
          });
        }`;

if (source.includes(after)) {
  console.log("Admin live-data fallback already applied.");
} else if (source.includes(before)) {
  source = source.replace(before, after);
  writeFileSync(fileUrl, source);
  console.log("Admin live-data fallback applied.");
} else {
  console.warn("Admin live-data fallback marker not found; no source was changed.");
}
