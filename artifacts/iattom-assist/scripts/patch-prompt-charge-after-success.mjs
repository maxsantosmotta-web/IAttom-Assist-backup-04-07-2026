import { readFileSync, writeFileSync } from "node:fs";

const gateUrl = new URL("../src/components/CreditsGate.tsx", import.meta.url);
let gate = readFileSync(gateUrl, "utf8");

gate = gate.replace(
  "  onSuccess: (charge: () => void) => void;",
  "  onSuccess: (charge: () => Promise<void>) => void;",
);

gate = gate.replace(
  "      onSuccess(() => {});",
  "      onSuccess(async () => {});",
);

gate = gate.replace(
  "    onSuccess(() => mutation.mutate({ data: { feature } }));",
  "    onSuccess(() => mutation.mutateAsync({ data: { feature } }).then(() => undefined));",
);

for (const marker of [
  "onSuccess: (charge: () => Promise<void>) => void;",
  "onSuccess(async () => {});",
  "mutation.mutateAsync({ data: { feature } }).then(() => undefined)",
]) {
  if (!gate.includes(marker)) throw new Error(`CreditsGate async charge marker missing: ${marker}`);
}

writeFileSync(gateUrl, gate, "utf8");

const promptUrl = new URL("../src/pages/dashboard/SavedPrompts.tsx", import.meta.url);
let prompt = readFileSync(promptUrl, "utf8");

prompt = prompt.replace(
  "  const chargedRef = useRef(false);",
  "  const pendingChargeRef = useRef<(() => Promise<void>) | null>(null);",
);

const successOld = `      if (res.ok && data.title && data.prompt) {
        setNewTitle(data.title);
        setNewPrompt(data.prompt);
        setGenerated(true);
        toast({ description: "Prompt gerado. Revise e salve." });`;
const successNew = `      if (res.ok && data.title && data.prompt) {
        const charge = pendingChargeRef.current;
        if (charge) await charge();
        setNewTitle(data.title);
        setNewPrompt(data.prompt);
        setGenerated(true);
        toast({ description: "Prompt gerado. Revise e salve." });`;
if (!prompt.includes("if (charge) await charge();")) {
  if (!prompt.includes(successOld)) throw new Error("Prompt success charge marker not found");
  prompt = prompt.replace(successOld, successNew);
}

prompt = prompt.replace(/\n        if \(chargedRef\.current\) \{[\s\S]*?\n        \}\n        toast\(\{ description: data\.error/g, "\n        toast({ description: data.error");
prompt = prompt.replace(/\n      if \(chargedRef\.current\) \{[\s\S]*?\n      \}\n      toast\(\{ description: "Erro de conexão/g, "\n      toast({ description: \"Erro de conexão");
prompt = prompt.replace(
  "      chargedRef.current = false;",
  "      pendingChargeRef.current = null;",
);

const triggerOld = `            onSuccess={(charge) => {
              charge();
              chargedRef.current = true;
              void generatePromptCore();
            }}`;
const triggerNew = `            onSuccess={(charge) => {
              pendingChargeRef.current = charge;
              void generatePromptCore();
            }}`;
if (!prompt.includes("pendingChargeRef.current = charge;")) {
  if (!prompt.includes(triggerOld)) throw new Error("Prompt CreditsGate trigger marker not found");
  prompt = prompt.replace(triggerOld, triggerNew);
}

for (const marker of [
  "const pendingChargeRef = useRef<(() => Promise<void>) | null>(null);",
  "if (charge) await charge();",
  "pendingChargeRef.current = charge;",
  "pendingChargeRef.current = null;",
]) {
  if (!prompt.includes(marker)) throw new Error(`Prompt post-success charge marker missing: ${marker}`);
}
if (prompt.includes("chargedRef.current")) throw new Error("Legacy prompt pre-charge/refund flow still present");

writeFileSync(promptUrl, prompt, "utf8");
console.log("Prompt credits are charged only after a successful generation; failed generations do not require refund.");
