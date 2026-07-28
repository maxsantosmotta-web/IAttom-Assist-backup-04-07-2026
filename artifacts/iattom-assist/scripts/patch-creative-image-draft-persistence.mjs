import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const draftKeyMarker = `const MAX_FORMATS = 3;`;
const draftKeyBlock = `${draftKeyMarker}\nconst CREATIVE_IMAGE_DRAFT_KEY = "iattom_creative_image_draft_v1";`;
if (!source.includes("CREATIVE_IMAGE_DRAFT_KEY")) {
  if (!source.includes(draftKeyMarker)) throw new Error("Creative image MAX_FORMATS marker not found");
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
        .slice(0, MAX_FORMATS);
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
  const previousCreativeImagePlatformRef = useRef<PlatformKey | "">(platform);`;

if (source.includes(oldStates)) {
  source = source.replace(oldStates, persistedStates);
} else if (!source.includes("previousCreativeImagePlatformRef")) {
  throw new Error("Creative image state block not found");
}

const legacyPlatformReset = `  useEffect(() => { setSelectedFormats([]); }, [platform]);`;
if (source.includes(legacyPlatformReset)) {
  source = source.replace(legacyPlatformReset, "");
}

const persistenceMarker = `  // Persistência isolada do formulário Gerar Imagem`;
if (!source.includes(persistenceMarker)) {
  const insertionMarker = `  // Prefill a partir do módulo Campanha`;
  const insertionPoint = source.indexOf(insertionMarker);
  if (insertionPoint < 0) throw new Error("Creative image prefill insertion marker not found");

  const effects = `  // Persistência isolada do formulário Gerar Imagem
  useEffect(() => {
    if (previousCreativeImagePlatformRef.current !== platform) {
      previousCreativeImagePlatformRef.current = platform;
      setSelectedFormats([]);
      return;
    }
    try {
      if (!prompt && !platform && selectedFormats.length === 0) {
        localStorage.removeItem(CREATIVE_IMAGE_DRAFT_KEY);
      } else {
        localStorage.setItem(CREATIVE_IMAGE_DRAFT_KEY, JSON.stringify({
          prompt,
          platform,
          selectedFormats,
          updatedAt: new Date().toISOString(),
        }));
      }
    } catch { /* estado React continua sendo a fonte ativa */ }
  }, [prompt, platform, selectedFormats]);

`;

  source = source.slice(0, insertionPoint) + effects + source.slice(insertionPoint);
}

if (!source.includes("CREATIVE_IMAGE_DRAFT_KEY") ||
    !source.includes("previousCreativeImagePlatformRef") ||
    !source.includes("Persistência isolada do formulário Gerar Imagem") ||
    !source.includes("localStorage.setItem(CREATIVE_IMAGE_DRAFT_KEY") ||
    !source.includes("updatedAt: new Date().toISOString()")) {
  throw new Error("Creative image draft persistence was not installed in the final generated page");
}

writeFileSync(creativeUrl, source);
console.log("Gerar Imagem preserva prompt, plataforma e formatos no código final sem alterar outros fluxos.");