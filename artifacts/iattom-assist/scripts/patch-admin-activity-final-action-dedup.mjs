import fs from "node:fs";

const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);
let activity = fs.readFileSync(activityPath, "utf8");

if (!activity.includes("const finalActionChart =")) {
  const returnMarker = "    return { kpis:";
  const returnIndex = activity.indexOf(returnMarker);
  if (returnIndex === -1) {
    throw new Error("Final Activity return marker not found");
  }

  const finalFilter = `    const finalActionChart = actionChart.length > 0 ? actionChart.slice(0, -1) : actionChart;\n\n`;
  activity = activity.slice(0, returnIndex) + finalFilter + activity.slice(returnIndex);
}

const returnShapes = [
  {
    current: "return { kpis: { today, week, month, avgDaily }, dailyChart, moduleChart, actionChart };",
    final: "return { kpis: { today, week, month, avgDaily }, dailyChart, moduleChart, actionChart: finalActionChart };",
  },
  {
    current: "return { kpis: { today: resolvedToday, week: resolvedWeek, month: resolvedMonth, avgDaily }, dailyChart, moduleChart, actionChart };",
    final: "return { kpis: { today: resolvedToday, week: resolvedWeek, month: resolvedMonth, avgDaily }, dailyChart, moduleChart, actionChart: finalActionChart };",
  },
];

let redirected = activity.includes("actionChart: finalActionChart");
if (!redirected) {
  for (const shape of returnShapes) {
    if (!activity.includes(shape.current)) continue;
    activity = activity.replace(shape.current, shape.final);
    redirected = true;
    break;
  }
}

if (!redirected || !activity.includes("actionChart: finalActionChart")) {
  throw new Error("Final Activity chart return shape not found in original or resolved metrics form");
}

for (const marker of [
  "const finalActionChart =",
  "actionChart: finalActionChart",
]) {
  if (!activity.includes(marker)) throw new Error(`Final Activity dedup marker missing: ${marker}`);
}

fs.writeFileSync(activityPath, activity);
console.log("Final Activity action chart dedup remains compatible with resolved period metrics.");

await import("./patch-admin-analytics-remove-referral-code-card.mjs");
