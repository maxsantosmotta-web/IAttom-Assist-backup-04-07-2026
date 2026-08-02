import { readFileSync, writeFileSync } from "node:fs";

const sidebarUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let source = readFileSync(sidebarUrl, "utf8");

const dashboardDatasetMarker = 'rightBlock.dataset.iattomDashboardControls = "true"';

if (!source.includes(dashboardDatasetMarker)) {
  const dashboardBlockPattern = /      if \(location === "\/dashboard"\) \{[\s\S]*?        return;\n      \}/;
  const match = source.match(dashboardBlockPattern);

  if (!match) {
    throw new Error("Dashboard runtime controls block not found");
  }

  const dashboardBlock = `      if (location === "/dashboard") {
        const rightBlock = header.lastElementChild as HTMLElement | null;
        if (!rightBlock || rightBlock === heading.parentElement) return;

        rightBlock.replaceChildren();
        rightBlock.dataset.iattomDashboardControls = "true";
        rightBlock.className = "shrink-0 flex items-center gap-2";

        const refresh = document.createElement("button");
        refresh.type = "button";
        refresh.dataset.iattomDashboardRefresh = "true";
        refresh.textContent = "Atualizar";
        refresh.className = "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-transparent px-3 text-xs font-medium text-zinc-200 transition-colors hover:border-white/20 hover:text-white";
        refresh.addEventListener("click", () => window.location.reload());
        rightBlock.appendChild(refresh);

        const back = makeBackButton();
        back.className = "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-transparent px-3 text-xs font-medium text-zinc-200 transition-colors hover:border-white/20 hover:text-white";
        rightBlock.appendChild(back);
        return;
      }`;

  source = source.replace(match[0], dashboardBlock);
}

for (const marker of [
  dashboardDatasetMarker,
  'refresh.textContent = "Atualizar"',
  'rightBlock.appendChild(refresh)',
  'rightBlock.appendChild(back)',
]) {
  if (!source.includes(marker)) throw new Error(`Dashboard marker missing: ${marker}`);
}

const refreshPosition = source.indexOf("rightBlock.appendChild(refresh)");
const backPosition = source.indexOf("rightBlock.appendChild(back)", refreshPosition);
if (refreshPosition < 0 || backPosition < 0 || refreshPosition > backPosition) {
  throw new Error("Dashboard controls order is incorrect");
}

writeFileSync(sidebarUrl, source, "utf8");
console.log("Dashboard controls standardized: Atualizar left and Voltar right.");
