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
const activitySummaryType = `type MediaMetric = { name: string; count: number };
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
    `${mediaStateAnchor}\n  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);`,
  );
}

const oldFetchBlock = `        const response = await fetch(\`${"${BASE}"}/api/admin/analytics?refresh=\${Date.now()}\`, {
          headers: token ? { Authorization: \`Bearer \${token}\` } : {},
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json() as { featureUsage?: MediaMetric[] };
        if (!cancelled) setMediaMetrics(data.featureUsage ?? []);`;

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

const newFetchBlock = `        const headers = token ? { Authorization: \`Bearer \${token}\` } : {};
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
  if (activity.includes(intermediateFetchBlock)) {
    activity = activity.replace(intermediateFetchBlock, newFetchBlock);
  } else if (activity.includes(oldFetchBlock)) {
    activity = activity.replace(oldFetchBlock, newFetchBlock);
  } else {
    throw new Error("Activity analytics fetch block not found in original or intermediate shape");
  }
}

activity = activity.replace(
  `      } catch {
        if (!cancelled) setMediaMetrics([]);
      }`,
  `      } catch {
        if (!cancelled) {
          setMediaMetrics([]);
          setActivitySummary(null);
        }
      }`,
);
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
const avgReplacement = `    const resolvedToday = activitySummary?.today ?? today;
    const resolvedWeek = activitySummary?.last7Days ?? week;
    const resolvedMonth = activitySummary?.last30Days ?? month;
    const avgDaily = resolvedWeek > 0 ? (resolvedWeek / 7).toFixed(1) : "0";`;
if (!activity.includes("const resolvedToday = activitySummary?.today ?? today;")) {
  if (!activity.includes(avgAnchor)) throw new Error("Activity KPI calculation anchor not found");
  activity = activity.replace(avgAnchor, avgReplacement);
}

const dailyChartAnchor = `    const dailyChart = days14.map((key) => ({ label: shortDay(key), value: dailyMap[key] }));`;
const dailyChartReplacement = `    if (activitySummary?.daily14) {
      for (const row of activitySummary.daily14) {
        if (row.day in dailyMap) dailyMap[row.day] = Number(row.total ?? 0);
      }
    }
    const dailyChart = days14.map((key) => ({ label: shortDay(key), value: dailyMap[key] }));`;
if (!activity.includes("activitySummary?.daily14")) {
  if (!activity.includes(dailyChartAnchor)) throw new Error("Activity daily chart anchor not found");
  activity = activity.replace(dailyChartAnchor, dailyChartReplacement);
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

const summaryDonutOld = `  const featureSummaryDonut = featureData
    .filter((item) => Number(item.percentage || 0) > 0)
    .map((item) => ({ label: item.name, value: Number(item.percentage || 0), color: item.fill }));`;
const summaryDonutNew = `  const visibleFeatureCounts = featureData
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
  }));`;
if (!analytics.includes("const visibleFeatureCounts = featureData")) {
  if (!analytics.includes(summaryDonutOld)) throw new Error("Analytics percentage donut anchor not found");
  analytics = analytics.replace(summaryDonutOld, summaryDonutNew);
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
    throw new Error(`Frontend final metric marker missing: ${marker}`);
  }
}

fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(activityPath, activity);
fs.writeFileSync(analyticsPath, analytics);
console.log("Admin totals, activity periods, labels and displayed percentages are consistent.");
