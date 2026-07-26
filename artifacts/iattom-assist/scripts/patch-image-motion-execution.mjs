import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const pickerImport = `import { ImageMotionSourcePicker, type ImageMotionSource } from "@/components/creative/ImageMotionSourcePicker";`;
const executionImport = `${pickerImport}\nimport { ImageMotionExecution } from "@/components/creative/ImageMotionExecution";`;

if (!source.includes(`import { ImageMotionExecution } from "@/components/creative/ImageMotionExecution";`)) {
  if (!source.includes(pickerImport)) throw new Error("Image motion picker import marker was not found");
  source = source.replace(pickerImport, executionImport);
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
                      } catch { /* ignore */ }
                    }}
                  />`;

if (!source.includes("<ImageMotionExecution")) {
  const label = `<Video className="w-4 h-4 mr-2" /> Gerar Vídeo`;
  const labelIndex = source.indexOf(label);
  if (labelIndex < 0) throw new Error("Visible Gerar Vídeo label was not found");

  const buttonStart = source.lastIndexOf("<Button", labelIndex);
  const buttonEndStart = source.indexOf("</Button>", labelIndex);
  if (buttonStart < 0 || buttonEndStart < 0) {
    throw new Error("Visible Gerar Vídeo button boundaries were not found");
  }

  const buttonEnd = buttonEndStart + "</Button>".length;
  const currentButton = source.slice(buttonStart, buttonEnd);

  if (!currentButton.includes("imageMotionSource") || !currentButton.includes("imageMotionPrompt") || !currentButton.includes("imageMotionPlatform") || !currentButton.includes("imageMotionFormats")) {
    throw new Error("Located Gerar Vídeo button is not the independent image-motion action");
  }

  source = source.slice(0, buttonStart) + executionPanel + source.slice(buttonEnd);
}

if (!source.includes("<ImageMotionExecution")) throw new Error("Image motion execution panel was not mounted");
if (!source.includes("source={imageMotionSource}")) throw new Error("Image motion source was not connected to execution");
if (!source.includes("prompt={imageMotionPrompt}")) throw new Error("Image motion prompt was not connected to execution");
if (!source.includes("platform={imageMotionPlatform}")) throw new Error("Image motion platform was not connected to execution");
if (!source.includes("formats={imageMotionFormats}")) throw new Error("Image motion formats were not connected to execution");
if (!source.includes("onNew={() =>")) throw new Error("Image motion Novo action was not connected");

writeFileSync(creativeUrl, source);
console.log("Image-motion execution mounted from the visible independent Gerar Vídeo action without running a generation during build.");