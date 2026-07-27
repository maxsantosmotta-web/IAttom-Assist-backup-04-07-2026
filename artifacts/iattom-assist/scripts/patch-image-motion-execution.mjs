import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const pickerImport = `import { ImageMotionSourcePicker, type ImageMotionSource } from "@/components/creative/ImageMotionSourcePicker";`;
const executionImport = `${pickerImport}\nimport { ImageMotionExecution } from "@/components/creative/ImageMotionExecution";`;

if (!source.includes(`import { ImageMotionExecution } from "@/components/creative/ImageMotionExecution";`)) {
  if (!source.includes(pickerImport)) throw new Error("Image motion picker import marker was not found");
  source = source.replace(pickerImport, executionImport);
}

const exitAction = `onExit={() => {
                        setImageMotionSource(null);
                        setImageMotionPrompt("");
                        setImageMotionPlatform("");
                        setImageMotionFormats([]);
                        setPlatform("");
                        setSelectedFormats([]);
                        setPrompt("");
                        setImageMotionResetSignal((value) => value + 1);
                        try {
                          localStorage.removeItem("iattom_image_motion_prompt_v1");
                          localStorage.removeItem("iattom_image_motion_platform_v1");
                          localStorage.removeItem("iattom_image_motion_formats_v1");
                          localStorage.removeItem("iattom_image_motion_execution_v1");
                        } catch { /* ignore */ }
                      }}`;

const pickerStart = source.indexOf("<ImageMotionSourcePicker");
if (pickerStart < 0) throw new Error("Visible image-motion picker was not found");
const pickerEnd = source.indexOf("/>", pickerStart);
if (pickerEnd < 0) throw new Error("Visible image-motion picker closing marker was not found");

let pickerBlock = source.slice(pickerStart, pickerEnd + 2);
if (!pickerBlock.includes("onExit={() =>")) {
  const onChangeMarker = "onChange={setImageMotionSource}";
  if (!pickerBlock.includes(onChangeMarker)) throw new Error("Visible image-motion picker onChange marker was not found inside the picker block");
  pickerBlock = pickerBlock.replace(onChangeMarker, `${onChangeMarker}\n                      ${exitAction}`);
  source = source.slice(0, pickerStart) + pickerBlock + source.slice(pickerEnd + 2);
}

const executionPanel = `                  <ImageMotionExecution
                     source={imageMotionSource}
                     prompt={imageMotionPrompt}
                     platform={imageMotionPlatform}
                     formats={imageMotionFormats}
                     onNew={() => {
                       setImageMotionSource(null);
                       setImageMotionPrompt("");
                       setImageMotionPlatform("");
                       setImageMotionFormats([]);
                       setImageMotionResetSignal((value) => value + 1);
                       try {
                         localStorage.removeItem("iattom_image_motion_prompt_v1");
                         localStorage.removeItem("iattom_image_motion_platform_v1");
                         localStorage.removeItem("iattom_image_motion_formats_v1");
                         localStorage.removeItem("iattom_image_motion_execution_v1");
                       } catch { /* ignore */ }
                     }}
                   />`;

if (!source.includes("<ImageMotionExecution")) {
  const label = `<Video className="w-4 h-4 mr-2" /> Gerar Vídeo`;
  const labelIndex = source.indexOf(label);
  if (labelIndex < 0) throw new Error("Visible Gerar Vídeo label was not found");
  const buttonStart = source.lastIndexOf("<Button", labelIndex);
  const buttonEndStart = source.indexOf("</Button>", labelIndex);
  if (buttonStart < 0 || buttonEndStart < 0) throw new Error("Visible Gerar Vídeo button boundaries were not found");
  const buttonEnd = buttonEndStart + "</Button>".length;
  const currentButton = source.slice(buttonStart, buttonEnd);
  if (!currentButton.includes("imageMotionSource") || !currentButton.includes("imageMotionPrompt") || !currentButton.includes("imageMotionPlatform") || !currentButton.includes("imageMotionFormats")) throw new Error("Located Gerar Vídeo button is not the independent image-motion action");
  source = source.slice(0, buttonStart) + executionPanel + source.slice(buttonEnd);
}

const verifiedPickerStart = source.indexOf("<ImageMotionSourcePicker");
const verifiedPickerEnd = source.indexOf("/>", verifiedPickerStart);
const verifiedPickerBlock = source.slice(verifiedPickerStart, verifiedPickerEnd + 2);
if (!verifiedPickerBlock.includes("onExit={() =>")) throw new Error("Exit action is not connected to the visible image-motion picker");
if (!verifiedPickerBlock.includes("setPlatform(\"\")")) throw new Error("Visible platform state is not cleared by the picker exit");
if (!verifiedPickerBlock.includes("setSelectedFormats([])")) throw new Error("Visible formats state is not cleared by the picker exit");
if (!verifiedPickerBlock.includes("setPrompt(\"\")")) throw new Error("Visible prompt state is not cleared by the picker exit");
if (!source.includes("<ImageMotionExecution")) throw new Error("Image motion execution panel was not mounted");

writeFileSync(creativeUrl, source);

const executionUrl = new URL("../src/components/creative/ImageMotionExecution.tsx", import.meta.url);
let executionSource = readFileSync(executionUrl, "utf8");
const libraryMarker = `      toast({ description: "Vídeo salvo na Biblioteca." });`;
const localLibrarySync = `      try {
        const raw = localStorage.getItem("iattom_saved_items_v1");
        const existing = raw ? JSON.parse(raw) as Array<Record<string, unknown>> : [];
        existing.unshift({
          id,
          title,
          type: "creative",
          content: \`Tipo: Vídeo com imagem | Plataforma: \${platformLabel} | Formatos: \${motionFormats.map(formatLabel).join(", ")} | Prompt: \${prompt.trim()}\`,
          data,
          hasImages: false,
          videosData: "1",
          createdAt: new Date().toISOString(),
          deletedAt: null,
          expiresAt: null,
        });
        localStorage.setItem("iattom_saved_items_v1", JSON.stringify(existing));
      } catch { /* banco já confirmou o salvamento */ }
      toast({ description: "Vídeo salvo na Biblioteca." });`;

if (!executionSource.includes(`videosData: "1"`)) {
  if (!executionSource.includes(libraryMarker)) throw new Error("Image-motion library success marker was not found");
  executionSource = executionSource.replace(libraryMarker, localLibrarySync);
}

const legacyRestore = `        setPhase(saved.phase === "submitting" ? "processing" : saved.phase);
        setPending(Array.isArray(saved.pending) ? saved.pending : []);
        setResults(Array.isArray(saved.results) ? saved.results : []);
        setError(saved.error || "");`;
const resilientRestore = `        const restoredPending = Array.isArray(saved.pending) ? saved.pending : [];
        const hasPendingRequest = restoredPending.length > 0;
        setPhase(hasPendingRequest && (saved.phase === "submitting" || saved.phase === "error") ? "processing" : saved.phase);
        setPending(restoredPending);
        setResults(Array.isArray(saved.results) ? saved.results : []);
        setError(hasPendingRequest ? "" : (saved.error || ""));`;
if (executionSource.includes(legacyRestore)) {
  executionSource = executionSource.replace(legacyRestore, resilientRestore);
}

const legacyStatusFailure = `      if (!statusResponse.ok) throw new Error(await readError(statusResponse, "Não foi possível consultar o processamento."));`;
const resilientStatusFailure = `      if (!statusResponse.ok) {
        const statusMessage = await readError(statusResponse, "Não foi possível consultar o processamento.");
        if (statusResponse.status === 429 || /muitas requisições|aguarde um momento|rate limit/i.test(statusMessage)) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          continue;
        }
        throw new Error(statusMessage);
      }`;
if (executionSource.includes(legacyStatusFailure)) {
  executionSource = executionSource.replace(legacyStatusFailure, resilientStatusFailure);
}

const legacyCompletedBlock = `      if (status.status === "COMPLETED") {
        const resultResponse = await fetch(\`/api/image-motion/result/\${encodeURIComponent(item.requestId)}\`, { credentials: "include" });
        if (!resultResponse.ok) throw new Error(await readError(resultResponse, "Não foi possível recuperar o vídeo gerado."));
        const result = await resultResponse.json() as Omit<MotionResult, "format">;
        if (!result.videoUrl) throw new Error("A IA não retornou o arquivo do vídeo.");
        return { ...result, format: item.format };
      }`;
const resilientCompletedBlock = `      if (status.status === "COMPLETED") {
        const resultResponse = await fetch(\`/api/image-motion/result/\${encodeURIComponent(item.requestId)}\`, { credentials: "include" });
        if (!resultResponse.ok) {
          const resultMessage = await readError(resultResponse, "Não foi possível recuperar o vídeo gerado.");
          if (resultResponse.status === 429 || /ainda está sendo liberado|muitas requisições|aguarde um momento|rate limit/i.test(resultMessage)) {
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
            continue;
          }
          throw new Error(resultMessage);
        }
        const result = await resultResponse.json() as Omit<MotionResult, "format">;
        if (!result.videoUrl) throw new Error("A IA não retornou o arquivo do vídeo.");
        return { ...result, format: item.format };
      }`;
if (executionSource.includes(legacyCompletedBlock)) {
  executionSource = executionSource.replace(legacyCompletedBlock, resilientCompletedBlock);
}

const legacyGenerate = `  const generate = async () => {
    if (!source || !canGenerate) return;
    setPhase("submitting");
    setError("");
    setResults([]);
    try {
      const imageDataUrl = \`data:\${source.mimeType};base64,\${source.base64}\`;
      const submitted: PendingRequest[] = [];
      for (const format of motionFormats) {
        const response = await fetch("/api/image-motion/submit", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl, prompt: prompt.trim(), format }),
        });
        if (!response.ok) throw new Error(await readError(response, "Não foi possível enviar a imagem para processamento."));
        const body = await response.json() as { requestId?: string };
        if (!body.requestId) throw new Error("O servidor não retornou o identificador da geração.");
        submitted.push({ requestId: body.requestId, format });
      }
      setPending(submitted);
      setPhase("processing");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a geração.");
      setPhase("error");
    }
  };`;
const resilientGenerate = `  const generate = async () => {
    if (!source || !canGenerate) return;
    setPhase("submitting");
    setError("");
    setResults([]);
    setPending([]);
    const submitted: PendingRequest[] = [];
    try {
      const imageDataUrl = \`data:\${source.mimeType};base64,\${source.base64}\`;
      for (const format of motionFormats) {
        let response: Response | null = null;
        let submitMessage = "Não foi possível enviar a imagem para processamento.";
        for (let attempt = 0; attempt < 4; attempt += 1) {
          response = await fetch("/api/image-motion/submit", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageDataUrl, prompt: prompt.trim(), format }),
          });
          if (response.ok) break;
          submitMessage = await readError(response, submitMessage);
          const temporaryLimit = response.status === 429 || /muitas requisições|aguarde um momento|rate limit/i.test(submitMessage);
          if (!temporaryLimit || attempt === 3) break;
          await new Promise((resolve) => setTimeout(resolve, Math.min(POLL_INTERVAL_MS * (attempt + 1), 12_000)));
        }
        if (!response?.ok) {
          const temporaryLimit = response?.status === 429 || /muitas requisições|aguarde um momento|rate limit/i.test(submitMessage);
          if (temporaryLimit) throw new Error("O serviço de vídeo está temporariamente ocupado. Tente novamente em instantes sem alterar a imagem ou o prompt.");
          throw new Error(submitMessage);
        }
        const body = await response.json() as { requestId?: string };
        if (!body.requestId) throw new Error("O servidor não retornou o identificador da geração.");
        submitted.push({ requestId: body.requestId, format });
        const snapshot = [...submitted];
        setPending(snapshot);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ phase: "processing", pending: snapshot, results: [], error: "" } satisfies PersistedState));
        } catch { /* estado React continua preservando o pedido */ }
      }
      setPhase("processing");
    } catch (cause) {
      if (submitted.length > 0) {
        setPending([...submitted]);
        setError("");
        setPhase("processing");
        return;
      }
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a geração.");
      setPhase("error");
    }
  };`;
if (executionSource.includes(legacyGenerate)) {
  executionSource = executionSource.replace(legacyGenerate, resilientGenerate);
}

const legacyErrorActions = `          <div className="flex gap-2">
            {pending.length > 0 && <Button type="button" variant="outline" onClick={() => void resumePending(pending)}><RefreshCw className="w-4 h-4 mr-2" /> Consultar novamente</Button>}
            <Button type="button" variant="outline" onClick={resetAll}>Novo</Button>
          </div>`;
const resilientErrorActions = `          <div className="flex flex-wrap gap-2">
            {pending.length > 0 ? (
              <Button type="button" variant="outline" onClick={() => void resumePending(pending)}><RefreshCw className="w-4 h-4 mr-2" /> Consultar novamente</Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => void generate()}><RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente</Button>
            )}
            <Button type="button" variant="outline" onClick={resetAll}>Novo</Button>
          </div>`;
if (executionSource.includes(legacyErrorActions)) {
  executionSource = executionSource.replace(legacyErrorActions, resilientErrorActions);
}

if (!executionSource.includes(`videosData: "1"`)) throw new Error("Image-motion project is not synchronized with the visible Library");
if (!executionSource.includes("hasPendingRequest") || !executionSource.includes("resultResponse.status === 429") || !executionSource.includes("statusResponse.status === 429")) {
  throw new Error("Image-motion temporary rate-limit recovery was not installed");
}
if (!executionSource.includes("Tentar novamente") || !executionSource.includes("const snapshot = [...submitted]") || !executionSource.includes("O serviço de vídeo está temporariamente ocupado")) {
  throw new Error("Image-motion submit recovery was not installed");
}
writeFileSync(executionUrl, executionSource);

console.log("Image-motion execution preserves accepted requests, retries temporary submit limits, and always offers a recovery action.");