import { readFileSync, writeFileSync } from "node:fs";

const analyticsUrl = new URL("../src/pages/dashboard/Analytics.tsx", import.meta.url);
let source = readFileSync(analyticsUrl, "utf8");

source = source.replace(
  '<BarChart data={chartModules} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>',
  '<BarChart data={chartModules} margin={{ top: 0, right: 0, left: -20, bottom: 18 }}>',
);

source = source.replace(
  '<XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />',
  '<XAxis dataKey="label" interval={0} minTickGap={0} height={42} angle={-18} textAnchor="end" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />',
);

const required = [
  'interval={0}',
  'minTickGap={0}',
  'height={42}',
  'angle={-18}',
  'bottom: 18',
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Activity chart label marker missing: ${marker}`);
}

writeFileSync(analyticsUrl, source);
console.log("All activity module labels are forced visible without changing counts.");
