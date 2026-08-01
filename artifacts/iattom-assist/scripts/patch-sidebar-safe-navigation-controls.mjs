import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

const routeConfigMarker = "const basePath = import.meta.env.BASE_URL.replace(/\\\/$/, \"\");";
const routeConfig = `${routeConfigMarker}\n\nconst backButtonRoutes = new Set([\n  \"/dashboard\",\n  \"/dashboard/settings\",\n  \"/dashboard/credits\",\n  \"/dashboard/billing\",\n  \"/dashboard/trash\",\n  \"/dashboard/projects\",\n  \"/dashboard/prompts\",\n  \"/dashboard/creative-generator\",\n  \"/dashboard/create-campaign\",\n  \"/dashboard/history\",\n]);\n\nconst fullPageRefreshRoutes = new Set([\n  \"/dashboard\",\n  \"/dashboard/settings\",\n  \"/dashboard/credits\",\n  \"/dashboard/trash\",\n  \"/dashboard/create-campaign\",\n  \"/dashboard/history\",\n]);`;

if (!source.includes("const backButtonRoutes = new Set")) {
  source = source.replace(routeConfigMarker, routeConfig);
}

const currentPageBlock = `  const currentPage = location === \"/dashboard/creative-generator\"\n    ? (creativeEntry === \"video\" ? \"Vídeo com efeito\" : \"Gerar imagem\")\n    : navItems.find((item) => item.href === location)?.label || \"Dashboard\";`;

const safeControlsBlock = `${currentPageBlock}\n  const showBackButton = backButtonRoutes.has(location);\n\n  useEffect(() => {\n    if (!fullPageRefreshRoutes.has(location) && location !== \"/dashboard/prompts\") return;\n\n    const updateControls = () => {\n      const controls = Array.from(document.querySelectorAll<HTMLElement>(\"button, a\"));\n\n      for (const control of controls) {\n        const label = control.textContent?.replace(/\\s+/g, \" \ ").trim() ?? \"\";\n\n        if (location === \"/dashboard/prompts\" && /voltar ao painel|voltar para o painel|voltar ao dashboard|voltar para o dashboard/i.test(label)) {\n          for (const node of Array.from(control.childNodes)) {\n            if (node.nodeType === Node.TEXT_NODE && /voltar/i.test(node.textContent ?? \"\")) {\n              node.textContent = \" Voltar\";\n            }\n          }\n          if (control.childNodes.length === 1) control.textContent = \"Voltar\";\n        }\n\n        if (!fullPageRefreshRoutes.has(location) || label !== \"Atualizar\") continue;\n\n        control.classList.add(\n          \"!h-9\", \"!px-3\", \"!text-sm\", \"!font-semibold\",\n          \"!text-primary\", \"!border-primary/35\", \"!bg-primary/10\",\n          \"hover:!bg-primary/20\", \"hover:!text-primary\",\n        );\n\n        if (location === \"/dashboard\") {\n          control.classList.add(\"!h-10\", \"!px-4\", \"!border-primary/50\", \"!bg-primary/15\");\n        }\n      }\n    };\n\n    const handleRefreshClick = (event: MouseEvent) => {\n      const target = event.target instanceof Element ? event.target.closest(\"button, a\") : null;\n      if (!target || target.textContent?.replace(/\\s+/g, \" \ ").trim() !== \"Atualizar\") return;\n\n      event.preventDefault();\n      event.stopPropagation();\n      window.location.reload();\n    };\n\n    updateControls();\n    const observer = new MutationObserver(updateControls);\n    observer.observe(document.body, { childList: true, subtree: true });\n    document.addEventListener(\"click\", handleRefreshClick, true);\n\n    return () => {\n      observer.disconnect();\n      document.removeEventListener(\"click\", handleRefreshClick, true);\n    };\n  }, [location]);`;

if (!source.includes("const showBackButton = backButtonRoutes.has(location)")) {
  source = source.replace(currentPageBlock, safeControlsBlock);
}

const mobileButtonEnd = `            </Button>\n            {location !== \"/dashboard/billing\" && (`;
const backButtonInsertion = `            </Button>\n            {showBackButton && (\n              <Button\n                type=\"button\"\n                variant=\"outline\"\n                size=\"sm\"\n                onClick={() => {\n                  if (window.history.length > 1) window.history.back();\n                  else window.location.assign(\"/dashboard\");\n                }}\n                className=\"h-9 border-white/15 bg-white/[0.04] px-3 text-sm font-medium text-zinc-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white\"\n              >\n                Voltar\n              </Button>\n            )}\n            {location !== \"/dashboard/billing\" && (`;

if (!source.includes("{showBackButton && (")) {
  source = source.replace(mobileButtonEnd, backButtonInsertion);
}

source = source.replaceAll('replace(/\\s+/g, " \").trim()', 'replace(/\\s+/g, " ").trim()');

writeFileSync(fileUrl, source, "utf8");
console.log("Safe route navigation controls applied without changing module internals.");
