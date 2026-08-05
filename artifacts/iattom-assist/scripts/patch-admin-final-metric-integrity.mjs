import fs from "node:fs";

const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);
const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);

let overview = fs.readFileSync(overviewPath, "utf8");
let activity = fs.readFileSync(activityPath, "utf8");
let analytics = fs.readFileSync(analyticsPath, "utf8");

overview = overview.replace('label="Usuários Ativos"', 'label="Assinantes Ativos"');
if (!overview.includes('label="Assinantes Ativos"')) {
  throw new Error("Overview active-subscriber label was not applied");
}

const mediaTypeAnchor = `type MediaMetric = { name: string; count: number };`;
const activitySummaryType = `${mediaTypeAnchor}
type ActivitySummary = {
  today: number;
  last7Days: number;
  last30Days: number;
  daily14: Array<{ day: string; total: number }>;
};`;
if (!activity.includes("type ActivitySummary =")) {
  if (!activity.includes(mediaTypeAnchor)) throw new Error("Activity summary type anchor not found");
  activity = activity.replace(mediaTypeAnchor, activitySummaryType);
}

const mediaStateAnchor = `  const [mediaMetrics, setMediaMetrics] = useState<MediaMetric[]>([]);`;
if (!activity.includes("const [activitySummary, setActivitySummary]")) {
  if (!activity.includes(mediaStateAnchor)) throw new Error("Activity summary state anchor not found");
  activity = activity.replace(
    mediaStateAnchor,
    `${mediaStateAnchor}
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);`,
  );
}

const intermediateFetchBlock = `        const headers = token ? { Authorization: \`Bearer \${token}\` } : {};
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

const finalFetchBlock = `        const headers = token ? { Authorization: \`Bearer \${token}\` } : {};
        const [analyticsResponse, summaryResponse] = await Promise.all([
          fetch(\`${"${BASE}"}/api/admin/analytics?refresh=\${Date.now()}\`, {
            headers,
            credentials: "include",
            cache: "no-store",
          }),
          fetch(\`${"${BASE}"}/api/admin/activity-summary?refresh=\${Date.now()}\`, {
            headers,
            credentials: "include",
            cache: "no-store",
          }),
        ]);
        if (analyticsResponse.ok) {
          const data = await analyticsResponse.json() as { featureUsage?: MediaMetric[] };
          if (!cancelled) setMediaMetrics(data.featureUsage ?? []);
        }
        if (summaryResponse.ok) {
          const summary = await summaryResponse.json() as ActivitySummary;
          if (!cancelled) setActivitySummary(summary);
        }`;

if (!activity.includes("/api/admin/activity-summary?refresh=")) {
  if (!activity.includes(intermediateFetchBlock)) {
    throw new Error("Mapped intermediate Activity fetch block not found");
  }
  activity = activity.replace(intermediateFetchBlock, finalFetchBlock);
}

activity = activity.replace(
  `      } catch {
        if (!cancelled) {
          setMediaMetrics([]);
          setRealTodayActions(null);
        }
      }`,
  `      } catch {
        if (!cancelled) {
          setMediaMetrics([]);
          setActivitySummary(null);
        }
      }`,
);

const avgAnchor = `    const avgDaily = week > 0 ? (week / 7).toFixed(1) : "0";`;
if (!activity.includes("const resolvedToday = activitySummary?.today ?? today;")) {
  if (!activity.includes(avgAnchor)) throw new Error("Activity KPI anchor not found");
  activity = activity.replace(
    avgAnchor,
    `    const resolvedToday = activitySummary?.today ?? today;
    const resolvedWeek = activitySummary?.last7Days ?? week;
    const resolvedMonth = activitySummary?.last30Days ?? month;
    const avgDaily = resolvedWeek > 0 ? (resolvedWeek / 7).toFixed(1) : "0";`,
  );
}

const dailyAnchor = `    const dailyChart = days14.map((key) => ({ label: shortDay(key), value: dailyMap[key] }));`;
if (!activity.includes("activitySummary?.daily14")) {
  if (!activity.includes(dailyAnchor)) throw new Error("Activity daily chart anchor not found");
  activity = activity.replace(
    dailyAnchor,
    `    if (activitySummary?.daily14) {
      for (const row of activitySummary.daily14) {
        if (row.day in dailyMap) dailyMap[row.day] = Number(row.total ?? 0);
      }
    }
    const dailyChart = days14.map((key) => ({ label: shortDay(key), value: dailyMap[key] }));`,
  );
}

activity = activity.replace(
  `    return { kpis: { today, week, month, avgDaily }, dailyChart, moduleChart, actionChart };`,
  `    return { kpis: { today: resolvedToday, week: resolvedWeek, month: resolvedMonth, avgDaily }, dailyChart, moduleChart, actionChart };`,
);
activity = activity.replace(
  `  }, [items, mediaMetrics]);`,
  `  }, [items, mediaMetrics, activitySummary]);`,
);
activity = activity.replace(
  `{ label: "Hoje", value: isLoading ? null : (realTodayActions ?? kpis.today), sub: "ações registradas",`,
  `{ label: "Hoje", value: isLoading ? null : kpis.today, sub: "ações registradas",`,
);

const percentageBlock = `  const visibleFeatureCounts = featureData
    .filter((item) => Number(item.count || 0) > 0)
    .map((item) => ({ label: item.name, count: Number(item.count || 0), color: item.fill }));
  const visibleFeatureTotal = visibleFeatureCounts.reduce((sum, item) => sum + item.count, 0);
  const exactPercentages = visibleFeatureCounts.map((item) => ({
    ...item,
    exact: visibleFeatureTotal > 0 ? (item.count / visibleFeatureTotal) * 100 : 0,
  }));
  const basePercentages = exactPercentages.map((item) => Math.floor(item.exact));
  let remainingPercentage = 100 - basePercentages.reduce((sum, value) => sum + value, 0);
  const remainderOrder = exactPercentages
    .map((item, index) => ({ index, remainder: item.exact - basePercentages[index] }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let index = 0; index < remainderOrder.length && remainingPercentage > 0; index += 1) {
    basePercentages[remainderOrder[index].index] += 1;
    remainingPercentage -= 1;
  }
  const featureSummaryDonut = visibleFeatureCounts.map((item, index) => ({
    label: item.label,
    value: basePercentages[index] ?? 0,
    color: item.color,
  }));

`;

if (!analytics.includes("const visibleFeatureCounts = featureData")) {
  const percentageStart = analytics.indexOf("  const featureSummaryDonut = featureData");
  const percentageEnd = analytics.indexOf("  const creditDayMap = new Map(", percentageStart);
  if (percentageStart === -1 || percentageEnd === -1 || percentageEnd <= percentageStart) {
    throw new Error("Mapped Analytics percentage block boundaries not found");
  }
  analytics = analytics.slice(0, percentageStart) + percentageBlock + analytics.slice(percentageEnd);
}

for (const marker of [
  'label="Assinantes Ativos"',
  "/api/admin/activity-summary?refresh=",
  "resolvedToday",
  "resolvedWeek",
  "resolvedMonth",
  "activitySummary?.daily14",
  "const visibleFeatureCounts = featureData",
  "remainingPercentage",
]) {
  if (!overview.includes(marker) && !activity.includes(marker) && !analytics.includes(marker)) {
    throw new Error(`Final admin metric marker missing: ${marker}`);
  }
}

fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(activityPath, activity);
fs.writeFileSync(analyticsPath, analytics);
console.log("Final admin metrics were applied against the mapped post-patch source shapes.");
