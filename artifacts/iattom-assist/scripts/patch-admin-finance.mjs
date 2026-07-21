import { readFileSync, writeFileSync } from "node:fs";

function update(url, transform) {
  const source = readFileSync(url, "utf8");
  const next = transform(source);
  writeFileSync(url, next);
}

const appUrl = new URL("../src/App.tsx", import.meta.url);
update(appUrl, (source) => {
  if (!source.includes("const AdminFinance = lazy")) {
    source = source.replace(
      'const AdminActivity = lazy(() => import("@/pages/admin/AdminActivity").then((m) => ({ default: m.AdminActivity })));',
      'const AdminActivity = lazy(() => import("@/pages/admin/AdminActivity").then((m) => ({ default: m.AdminActivity })));\nconst AdminFinance = lazy(() => import("@/pages/admin/AdminFinance").then((m) => ({ default: m.AdminFinance })));',
    );
  }
  if (!source.includes('path="/admin/financeiro"')) {
    source = source.replace(
      '<Route path="/admin/activity" component={AdminActivity} />',
      '<Route path="/admin/activity" component={AdminActivity} />\n      <Route path="/admin/financeiro" component={AdminFinance} />',
    );
  }
  return source;
});

const layoutUrl = new URL("../src/components/layout/AdminLayout.tsx", import.meta.url);
update(layoutUrl, (source) => {
  if (!source.includes("Landmark,")) {
    source = source.replace("  Webhook,", "  Webhook,\n  Landmark,");
  }
  if (!source.includes('href: "/admin/financeiro"')) {
    source = source.replace(
      '  { href: "/admin/activity", label: "Atividade", icon: Activity },',
      '  { href: "/admin/activity", label: "Atividade", icon: Activity },\n  { href: "/admin/financeiro", label: "Financeiro", icon: Landmark },',
    );
  }
  return source;
});

const financeUrl = new URL("../src/pages/admin/AdminFinance.tsx", import.meta.url);
update(financeUrl, (source) => source
  .replace(/\$\{item\.action\} \$\{item\.details \?\? ""\}/g, '${item.action} ${item.module ?? ""}')
  .replace('{item.details && <p className="mt-0.5 text-[10px] text-zinc-600">{item.details}</p>}', '<p className="mt-0.5 text-[10px] text-zinc-600">{item.module}</p>')
);

console.log("Admin Finance module wired into menu and routes");
