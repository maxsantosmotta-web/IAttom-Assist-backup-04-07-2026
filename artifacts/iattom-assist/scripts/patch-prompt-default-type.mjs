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

const legacyChargeRef = '  const chargedRef          = useRef(false);';
const pendingChargeRef = '  const pendingChargeRef    = useRef<(() => void) | null>(null);';
if (source.includes(legacyChargeRef)) {
  source = source.replace(legacyChargeRef, pendingChargeRef);
} else if (!source.includes(pendingChargeRef)) {
  throw new Error("SavedPrompts charge reference marker not found");
}

const toastAnchor = '  const { toast } = useToast();';
const postDeliveryEffect = `${toastAnchor}\n\n  useEffect(() => {\n    if (!generated || !newTitle.trim() || !newPrompt.trim()) return;\n    const charge = pendingChargeRef.current;\n    if (!charge) return;\n    pendingChargeRef.current = null;\n    charge();\n  }, [generated, newTitle, newPrompt]);`;
if (!source.includes("const charge = pendingChargeRef.current;")) {
  if (!source.includes(toastAnchor)) throw new Error("SavedPrompts toast anchor not found");
  source = source.replace(toastAnchor, postDeliveryEffect);
}

const legacyGenerateBlock = `  const generatePromptCore = async () => {\n    setGenerating(true);\n    setGenerated(false);\n    try {\n      const res = await fetch("/api/prompts/generate", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ tipo: guidedTipo, subject: guidedSubject.trim() }),\n      });\n      const data = await res.json() as { title?: string; prompt?: string; error?: string };\n      if (res.ok && data.title && data.prompt) {\n        setNewTitle(data.title);\n        setNewPrompt(data.prompt);\n        setGenerated(true);\n        toast({ description: "Prompt gerado. Revise e salve." });\n      } else {\n        if (chargedRef.current) {\n          void fetch("/api/credits/refund", {\n            method: "POST",\n            headers: { "Content-Type": "application/json" },\n            body: JSON.stringify({ feature: "prompt_creation" }),\n          });\n        }\n        toast({ description: data.error ?? "Erro ao gerar prompt. Tente novamente.", variant: "destructive" });\n      }\n    } catch {\n      if (chargedRef.current) {\n        void fetch("/api/credits/refund", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ feature: "prompt_creation" }),\n        });\n      }\n      toast({ description: "Erro de conexão. Tente novamente.", variant: "destructive" });\n    } finally {\n      setGenerating(false);\n      chargedRef.current = false;\n    }\n  };`;

const postDeliveryGenerateBlock = `  const generatePromptCore = async (charge: () => void) => {\n    setGenerating(true);\n    setGenerated(false);\n    pendingChargeRef.current = null;\n    try {\n      const res = await fetch("/api/prompts/generate", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ tipo: guidedTipo, subject: guidedSubject.trim() }),\n      });\n      const data = await res.json() as { title?: string; prompt?: string; error?: string };\n      if (res.ok && data.title?.trim() && data.prompt?.trim()) {\n        setNewTitle(data.title);\n        setNewPrompt(data.prompt);\n        pendingChargeRef.current = charge;\n        setGenerated(true);\n        toast({ description: "Prompt gerado. Revise e salve." });\n      } else {\n        pendingChargeRef.current = null;\n        toast({ description: data.error ?? "Erro ao gerar prompt. Tente novamente.", variant: "destructive" });\n      }\n    } catch {\n      pendingChargeRef.current = null;\n      toast({ description: "Erro de conexão. Tente novamente.", variant: "destructive" });\n    } finally {\n      setGenerating(false);\n    }\n  };`;

if (source.includes(legacyGenerateBlock)) {
  source = source.replace(legacyGenerateBlock, postDeliveryGenerateBlock);
} else if (!source.includes("const generatePromptCore = async (charge: () => void) =>")) {
  throw new Error("SavedPrompts generatePromptCore marker not found");
}

const legacyOnSuccess = `                onSuccess={(charge) => {\n                  charge();\n                  chargedRef.current = true;\n                  void generatePromptCore();\n                }}`;
const postDeliveryOnSuccess = `                onSuccess={(charge) => {\n                  void generatePromptCore(charge);\n                }}`;
source = source.split(legacyOnSuccess).join(postDeliveryOnSuccess);

const legacyRetryOnSuccess = `                        onSuccess={(charge) => {\n                          charge();\n                          chargedRef.current = true;\n                          void generatePromptCore();\n                        }}`;
const postDeliveryRetryOnSuccess = `                        onSuccess={(charge) => {\n                          void generatePromptCore(charge);\n                        }}`;
source = source.split(legacyRetryOnSuccess).join(postDeliveryRetryOnSuccess);

if (source.includes("chargedRef") || source.includes('/api/credits/refund')) {
  throw new Error("Criar Prompt still contains pre-charge or refund logic");
}
if (!source.includes("pendingChargeRef.current = charge") || !source.includes("const charge = pendingChargeRef.current;")) {
  throw new Error("Criar Prompt post-delivery charge rule was not installed");
}
if (source.includes("charge();\n                  void generatePromptCore")) {
  throw new Error("Criar Prompt still charges before generation");
}

fs.writeFileSync(pagePath, source);
console.log("Criar Prompt now charges only after valid material is rendered");
