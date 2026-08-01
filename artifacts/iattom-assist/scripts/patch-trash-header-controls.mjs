import { readFileSync, writeFileSync } from "node:fs";

const sidebarUrl = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let sidebarSource = readFileSync(sidebarUrl, "utf8");
sidebarSource = sidebarSource.replace('      "/dashboard/trash": "Lixeira",\n', "");
writeFileSync(sidebarUrl, sidebarSource, "utf8");

const trashUrl = new URL("../src/pages/dashboard/Trash.tsx", import.meta.url);
let source = readFileSync(trashUrl, "utf8");

if (!source.includes('data-iattom-trash-controls="true"')) {
  const oldHeader = `      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-1">
          <Trash2 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-white">Lixeira</h1>
          <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">
            {all.length} {all.length === 1 ? "item" : "itens"}
          </Badge>
        </div>
        <p className="text-sm text-zinc-500 ml-8">
          Itens excluídos. Restaure para devolver ao local de origem.
        </p>
      </motion.div>`;

  const newHeader = `      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Trash2 className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-white">Lixeira</h1>
            <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px] font-normal">
              {all.length} {all.length === 1 ? "item" : "itens"}
            </Badge>
          </div>
          <p className="text-sm text-zinc-500 ml-8">
            Itens excluídos. Restaure para devolver ao local de origem.
          </p>
        </div>
        <div data-iattom-trash-controls="true" className="flex items-center gap-2 shrink-0 mt-1">
          <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()} className="h-9 border-white/10 text-xs gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => window.location.assign("/dashboard")} className="h-9 border-white/10 text-xs">
            Voltar
          </Button>
        </div>
      </motion.div>`;

  if (!source.includes(oldHeader)) throw new Error("Trash header marker not found");
  source = source.replace(oldHeader, newHeader);
}

const cardHeaderStart = source.indexOf("      <CardHeader");
const cardHeaderClose = "      </CardHeader>";
const cardHeaderEnd = cardHeaderStart >= 0 ? source.indexOf(cardHeaderClose, cardHeaderStart) : -1;
if (cardHeaderStart >= 0 && cardHeaderEnd > cardHeaderStart) {
  const endWithTag = cardHeaderEnd + cardHeaderClose.length;
  let cardHeader = source.slice(cardHeaderStart, endWithTag);
  const refreshTextIndex = cardHeader.indexOf("Atualizar");

  if (refreshTextIndex >= 0) {
    const buttonStart = cardHeader.lastIndexOf("<Button", refreshTextIndex);
    const buttonEnd = cardHeader.indexOf("</Button>", refreshTextIndex);

    if (buttonStart >= 0 && buttonEnd > buttonStart) {
      const buttonBlock = cardHeader.slice(buttonStart, buttonEnd + "</Button>".length);
      if (buttonBlock.includes("loadIntegrations") && buttonBlock.includes("loadProjects") && buttonBlock.includes("loadPrompts") && buttonBlock.includes("loadActivities")) {
        const lineStart = cardHeader.lastIndexOf("\n", buttonStart);
        const removeStart = lineStart >= 0 ? lineStart : buttonStart;
        cardHeader = cardHeader.slice(0, removeStart) + cardHeader.slice(buttonEnd + "</Button>".length);
      }
    }
  }

  source = source.slice(0, cardHeaderStart) + cardHeader + source.slice(endWithTag);
}

writeFileSync(trashUrl, source, "utf8");
console.log("Trash header controls retained and the obsolete card refresh removed.");
