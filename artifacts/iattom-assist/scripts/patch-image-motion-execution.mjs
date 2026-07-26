import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const pickerImport = `import { ImageMotionSourcePicker, type ImageMotionSource } from "@/components/creative/ImageMotionSourcePicker";`;
const executionImport = `${pickerImport}\nimport { ImageMotionExecution } from "@/components/creative/ImageMotionExecution";`;

if (!source.includes(`import { ImageMotionExecution } from "@/components/creative/ImageMotionExecution";`)) {
  if (!source.includes(pickerImport)) throw new Error("Image motion picker import marker was not found");
  source = source.replace(pickerImport, executionImport);
}

const oldButton = `                  <Button
                     type="button"
                     disabled={!imageMotionSource || !imageMotionPrompt.trim() || !imageMotionPlatform || imageMotionFormats.length === 0 || isGenerating}
                     className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary disabled:text-primary-foreground disabled:opacity-40"
                   >
                     <Video className="w-4 h-4 mr-2" /> Gerar Vídeo
                   </Button>`;

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

if (!source.includes(executionPanel)) {
  if (!source.includes(oldButton)) throw new Error("Final Gerar Vídeo button marker was not found");
  source = source.replace(oldButton, executionPanel);
}

if (!source.includes("<ImageMotionExecution")) throw new Error("Image motion execution panel was not mounted");
if (!source.includes("onNew={() =>")) throw new Error("Image motion Novo action was not connected");

writeFileSync(creativeUrl, source);
console.log("Image-motion execution, queue, result, save, download and new actions are connected without running a generation during build.");
