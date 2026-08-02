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
        refresh.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M21 12a9 9 0 0 0-15.17-6.52L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.17 6.52L21 16"/><path d="M16 16h5v5"/></svg><span>Atualizar</span>';
        refresh.className = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-transparent px-3 text-xs font-medium text-zinc-200 transition-colors hover:border-white/20 hover:text-white";
        refresh.addEventListener("click", () => window.location.reload());
        rightBlock.appendChild(refresh);

        const back = makeBackButton();
        back.className = "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-transparent px-3 text-xs font-medium text-zinc-200 transition-colors hover:border-white/20 hover:text-white";
        rightBlock.appendChild(back);
        return;
      }`;

  source = source.replace(match[0], dashboardBlock);
}

if (source.includes('refresh.textContent = "Atualizar";')) {
  source = source.replace(
    'refresh.textContent = "Atualizar";',
    `refresh.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M21 12a9 9 0 0 0-15.17-6.52L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.17 6.52L21 16"/><path d="M16 16h5v5"/></svg><span>Atualizar</span>';`,
  );
}

source = source.replace(
  'refresh.className = "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-transparent px-3 text-xs font-medium text-zinc-200 transition-colors hover:border-white/20 hover:text-white";',
  'refresh.className = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-transparent px-3 text-xs font-medium text-zinc-200 transition-colors hover:border-white/20 hover:text-white";',
);

for (const marker of [
  dashboardDatasetMarker,
  "refresh.innerHTML = '<svg",
  '<span>Atualizar</span>',
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
console.log("Dashboard controls standardized with refresh icon: Atualizar left and Voltar right.");
