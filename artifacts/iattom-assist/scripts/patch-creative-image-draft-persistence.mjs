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
      if (!prompt && !platform && selectedFormats.length === 0) return;
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

if (!source.includes("CREATIVE_IMAGE_DRAFT_KEY") ||
    !source.includes("creativeImageDraftReadyRef") ||
    !source.includes("selectedFormats,") ||
    !source.includes("updatedAt: new Date().toISOString()")) {
  throw new Error("Creative image draft persistence was not installed");
}

writeFileSync(creativeUrl, source);
console.log("Gerar Imagem preserva prompt, plataforma e formatos após atualização sem alterar outros fluxos.");