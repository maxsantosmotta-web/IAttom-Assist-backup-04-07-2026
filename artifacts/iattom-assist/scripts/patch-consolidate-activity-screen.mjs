import { readFileSync, writeFileSync } from "node:fs";

const sidebarUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let sidebar = readFileSync(sidebarUrl, "utf8");

sidebar = sidebar
  .replace('  { href: "/dashboard/history", label: "Atividades", icon: Clock },\n', '')
  .replace('  { href: "/dashboard/analytics", label: "Análises", icon: BarChart2 },', '  { href: "/dashboard/analytics", label: "Atividades", icon: BarChart2 },');

if (sidebar.includes('href: "/dashboard/history", label: "Atividades"')) {
  throw new Error("Old activity navigation item still exists");
}
if (!sidebar.includes('href: "/dashboard/analytics", label: "Atividades"')) {
  throw new Error("Consolidated activity navigation item missing");
}
writeFileSync(sidebarUrl, sidebar);

const appUrl = new URL("../src/App.tsx", import.meta.url);
let app = readFileSync(appUrl, "utf8");

app = app.replace(
  '      <Route path="/dashboard/history" component={History} />',
  '      <Route path="/dashboard/history"><Redirect to="/dashboard/analytics" /></Route>',
);

if (!app.includes('<Route path="/dashboard/history"><Redirect to="/dashboard/analytics" /></Route>')) {
  throw new Error("Legacy activity route redirect missing");
}
writeFileSync(appUrl, app);

console.log("Activity navigation consolidated into the analytics-backed screen.");
