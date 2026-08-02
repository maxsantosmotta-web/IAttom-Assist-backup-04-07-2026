import { readFileSync, writeFileSync } from "node:fs";

const promptUrl = new URL("../src/pages/dashboard/SavedPrompts.tsx", import.meta.url);
let source = readFileSync(promptUrl, "utf8");

if (!source.includes('const [generationRecovering, setGenerationRecovering]')) {
  const stateMarker = '  const [generating, setGenerating] = useState(false);';
  if (!source.includes(stateMarker)) throw new Error("Prompt generating state marker not found");
  source = source.replace(
    stateMarker,
    `${stateMarker}\n  const [generationRecovering, setGenerationRecovering] = useState(false);\n  const promptGenerationAbortRef = useRef<AbortController | null>(null);`,
  );
}

if (!source.includes('promptGenerationAbortRef.current?.abort("prompt-page-unmounted")')) {
  const migrationEffectMarker = `  const clearForm = () => {`;
  if (!source.includes(migrationEffectMarker)) throw new Error("Prompt clear form marker not found");
  source = source.replace(
    migrationEffectMarker,
    `  useEffect(() => () => {\n    promptGenerationAbortRef.current?.abort("prompt-page-unmounted");\n  }, []);\n\n${migrationEffectMarker}`,
  );
}

const functionStart = source.indexOf("  const generatePromptCore = async () => {");
const functionEnd = functionStart >= 0 ? source.indexOf("\n  const copyAll = async () => {", functionStart) : -1;
if (functionStart < 0 || functionEnd < 0) throw new Error("Prompt generation function boundaries not found");

const currentFunction = source.slice(functionStart, functionEnd);
if (!currentFunction.includes("generationRecovering")) {
  const replacement = `  const generatePromptCore = async () => {
    if (generating) return;

    const controller = new AbortController();
    promptGenerationAbortRef.current?.abort("prompt-generation-replaced");
    promptGenerationAbortRef.current = controller;
    setGenerating(true);
    setGenerationRecovering(false);
    setGenerated(false);

    const waitForRetry = (delayMs: number) => new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, delayMs);
      controller.signal.addEventListener("abort", () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
    });

    let transientAttempt = 0;

    try {
      while (!controller.signal.aborted) {
        try {
          const res = await fetch("/api/prompts/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo: guidedTipo,
              subject: guidedTipo === "Vídeo com Imagem" ? "" : guidedSubject.trim(),
              ...(guidedTipo === "Vídeo com Imagem" && referenceImage
                ? { referenceImage: { base64: referenceImage.base64, mimeType: referenceImage.mimeType } }
                : {}),
            }),
            signal: controller.signal,
          });

          const data = await res.json().catch(() => ({})) as { title?: string; prompt?: string; error?: string };

          if (res.ok && data.title && data.prompt) {
            const charge = pendingChargeRef.current;
            if (charge) await charge();
            if (controller.signal.aborted) return;
            setNewTitle(data.title);
            setNewPrompt(data.prompt);
            setGenerated(true);
            setGenerationRecovering(false);
            toast({ description: "Prompt gerado. Revise e salve." });
            return;
          }

          const transient = [429, 502, 503, 504].includes(res.status);
          if (!transient) {
            toast({ description: data.error ?? "Erro ao gerar prompt. Tente novamente.", variant: "destructive" });
            return;
          }

          transientAttempt += 1;
          setGenerationRecovering(true);
          const retryAfterHeader = Number(res.headers.get("Retry-After"));
          const retryDelay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
            ? Math.min(retryAfterHeader * 1000, 30000)
            : Math.min(2500 * Math.pow(1.65, transientAttempt - 1), 15000);
          await waitForRetry(retryDelay);
        } catch (error) {
          if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
          transientAttempt += 1;
          setGenerationRecovering(true);
          const retryDelay = Math.min(3000 * Math.pow(1.6, transientAttempt - 1), 15000);
          await waitForRetry(retryDelay);
        }
      }
    } finally {
      if (promptGenerationAbortRef.current === controller) {
        promptGenerationAbortRef.current = null;
        setGenerating(false);
        setGenerationRecovering(false);
        pendingChargeRef.current = null;
      }
    }
  };
`;
  source = source.slice(0, functionStart) + replacement + source.slice(functionEnd);
}

source = source.replace(
  '{generating ? (generationRecovering ? "Aguardando liberação..." : "Gerando prompt...") : "Gerar Prompt"}',
  '{generating ? "Gerando prompt..." : "Gerar Prompt"}',
);
source = source.replace(
  '{generating ? "Gerando prompt..." : "Gerar Prompt"}',
  '{generating ? "Gerando prompt..." : "Gerar Prompt"}',
);

for (const marker of [
  "const [generationRecovering, setGenerationRecovering]",
  "const promptGenerationAbortRef = useRef<AbortController | null>(null);",
  "[429, 502, 503, 504].includes(res.status)",
  '{generating ? "Gerando prompt..." : "Gerar Prompt"}',
  "if (charge) await charge();",
]) {
  if (!source.includes(marker)) throw new Error(`Prompt transient recovery marker missing: ${marker}`);
}
if (source.includes("Aguardando liberação")) {
  throw new Error("Technical retry message must not be visible to the user");
}

writeFileSync(promptUrl, source, "utf8");
console.log("Prompt generation remains loading continuously during transient retries, without technical status messages.");
