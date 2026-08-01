import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(fileUrl, "utf8");

// A rota continua compartilhada, mas cada item do menu grava o modo antes do
// remount do componente. A tela abre diretamente no modo escolhido.
source = source.replace(
  /  const \[creativeType, setCreativeType\] = useState<CreativeType>\(\(\) => \{[\s\S]*?\n  \}\);/,
  `  const [creativeType] = useState<CreativeType>(() => {
    try {
      return localStorage.getItem("iattom_creative_tab_v1") === "video" ? "video" : "image";
    } catch {
      return "image";
    }
  });`,
);

// Compatibilidade caso um patch anterior já tenha removido o setter, mas ainda
// tenha mantido a inicialização antiga.
source = source.replace(
  /  const \[creativeType\] = useState<CreativeType>\(\(\) => \{[\s\S]*?\n  \}\);/,
  `  const [creativeType] = useState<CreativeType>(() => {
    try {
      return localStorage.getItem("iattom_creative_tab_v1") === "video" ? "video" : "image";
    } catch {
      return "image";
    }
  });`,
);

// Remove o seletor interno completo. Assim Gerar imagem não mostra Vídeo e
// Vídeo com efeito não mostra Imagem, sem apagar as implementações.
source = source.replace(
  /\n\s*\{\/\* Tipo de criativo \*\/\}[\s\S]*?\n\s*\{\/\* Formulário condicional(?:[^*]|\*(?!\/))*\*\/\}/,
  `\n\n      {/* Formulário condicional — modo definido exclusivamente pela entrada do menu */}`,
);

// Torna título e subtítulo dinâmicos, independentemente do texto deixado por
// patches anteriores.
source = source.replace(
  /<h2 className="text-2xl font-bold text-white mb-1">[\s\S]*?<\/h2>/,
  '<h2 className="text-2xl font-bold text-white mb-1">{creativeType === "video" ? "Vídeo com efeito" : "Gerar imagem"}</h2>',
);
source = source.replace(
  /<p className="text-muted-foreground text-sm">[\s\S]*?<\/p>/,
  '<p className="text-muted-foreground text-sm">{creativeType === "video" ? "Transforme uma imagem em vídeo com efeito." : "Gere imagens prontas para publicação."}</p>',
);

for (const marker of [
  'localStorage.getItem("iattom_creative_tab_v1") === "video" ? "video" : "image"',
  'creativeType === "video" ? "Vídeo com efeito" : "Gerar imagem"',
  '{creativeType === "image" && (',
  '{creativeType === "video" && (',
  'Formulário condicional — modo definido exclusivamente pela entrada do menu',
]) {
  if (!source.includes(marker)) throw new Error(`Creative isolated-entry marker missing: ${marker}`);
}

for (const forbidden of [
  'Label className="text-sm text-muted-foreground block mb-3">Tipo de criativo</Label>',
  'setCreativeType("image")',
  'setCreativeType("video")',
]) {
  if (source.includes(forbidden)) throw new Error(`Creative cross-mode selector is still visible: ${forbidden}`);
}

writeFileSync(fileUrl, source, "utf8");
console.log("Gerar imagem and Vídeo com efeito now share the route but open as visually isolated modules.");
