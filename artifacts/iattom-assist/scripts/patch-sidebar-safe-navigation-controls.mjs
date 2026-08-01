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
      "/dashboard/prompts": "Criar Prompt",
      "/dashboard/creative-generator": creativeEntry === "video" ? "Vídeo com efeito" : "Gerar imagem",
      "/dashboard/create-campaign": "Criar Campanha",
      "/dashboard/history": "Atividades",
    };

    const title = routeTitles[location];
    if (!title) return;

    let refreshCleanup: (() => void) | null = null;

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

      if (location === "/dashboard/history") {
        const refresh = Array.from(main.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => (button.textContent ?? "").trim() === "Atualizar");
        if (refresh) {
          const reload = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            window.location.reload();
          };
          refresh.addEventListener("click", reload, true);
          refreshCleanup = () => refresh.removeEventListener("click", reload, true);
        }
      }

      if (location === "/dashboard/prompts") {
        const promptBack = Array.from(main.querySelectorAll<HTMLElement>("button, a"))
          .find((control) => /voltar ao painel|voltar para o painel|voltar ao dashboard|voltar para o dashboard/i.test((control.textContent ?? "").trim()));
        if (promptBack) promptBack.textContent = "Voltar";
      }
    };

    const timer = window.setTimeout(placeControls, 0);
    const observer = new MutationObserver(() => {
      if (!document.querySelector("[data-iattom-back-to-dashboard]")) placeControls();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      refreshCleanup?.();
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
console.log("Dashboard plan block removed and Back/Refresh controls aligned safely.");
