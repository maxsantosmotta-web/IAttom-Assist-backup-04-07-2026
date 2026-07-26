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
  });
  const [imageMotionPlatform, setImageMotionPlatform] = useState<PlatformKey | "">(() => {
    try { return (localStorage.getItem("iattom_image_motion_platform_v1") as PlatformKey | null) ?? ""; } catch { return ""; }
  });
  const [imageMotionFormats, setImageMotionFormats] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("iattom_image_motion_formats_v1");
      return raw ? JSON.parse(raw) as string[] : [];
    } catch { return []; }
  });`,
  "independent image-motion state",
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
  `                        onClick={() => setPlatform(p.key)}
                        className={\`py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors text-center \${
                          platform === p.key`,
  `                        onClick={() => {
                          if (creativeType === "image") {
                            setPlatform(p.key);
                          } else {
                            setImageMotionPlatform(p.key);
                            setImageMotionFormats([]);
                            try {
                              localStorage.setItem("iattom_image_motion_platform_v1", p.key);
                              localStorage.removeItem("iattom_image_motion_formats_v1");
                            } catch { /* ignore */ }
                          }
                        }}
                        className={\`py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors text-center \${
                          (creativeType === "image" ? platform : imageMotionPlatform) === p.key`,
  "independent platform binding",
);

replaceRequired(
  `                  {platform && (
                    <motion.div
                      key={platform}`,
  `                  {(creativeType === "image" ? platform : imageMotionPlatform) && (
                    <motion.div
                      key={creativeType === "image" ? platform : imageMotionPlatform}`,
  "independent format visibility",
);

replaceRequired(
  `                          {selectedFormats.length} de {currentPlatformFormats.length} selecionado{selectedFormats.length !== 1 ? "s" : ""}`,
  `                          {(creativeType === "image" ? selectedFormats : imageMotionFormats).length} de {(creativeType === "image" ? currentPlatformFormats : (PLATFORMS.find((item) => item.key === imageMotionPlatform)?.formats ?? [])).length} selecionado{(creativeType === "image" ? selectedFormats : imageMotionFormats).length !== 1 ? "s" : ""}`,
  "independent format counter",
);

replaceRequired(
  `                        {currentPlatformFormats.map((f) => {
                          const isSelected = selectedFormats.includes(f.key);
                          const isDisabled = !isSelected && selectedFormats.length >= MAX_FORMATS;`,
  `                        {(creativeType === "image" ? currentPlatformFormats : (PLATFORMS.find((item) => item.key === imageMotionPlatform)?.formats ?? [])).map((f) => {
                          const activeFormats = creativeType === "image" ? selectedFormats : imageMotionFormats;
                          const isSelected = activeFormats.includes(f.key);
                          const isDisabled = !isSelected && activeFormats.length >= MAX_FORMATS;`,
  "independent format options",
);

replaceRequired(
  `                              onClick={() => toggleFormat(f.key)}`,
  `                              onClick={() => {
                                if (creativeType === "image") {
                                  toggleFormat(f.key);
                                } else {
                                  setImageMotionFormats((current) => {
                                    const next = current.includes(f.key)
                                      ? current.filter((key) => key !== f.key)
                                      : current.length < MAX_FORMATS ? [...current, f.key] : current;
                                    try { localStorage.setItem("iattom_image_motion_formats_v1", JSON.stringify(next)); } catch { /* ignore */ }
                                    return next;
                                  });
                                }
                              }}`,
  "independent format toggle",
);

replaceRequired(
  `disabled={!imageMotionSource || !imageMotionPrompt.trim() || !platform || selectedFormats.length === 0 || isGenerating}`,
  `disabled={!imageMotionSource || !imageMotionPrompt.trim() || !imageMotionPlatform || imageMotionFormats.length === 0 || isGenerating}`,
  "independent image-motion button readiness",
);

source = source.replace(
  `if (creativeType === "video") { setImageMotionSource(null); setImageMotionPrompt(""); try { localStorage.removeItem("iattom_image_motion_prompt_v1"); } catch { /* ignore */ } setImageMotionResetSignal((value) => value + 1); }`,
  `if (creativeType === "video") { setImageMotionSource(null); setImageMotionPrompt(""); setImageMotionPlatform(""); setImageMotionFormats([]); try { localStorage.removeItem("iattom_image_motion_prompt_v1"); localStorage.removeItem("iattom_image_motion_platform_v1"); localStorage.removeItem("iattom_image_motion_formats_v1"); } catch { /* ignore */ } setImageMotionResetSignal((value) => value + 1); }`,
);

if (!source.includes(`value={creativeType === "image" ? prompt : imageMotionPrompt}`)) {
  throw new Error("Image and image-motion prompts are still sharing the same state");
}
if (!source.includes(`(creativeType === "image" ? platform : imageMotionPlatform) === p.key`)) {
  throw new Error("Image and image-motion platforms are still sharing the same state");
}
if (!source.includes(`creativeType === "image" ? selectedFormats : imageMotionFormats`)) {
  throw new Error("Image and image-motion formats are still sharing the same state");
}
if (!source.includes(`disabled={!imageMotionSource || !imageMotionPrompt.trim() || !imageMotionPlatform || imageMotionFormats.length === 0 || isGenerating}`)) {
  throw new Error("Gerar Vídeo readiness does not use independent image-motion fields");
}

writeFileSync(creativeUrl, source);
console.log("Image and video-with-image share layout only; prompt, platform and formats are fully independent.");
