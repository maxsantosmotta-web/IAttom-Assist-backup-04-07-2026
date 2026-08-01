import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const currentPageBlock = `  const currentPage = location === "/dashboard/creative-generator"
    ? (creativeEntry === "video" ? "Vídeo com efeito" : "Gerar imagem")
    : navItems.find((item) => item.href === location)?.label || "Dashboard";`;

const safeControlsBlock = `${currentPageBlock}

  useEffect(() => {
    const routeTitles: Record<string, string> = {
      "/dashboard": "Bem-vindo",
      "/dashboard/settings": "Configurações",
      "/dashboard/credits": "Créditos",
      "/dashboard/billing": "Assinatura e Planos",
      "/dashboard/trash": "Lixeira",
      "/dashboard/projects": "Biblioteca",
    };

    const title = routeTitles[location];
    if (!title) return;

    const makeBackButton = () => {
      const back = document.createElement("button");
      back.type = "button";
      back.dataset.iattomBackToDashboard = "true";
      back.textContent = "Voltar";
      back.className = "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-3 text-sm font-medium text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white";
      back.addEventListener("click", () => window.location.assign("/dashboard"));
      return back;
    };

    const placeControls = () => {
      const main = document.querySelector("main");
      if (!main) return;

      main.querySelectorAll("[data-iattom-back-to-dashboard], [data-iattom-dashboard-refresh]").forEach((node) => node.remove());

      const headings = Array.from(main.querySelectorAll<HTMLElement>("h1, h2"));
      const heading = headings.find((node) => (node.textContent ?? "").trim().startsWith(title));
      if (!heading) return;

      let header: HTMLElement | null = heading.parentElement;
      for (let depth = 0; header && depth < 5; depth += 1) {
        if (header.classList.contains("justify-between")) break;
        header = header.parentElement;
      }
      if (!header) return;

      if (location === "/dashboard") {
        const rightBlock = header.lastElementChild as HTMLElement | null;
        if (!rightBlock || rightBlock === heading.parentElement) return;

        rightBlock.replaceChildren();
        rightBlock.className = "shrink-0 flex items-center gap-2";
        rightBlock.appendChild(makeBackButton());

        const refresh = document.createElement("button");
        refresh.type = "button";
        refresh.dataset.iattomDashboardRefresh = "true";
        refresh.textContent = "↻ Atualizar";
        refresh.className = "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white";
        refresh.addEventListener("click", () => window.location.reload());
        rightBlock.appendChild(refresh);
        return;
      }

      header.appendChild(makeBackButton());
    };

    const timer = window.setTimeout(placeControls, 0);
    const observer = new MutationObserver(() => {
      if (!document.querySelector("[data-iattom-back-to-dashboard]")) placeControls();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      document.querySelectorAll("[data-iattom-back-to-dashboard], [data-iattom-dashboard-refresh]").forEach((node) => node.remove());
    };
  }, [location, creativeEntry]);`;

if (!source.includes("data-iattom-back-to-dashboard")) {
  if (!source.includes(currentPageBlock)) {
    throw new Error("Sidebar current-page marker not found");
  }
  source = source.replace(currentPageBlock, safeControlsBlock);
}

writeFileSync(fileUrl, source, "utf8");

const historyUrl = new URL("../src/pages/dashboard/History.tsx", import.meta.url);
let historySource = readFileSync(historyUrl, "utf8");

const historyRefreshButton = `          <Button
            size="sm" variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1"
          >
            <RefreshCw className={\`w-3.5 h-3.5 \${isFetching ? "animate-spin" : ""}\`} />
            Atualizar
          </Button>`;

const historyControls = `          <div className="flex shrink-0 items-center gap-2 mt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.location.assign("/dashboard")}
              className="h-9 border-white/15 bg-white/[0.04] px-3 text-sm font-medium text-zinc-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            >
              Voltar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.location.reload()}
              className="h-9 border-white/15 bg-white/[0.04] px-3 text-sm font-semibold text-zinc-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </Button>
          </div>`;

if (!historySource.includes('onClick={() => window.location.assign("/dashboard")}')) {
  if (!historySource.includes(historyRefreshButton)) {
    throw new Error("History refresh button marker not found");
  }
  historySource = historySource.replace(historyRefreshButton, historyControls);
}

writeFileSync(historyUrl, historySource, "utf8");

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let creativeSource = readFileSync(creativeUrl, "utf8");

const creativeAlreadyPatched = creativeSource.includes('data-iattom-creative-controls="true"');
if (!creativeAlreadyPatched) {
  const creativeButtonPattern = /([ \t]*)<Button\b(?=[\s\S]*?setIsRefreshing\(true\))(?=[\s\S]*?>\s*<RefreshCw[\s\S]*?Atualizar\s*<\/Button>)[\s\S]*?<\/Button>/;
  const match = creativeSource.match(creativeButtonPattern);
  if (!match) {
    throw new Error("CreativeGenerator refresh control not found");
  }

  const indent = match[1];
  const originalButton = match[0].trimStart()
    .replace(/className="[^"]*"/, 'className="h-9 border-white/10 text-xs gap-1.5"');

  const creativeControls = `${indent}<div data-iattom-creative-controls="true" className="flex items-center gap-2 shrink-0 mt-1">\n${indent}  ${originalButton.replace(/\n/g, `\n${indent}  `)}\n${indent}  <Button type="button" size="sm" variant="outline" onClick={() => window.location.assign("/dashboard")} className="h-9 border-white/10 text-xs">\n${indent}    Voltar\n${indent}  </Button>\n${indent}</div>`;

  creativeSource = creativeSource.replace(match[0], creativeControls);
}

writeFileSync(creativeUrl, creativeSource, "utf8");

const campaignUrl = new URL("../src/pages/dashboard/CreateCampaign.tsx", import.meta.url);
let campaignSource = readFileSync(campaignUrl, "utf8");

if (!campaignSource.includes('data-iattom-campaign-controls="true"')) {
  const campaignButtonPattern = /([ \t]*)\{showResult && \(\s*(<Button\b[\s\S]*?<RefreshCw[\s\S]*?Atualizar\s*<\/Button>)\s*\)\}/;
  const match = campaignSource.match(campaignButtonPattern);
  if (!match) {
    throw new Error("CreateCampaign refresh control not found");
  }

  const indent = match[1];
  const campaignControls = `${indent}<div data-iattom-campaign-controls="true" className="flex items-center gap-2 shrink-0 mt-1">\n${indent}  <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()} className="h-9 border-white/10 text-xs gap-1.5">\n${indent}    <RefreshCw className="w-3.5 h-3.5" />\n${indent}    Atualizar\n${indent}  </Button>\n${indent}  <Button type="button" size="sm" variant="outline" onClick={() => window.location.assign("/dashboard")} className="h-9 border-white/10 text-xs">\n${indent}    Voltar\n${indent}  </Button>\n${indent}</div>`;

  campaignSource = campaignSource.replace(match[0], campaignControls);
}

writeFileSync(campaignUrl, campaignSource, "utf8");
console.log("Dashboard controls preserved; Activities, CreativeGenerator and CreateCampaign controls standardized.");
