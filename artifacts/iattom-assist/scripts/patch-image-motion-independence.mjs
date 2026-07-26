import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

function replaceRequired(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${label} marker was not found`);
  source = source.replace(before, after);
}

replaceRequired(
  `  const [imageMotionResetSignal, setImageMotionResetSignal] = useState(0);`,
  `  const [imageMotionResetSignal, setImageMotionResetSignal] = useState(0);
  const [imageMotionPrompt, setImageMotionPrompt] = useState(() => {
    try { return localStorage.getItem("iattom_image_motion_prompt_v1") ?? ""; } catch { return ""; }
  });`,
  "independent image-motion prompt state",
);

replaceRequired(
  `                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}`,
  `                    value={creativeType === "image" ? prompt : imageMotionPrompt}
                    onChange={(e) => {
                      if (creativeType === "image") {
                        setPrompt(e.target.value);
                      } else {
                        setImageMotionPrompt(e.target.value);
                        try { localStorage.setItem("iattom_image_motion_prompt_v1", e.target.value); } catch { /* ignore */ }
                      }
                    }}`,
  "independent prompt input binding",
);

replaceRequired(
  `                  <Button
                    type="button"
                    disabled
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary disabled:text-primary-foreground disabled:opacity-40"
                  >
                    <Video className="w-4 h-4 mr-2" /> Gerar Vídeo
                  </Button>`,
  `                  <Button
                    type="button"
                    disabled={!imageMotionSource || !imageMotionPrompt.trim() || !platform || selectedFormats.length === 0 || isGenerating}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary disabled:text-primary-foreground disabled:opacity-40"
                  >
                    <Video className="w-4 h-4 mr-2" /> Gerar Vídeo
                  </Button>`,
  "independent image-motion button readiness",
);

source = source.replace(
  `if (creativeType === "video") { setImageMotionSource(null); setImageMotionResetSignal((value) => value + 1); }`,
  `if (creativeType === "video") { setImageMotionSource(null); setImageMotionPrompt(""); try { localStorage.removeItem("iattom_image_motion_prompt_v1"); } catch { /* ignore */ } setImageMotionResetSignal((value) => value + 1); }`,
);

if (!source.includes(`value={creativeType === "image" ? prompt : imageMotionPrompt}`)) {
  throw new Error("Image and image-motion prompts are still sharing the same state");
}
if (!source.includes(`disabled={!imageMotionSource || !imageMotionPrompt.trim() || !platform || selectedFormats.length === 0 || isGenerating}`)) {
  throw new Error("Gerar Vídeo readiness does not use independent image-motion fields");
}

writeFileSync(creativeUrl, source);
console.log("Image and video-with-image now share layout only; prompt and readiness states are independent.");
