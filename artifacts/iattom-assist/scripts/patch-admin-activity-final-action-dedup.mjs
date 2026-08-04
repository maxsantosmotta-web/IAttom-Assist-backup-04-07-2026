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

const originalReturn = "return { kpis: { today, week, month, avgDaily }, dailyChart, moduleChart, actionChart };";
const finalReturn = "return { kpis: { today, week, month, avgDaily }, dailyChart, moduleChart, actionChart: finalActionChart };";

if (activity.includes(originalReturn)) {
  activity = activity.replace(originalReturn, finalReturn);
} else if (!activity.includes(finalReturn)) {
  throw new Error("Final Activity chart return shape not found");
}

if (!activity.includes("actionChart: finalActionChart")) {
  throw new Error("Final Activity chart return was not redirected");
}

fs.writeFileSync(activityPath, activity);
console.log("Final Activity action chart excludes only its last block.");

await import("./patch-admin-analytics-remove-referral-code-card.mjs");
