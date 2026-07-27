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
if (!executionSource.includes(`videosData: "1"`)) throw new Error("Image-motion project is not synchronized with the visible Library");
writeFileSync(executionUrl, executionSource);

console.log("Image-motion execution preserves the visible flow and synchronizes saved video projects with the Library.");
