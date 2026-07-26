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
  const [imageMotionPlatform, setImageMotionPlatform] = useState<PlatformKey | "">("");
  const [imageMotionFormats, setImageMotionFormats] = useState<string[]>([]);`,
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
                            const nextPlatform = platform === p.key ? "" : p.key;
                            setPlatform(nextPlatform);
                            setSelectedFormats([]);
                          } else {
                            const nextPlatform = imageMotionPlatform === p.key ? "" : p.key;
                            setImageMotionPlatform(nextPlatform);
                            setImageMotionFormats([]);
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
                                  setImageMotionFormats((current) => current.includes(f.key)
                                    ? current.filter((key) => key !== f.key)
                                    : current.length < MAX_FORMATS ? [...current, f.key] : current);
                                }
                              }}`,
  "independent format toggle",
);

const independentReadiness = `disabled={!imageMotionSource || !imageMotionPrompt.trim() || !imageMotionPlatform || imageMotionFormats.length === 0 || isGenerating}`;
if (!source.includes(independentReadiness)) {
  const sharedReadiness = `disabled={!imageMotionSource || !imageMotionPrompt.trim() || !platform || selectedFormats.length === 0 || isGenerating}`;
  const protectedButton = `                  <Button
                    type="button"
                    disabled
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary disabled:text-primary-foreground disabled:opacity-40"
                  >`;
  const activeButton = `                  <Button
                    type="button"
                    ${independentReadiness}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary disabled:text-primary-foreground disabled:opacity-40"
                  >`;

  if (source.includes(sharedReadiness)) {
    source = source.replace(sharedReadiness, independentReadiness);
  } else if (source.includes(protectedButton)) {
    source = source.replace(protectedButton, activeButton);
  } else {
    throw new Error("Gerar Vídeo button marker was not found");
  }
}

source = source.replace(
  `if (creativeType === "video") { setImageMotionSource(null); setImageMotionPrompt(""); try { localStorage.removeItem("iattom_image_motion_prompt_v1"); } catch { /* ignore */ } setImageMotionResetSignal((value) => value + 1); }`,
  `if (creativeType === "video") { setImageMotionSource(null); setImageMotionPrompt(""); setImageMotionPlatform(""); setImageMotionFormats([]); try { localStorage.removeItem("iattom_image_motion_prompt_v1"); localStorage.removeItem("iattom_image_motion_platform_v1"); localStorage.removeItem("iattom_image_motion_formats_v1"); } catch { /* ignore */ } setImageMotionResetSignal((value) => value + 1); }`,
);

if (!source.includes(`value={creativeType === "image" ? prompt : imageMotionPrompt}`)) {
  throw new Error("Image and image-motion prompts are still sharing the same state");
}
if (!source.includes(`const nextPlatform = platform === p.key ? "" : p.key;`)) {
  throw new Error("Image platform does not toggle on second click");
}
if (!source.includes(`const nextPlatform = imageMotionPlatform === p.key ? "" : p.key;`)) {
  throw new Error("Image-motion platform does not toggle on second click");
}
if (!source.includes(`creativeType === "image" ? selectedFormats : imageMotionFormats`)) {
  throw new Error("Image and image-motion formats are still sharing the same state");
}
if (source.includes(`localStorage.setItem("iattom_image_motion_platform_v1"`) || source.includes(`localStorage.setItem("iattom_image_motion_formats_v1"`)) {
  throw new Error("Image-motion platform or formats must not persist after refresh");
}
if (!source.includes(independentReadiness)) {
  throw new Error("Gerar Vídeo readiness does not use independent image-motion fields");
}

writeFileSync(creativeUrl, source);
console.log("Platform and format buttons now toggle consistently and reset after a real refresh in both modes.");