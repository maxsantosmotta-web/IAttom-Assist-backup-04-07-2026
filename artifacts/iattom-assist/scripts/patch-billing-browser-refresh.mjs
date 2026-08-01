import { readFile, writeFile } from "node:fs/promises";

const fileUrl = new URL("../src/pages/dashboard/Billing.tsx", import.meta.url);
let source = await readFile(fileUrl, "utf8");
const oldCode = "const handleBillingRefresh = () => { void refetchPlans(); void refetchSub(); void refetchMe(); void refetchCredits(); };";
const newCode = "const handleBillingRefresh = () => { window.location.reload(); };";

if (source.includes(newCode)) {
  console.log("Billing browser refresh already applied.");
} else {
  if (!source.includes(oldCode)) {
    throw new Error("Billing refresh handler marker not found.");
  }
  source = source.replace(oldCode, newCode);
  console.log("Billing refresh now reloads the browser page.");
}

const referralBlockPattern = /\n\s*\{\/\* ── Referral CTA \(only shown when user has active plan\) ─+ \*\/\}[\s\S]*?\n\s*\{\/\* ── Bottom note/;
if (referralBlockPattern.test(source)) {
  source = source.replace(referralBlockPattern, "\n\n      {/* ── Bottom note");
} else if (source.includes("Indique amigos e ganhe créditos") || source.includes("Ver Indicações")) {
  throw new Error("Billing referral block marker changed and was not removed.");
}

if (source.includes("Indique amigos e ganhe créditos") || source.includes("Ver Indicações")) {
  throw new Error("Billing referral CTA is still visible.");
}

await writeFile(fileUrl, source, "utf8");
console.log("Billing referral CTA removed from footer.");

// Run last so Help/Credits synchronization is applied after all source-rewriting patches.
await import("./patch-help-credit-react-query-sync.mjs");

// Isolamento por módulo: cada tela nasce com um ciclo novo e encerra o anterior.
const appUrl = new URL("../src/App.tsx", import.meta.url);
let app = await readFile(appUrl, "utf8");

const isolationImport = 'import { RouteRequestIsolation } from "@/components/RouteRequestIsolation";';
if (!app.includes(isolationImport)) {
  const importMarker = 'import { ErrorBoundary } from "@/components/ErrorBoundary";';
  if (!app.includes(importMarker)) throw new Error("Route isolation import marker not found.");
  app = app.replace(importMarker, `${importMarker}\n${isolationImport}`);
}

const oldRetry = 'defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 } },';
const isolatedRetry = 'defaultOptions: { queries: { retry: (failureCount, error) => error instanceof DOMException && error.name === "AbortError" ? false : failureCount < 1, refetchOnWindowFocus: false, staleTime: 30_000 } },';
if (app.includes(oldRetry)) {
  app = app.replace(oldRetry, isolatedRetry);
} else if (!app.includes(isolatedRetry)) {
  throw new Error("React Query retry marker not found for route isolation.");
}

const oldDashboardStart = 'function ProtectedDashboard() {\n  return <>';
const keyedDashboardStart = 'function ProtectedDashboard() {\n  const [dashboardLocation] = useLocation();\n  return <>';
if (app.includes(oldDashboardStart)) {
  app = app.replace(oldDashboardStart, keyedDashboardStart);
} else if (!app.includes(keyedDashboardStart)) {
  throw new Error("ProtectedDashboard lifecycle marker not found.");
}

const dashboardSwitch = '<Suspense fallback={<PageLoader />}><Switch>';
const keyedDashboardSwitch = '<Suspense fallback={<PageLoader />}><Switch key={dashboardLocation}>';
if (app.includes(dashboardSwitch)) {
  app = app.replace(dashboardSwitch, keyedDashboardSwitch);
} else if (!app.includes(keyedDashboardSwitch)) {
  throw new Error("Dashboard Switch key marker not found.");
}

const isolationMount = '<RouteRequestIsolation />';
if (!app.includes(isolationMount)) {
  const providerPattern = /(<QueryClientProvider client=\{queryClient\}>\s*<TooltipProvider>)/;
  if (!providerPattern.test(app)) throw new Error("Route isolation provider marker not found.");
  app = app.replace(providerPattern, `$1\n      <RouteRequestIsolation />`);
}

for (const marker of [
  isolationImport,
  isolationMount,
  'error.name === "AbortError" ? false',
  'const [dashboardLocation] = useLocation();',
  '<Switch key={dashboardLocation}>',
]) {
  if (!app.includes(marker)) throw new Error(`Module lifecycle marker missing: ${marker}`);
}

await writeFile(appUrl, app, "utf8");

const sidebarUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let sidebar = await readFile(sidebarUrl, "utf8");

const oldCreativeHandler = `              onClick={() => {
                if (!creativeMode) return;
                try { localStorage.setItem("iattom_creative_tab_v1", creativeMode); } catch { /* ignore */ }
                setCreativeEntry(creativeMode);
              }}`;
const isolatedCreativeHandler = `              onClick={() => {
                if (!creativeMode) return;
                const moduleKey = \`/dashboard/creative-generator:\${creativeMode}\`;
                window.dispatchEvent(new CustomEvent("iattom-module-change", { detail: { moduleKey } }));
                try { localStorage.setItem("iattom_creative_tab_v1", creativeMode); } catch { /* ignore */ }
                setCreativeEntry(creativeMode);
              }}`;

if (sidebar.includes(oldCreativeHandler)) {
  sidebar = sidebar.replace(oldCreativeHandler, isolatedCreativeHandler);
} else if (!sidebar.includes('window.dispatchEvent(new CustomEvent("iattom-module-change"')) {
  throw new Error("Creative module lifecycle handler marker not found.");
}

const pageTransitionPattern = /<PageTransition([^>]*)>\s*\{children\}\s*<\/PageTransition>/;
const pageTransitionMatch = sidebar.match(pageTransitionPattern);
if (!pageTransitionMatch) {
  throw new Error("Sidebar PageTransition lifecycle marker not found.");
}

const existingAttributes = pageTransitionMatch[1] ?? "";
if (!/\bkey\s*=/.test(existingAttributes)) {
  sidebar = sidebar.replace(
    pageTransitionPattern,
    '<PageTransition key={location === "/dashboard/creative-generator" ? creativeEntry : location}>{children}</PageTransition>',
  );
}

const finalPageTransitionMatch = sidebar.match(pageTransitionPattern);
const hasPageLifecycle = Boolean(finalPageTransitionMatch && /\bkey\s*=/.test(finalPageTransitionMatch[1] ?? ""));
if (!sidebar.includes('window.dispatchEvent(new CustomEvent("iattom-module-change"')) || !hasPageLifecycle) {
  throw new Error("Sidebar module lifecycle markers are incomplete.");
}

await writeFile(sidebarUrl, sidebar, "utf8");
console.log("Dashboard modules now remount independently; abandoned reads are cancelled and duplicate reads are coalesced.");
