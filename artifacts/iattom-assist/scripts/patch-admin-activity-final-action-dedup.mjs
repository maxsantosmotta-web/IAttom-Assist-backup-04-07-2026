import fs from "node:fs";

const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);
let activity = fs.readFileSync(activityPath, "utf8");

if (!activity.includes("const finalActionChart =")) {
  const returnMarker = "    return { kpis:";
  const returnIndex = activity.indexOf(returnMarker);
  if (returnIndex === -1) {
    throw new Error("Final Activity return marker not found");
  }

  const finalFilter = `    const productSearchRows = actionChart.filter(({ label }) => /busc.*produto/i.test(String(label)));
    const strongestProductSearchValue = productSearchRows.reduce(
      (max, item) => Math.max(max, Number(item.value) || 0),
      0,
    );
    let keptProductSearch = false;
    const finalActionChart = actionChart.filter(({ label, value }) => {
      if (!/busc.*produto/i.test(String(label))) return true;
      if (keptProductSearch || Number(value) !== strongestProductSearchValue) return false;
      keptProductSearch = true;
      return true;
    });

`;

  activity = activity.slice(0, returnIndex) + finalFilter + activity.slice(returnIndex);
}

const originalReturn = "return { kpis: { today, week, month, avgDaily }, dailyChart, moduleChart, actionChart };";
const finalReturn = "return { kpis: { today, week, month, avgDaily }, dailyChart, moduleChart, actionChart: finalActionChart };";

if (activity.includes(originalReturn)) {
  activity = activity.replace(originalReturn, finalReturn);
} else if (!activity.includes(finalReturn)) {
  throw new Error("Final Activity chart return shape not found");
}

fs.writeFileSync(activityPath, activity);
console.log("Final Activity chart keeps only the strongest product-search action series.");
