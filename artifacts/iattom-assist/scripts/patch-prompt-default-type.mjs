import fs from "node:fs";

const pagePath = new URL("../src/pages/dashboard/SavedPrompts.tsx", import.meta.url);
let source = fs.readFileSync(pagePath, "utf8");

const oldLine = '  const [guidedTipo, setGuidedTipo]       = useState("");';
const newLine = '  const [guidedTipo, setGuidedTipo]       = useState("Personalizado");';

if (source.includes(oldLine)) {
  source = source.replace(oldLine, newLine);
} else if (!source.includes(newLine)) {
  throw new Error("SavedPrompts guidedTipo state marker not found");
}

source = source.replace(
  '    setGuidedTipo("");',
  '    setGuidedTipo("Personalizado");',
);

fs.writeFileSync(pagePath, source);
console.log("Criar Prompt now starts with Personalizado selected by default");
