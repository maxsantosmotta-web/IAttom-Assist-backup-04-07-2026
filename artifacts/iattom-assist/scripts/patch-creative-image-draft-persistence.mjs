import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const draftKeyMarker = `const PLATFORMS:`;
const draftKeyBlock = `const CREATIVE_IMAGE_DRAFT_KEY = "iattom_creative_image_draft_v1";\n\n${draftKeyMarker}`;
if (!source.includes("CREATIVE_IMAGE_DRAFT_KEY")) {
  if (!source.includes(draftKeyMarker)) throw new Error("Creative image PLATFORMS marker not found");
  source = source.replace(draftKeyMarker, draftKeyBlock);
}

const oldStates = `  const [platform, setPlatform] = useState<PlatformKey | "">("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");`;

const persistedStates = `  const [platform, setPlatform] = useState<PlatformKey | "">(() => {
    try {
      const raw = localStorage.getItem(CREATIVE_IMAGE_DRAFT_KEY);
      if (!raw) return "";
      const saved = JSON.parse(raw) as { platform?: unknown };
      return typeof saved.platform === "string" && PLATFORMS.some((item) => item.key === saved.platform)
        ? saved.platform as PlatformKey
        : "";
    } catch { return ""; }
  });
  const [selectedFormats, setSelectedFormats] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(CREATIVE_IMAGE_DRAFT_KEY);
      if (!raw) return [];
      const saved = JSON.parse(raw) as { platform?: unknown; selectedFormats?: unknown };
      if (typeof saved.platform !== "string" || !Array.isArray(saved.selectedFormats)) return [];
      const allowed = PLATFORMS.find((item) => item.key === saved.platform)?.formats.map((item) => item.key) ?? [];
      return saved.selectedFormats
        .filter((format): format is string => typeof format === "string" && allowed.includes(format))
        .slice(0, 3);
    } catch { return []; }
  });
  const [prompt, setPrompt] = useState(() => {
    try {
      const raw = localStorage.getItem(CREATIVE_IMAGE_DRAFT_KEY);
      if (!raw) return "";
      const saved = JSON.parse(raw) as { prompt?: unknown };
      return typeof saved.prompt === "string" ? saved.prompt : "";
    } catch { return ""; }
  });
  const creativeImageDraftReadyRef = useRef(false);`;

if (source.includes(oldStates)) {
  source = source.replace(oldStates, persistedStates);
} else if (!source.includes("creativeImageDraftReadyRef")) {
  throw new Error("Creative image state block not found");
}

const oldPlatformEffect = `  useEffect(() => { setSelectedFormats([]); }, [platform]);`;
const safeDraftEffects = `  useEffect(() => {
    if (!creativeImageDraftReadyRef.current) {
      creativeImageDraftReadyRef.current = true;
      return;
    }
    try {
      if (!prompt && !platform && selectedFormats.length === 0) {
        localStorage.removeItem(CREATIVE_IMAGE_DRAFT_KEY);
        return;
      }
      localStorage.setItem(CREATIVE_IMAGE_DRAFT_KEY, JSON.stringify({
        prompt,
        platform,
        selectedFormats,
        updatedAt: new Date().toISOString(),
      }));
    } catch { /* estado React continua sendo a fonte ativa */ }
  }, [prompt, platform, selectedFormats]);`;

if (source.includes(oldPlatformEffect)) {
  source = source.replace(oldPlatformEffect, safeDraftEffects);
} else if (!source.includes("localStorage.setItem(CREATIVE_IMAGE_DRAFT_KEY")) {
  throw new Error("Creative image platform reset effect not found");
}

const togglePlatformClick = `onClick={() => setPlatform((current) => current === p.key ? "" : p.key)}`;
if (!source.includes(togglePlatformClick)) {
  const platformButtonPattern = /(key=\{p\.key\}\s*\n\s*)onClick=\{[\s\S]*?\}\s*\n(\s*className=\{`py-2\.5 px-2)/;
  if (!platformButtonPattern.test(source)) {
    throw new Error("Creative image platform button block not found");
  }
  source = source.replace(platformButtonPattern, `$1${togglePlatformClick}\n$2`);
}

const oldNewButton = `onClick={() => { reset(); setRestoredResult(null); clearModuleState("creative"); }}`;
const cleanNewButton = `onClick={() => {
                    reset();
                    setRestoredResult(null);
                    setPrompt("");
                    setPlatform("");
                    setSelectedFormats([]);
                    clearModuleState("creative");
                    try { localStorage.removeItem(CREATIVE_IMAGE_DRAFT_KEY); } catch { /* ignore */ }
                  }}`;
if (source.includes(oldNewButton)) {
  source = source.replace(oldNewButton, cleanNewButton);
} else if (!source.includes("localStorage.removeItem(CREATIVE_IMAGE_DRAFT_KEY)")) {
  throw new Error("Creative image Novo button marker not found");
}

if (!source.includes("CREATIVE_IMAGE_DRAFT_KEY") ||
    !source.includes("creativeImageDraftReadyRef") ||
    !source.includes("selectedFormats,") ||
    !source.includes("updatedAt: new Date().toISOString()") ||
    !source.includes(togglePlatformClick) ||
    !source.includes("setPrompt(\"\");") ||
    !source.includes("localStorage.removeItem(CREATIVE_IMAGE_DRAFT_KEY)")) {
  throw new Error("Creative image draft persistence and reset were not installed");
}

writeFileSync(creativeUrl, source);
console.log("Gerar Imagem preserva o rascunho, permite desmarcar a plataforma e limpa tudo no botão Novo.");