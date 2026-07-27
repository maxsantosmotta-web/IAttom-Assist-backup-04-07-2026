import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let creativeSource = readFileSync(creativeUrl, "utf8");

const oldStateBlock = `  const [imageMotionPrompt, setImageMotionPrompt] = useState(() => {
    try { return localStorage.getItem("iattom_image_motion_prompt_v1") ?? ""; } catch { return ""; }
  });
  const [imageMotionPlatform, setImageMotionPlatform] = useState<PlatformKey | "">("");
  const [imageMotionFormats, setImageMotionFormats] = useState<string[]>([]);`;

const persistedStateBlock = `  const [imageMotionPrompt, setImageMotionPrompt] = useState(() => {
    try {
      const direct = localStorage.getItem("iattom_image_motion_prompt_v1");
      if (direct !== null) return direct;
      const raw = localStorage.getItem("iattom_image_motion_execution_v1");
      if (!raw) return "";
      const saved = JSON.parse(raw) as { prompt?: unknown };
      return typeof saved.prompt === "string" ? saved.prompt : "";
    } catch { return ""; }
  });
  const [imageMotionPlatform, setImageMotionPlatform] = useState<PlatformKey | "">(() => {
    try {
      const direct = localStorage.getItem("iattom_image_motion_platform_v1");
      const raw = localStorage.getItem("iattom_image_motion_execution_v1");
      const saved = raw ? JSON.parse(raw) as { platform?: unknown } : null;
      const candidate = direct ?? (typeof saved?.platform === "string" ? saved.platform : "");
      return PLATFORMS.some((item) => item.key === candidate) ? candidate as PlatformKey : "";
    } catch { return ""; }
  });
  const [imageMotionFormats, setImageMotionFormats] = useState<string[]>(() => {
    try {
      const direct = localStorage.getItem("iattom_image_motion_formats_v1");
      const raw = localStorage.getItem("iattom_image_motion_execution_v1");
      const saved = raw ? JSON.parse(raw) as { formats?: unknown } : null;
      const candidate = direct ? JSON.parse(direct) : saved?.formats;
      if (!Array.isArray(candidate)) return [];
      return candidate.filter((format): format is string => ["vertical", "horizontal", "automatic"].includes(String(format))).slice(0, MAX_FORMATS);
    } catch { return []; }
  });`;

if (creativeSource.includes(oldStateBlock)) {
  creativeSource = creativeSource.replace(oldStateBlock, persistedStateBlock);
} else if (!creativeSource.includes("const saved = JSON.parse(raw) as { prompt?: unknown }")) {
  throw new Error("Image-motion independent state block was not found");
}

const oldPlatformSelection = `                            setImageMotionPlatform(nextPlatform);
                            setImageMotionFormats([]);`;
const persistedPlatformSelection = `                            setImageMotionPlatform(nextPlatform);
                            setImageMotionFormats([]);
                            try {
                              if (nextPlatform) localStorage.setItem("iattom_image_motion_platform_v1", nextPlatform);
                              else localStorage.removeItem("iattom_image_motion_platform_v1");
                              localStorage.removeItem("iattom_image_motion_formats_v1");
                            } catch { /* estado React continua sendo a fonte ativa */ }`;

if (creativeSource.includes(oldPlatformSelection)) {
  creativeSource = creativeSource.replace(oldPlatformSelection, persistedPlatformSelection);
} else if (!creativeSource.includes('localStorage.setItem("iattom_image_motion_platform_v1", nextPlatform)')) {
  throw new Error("Image-motion platform selection marker was not found");
}

const oldFormatSelection = `                                  setImageMotionFormats((current) => current.includes(f.key)
                                    ? current.filter((key) => key !== f.key)
                                    : current.length < MAX_FORMATS ? [...current, f.key] : current);`;
const persistedFormatSelection = `                                  setImageMotionFormats((current) => {
                                    const next = current.includes(f.key)
                                      ? current.filter((key) => key !== f.key)
                                      : current.length < MAX_FORMATS ? [...current, f.key] : current;
                                    try {
                                      if (next.length > 0) localStorage.setItem("iattom_image_motion_formats_v1", JSON.stringify(next));
                                      else localStorage.removeItem("iattom_image_motion_formats_v1");
                                    } catch { /* estado React continua sendo a fonte ativa */ }
                                    return next;
                                  });`;

if (creativeSource.includes(oldFormatSelection)) {
  creativeSource = creativeSource.replace(oldFormatSelection, persistedFormatSelection);
} else if (!creativeSource.includes('localStorage.setItem("iattom_image_motion_formats_v1", JSON.stringify(next))')) {
  throw new Error("Image-motion format selection marker was not found");
}

if (!creativeSource.includes("iattom_image_motion_platform_v1") || !creativeSource.includes("iattom_image_motion_formats_v1")) {
  throw new Error("Image-motion form persistence was not installed");
}

writeFileSync(creativeUrl, creativeSource);

const executionUrl = new URL("../src/components/creative/ImageMotionExecution.tsx", import.meta.url);
let executionSource = readFileSync(executionUrl, "utf8");

const oldPersistedType = `type PersistedState = {
  phase: Phase;
  pending: PendingRequest[];
  results: MotionResult[];
  error: string;
};`;
const fullPersistedType = `type PersistedSource = {
  name: string;
  mimeType: ImageMotionSource["mimeType"];
  origin: ImageMotionSource["origin"];
};

type PersistedState = {
  phase: Phase;
  pending: PendingRequest[];
  results: MotionResult[];
  error: string;
  source: PersistedSource | null;
  prompt: string;
  platform: string;
  formats: string[];
  updatedAt: string;
};`;

if (executionSource.includes(oldPersistedType)) {
  executionSource = executionSource.replace(oldPersistedType, fullPersistedType);
} else if (!executionSource.includes("type PersistedSource =")) {
  throw new Error("Image-motion PersistedState marker was not found");
}

const downloadingState = `  const [isDownloading, setIsDownloading] = useState(false);`;
const hydrationState = `${downloadingState}
  const [storageHydrated, setStorageHydrated] = useState(false);`;
if (!executionSource.includes("const [storageHydrated, setStorageHydrated]")) {
  if (!executionSource.includes(downloadingState)) throw new Error("Image-motion state marker was not found");
  executionSource = executionSource.replace(downloadingState, hydrationState);
}

const effectsStart = executionSource.indexOf(`  useEffect(() => {\n    mountedRef.current = true;`);
const pollStart = executionSource.indexOf(`  const pollRequest = async`, effectsStart);
if (effectsStart < 0 || pollStart < 0) throw new Error("Image-motion persistence effects were not found");

const safePersistenceEffects = `  useEffect(() => {
    mountedRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PersistedState>;
        const restoredPending = Array.isArray(saved.pending) ? saved.pending : [];
        const hasPendingRequest = restoredPending.length > 0;
        const restoredPhase: Phase = saved.phase === "done" || saved.phase === "error" || saved.phase === "processing" || saved.phase === "submitting"
          ? saved.phase
          : "idle";
        setPhase(hasPendingRequest && (restoredPhase === "submitting" || restoredPhase === "error") ? "processing" : restoredPhase);
        setPending(restoredPending);
        setResults(Array.isArray(saved.results) ? saved.results : []);
        setError(hasPendingRequest ? "" : (typeof saved.error === "string" ? saved.error : ""));
      }
    } catch { /* estado inválido não bloqueia uma nova operação */ }
    setStorageHydrated(true);
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!storageHydrated) return;
    const snapshot: PersistedState = {
      phase,
      pending,
      results,
      error,
      source: source ? { name: source.name, mimeType: source.mimeType, origin: source.origin } : null,
      prompt,
      platform,
      formats: [...formats],
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      if (prompt) localStorage.setItem("iattom_image_motion_prompt_v1", prompt);
      else localStorage.removeItem("iattom_image_motion_prompt_v1");
      if (platform) localStorage.setItem("iattom_image_motion_platform_v1", platform);
      else localStorage.removeItem("iattom_image_motion_platform_v1");
      if (formats.length > 0) localStorage.setItem("iattom_image_motion_formats_v1", JSON.stringify(formats));
      else localStorage.removeItem("iattom_image_motion_formats_v1");
    } catch { /* a operação em memória continua disponível */ }
  }, [storageHydrated, phase, pending, results, error, source, prompt, platform, formats]);

`;

executionSource = executionSource.slice(0, effectsStart) + safePersistenceEffects + executionSource.slice(pollStart);

const oldImmediateSnapshot = `          localStorage.setItem(STORAGE_KEY, JSON.stringify({ phase: "processing", pending: snapshot, results: [], error: "" } satisfies PersistedState));`;
const fullImmediateSnapshot = `          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            phase: "processing",
            pending: snapshot,
            results: [],
            error: "",
            source: { name: source.name, mimeType: source.mimeType, origin: source.origin },
            prompt: prompt.trim(),
            platform,
            formats: [...formats],
            updatedAt: new Date().toISOString(),
          } satisfies PersistedState));`;
if (executionSource.includes(oldImmediateSnapshot)) {
  executionSource = executionSource.replace(oldImmediateSnapshot, fullImmediateSnapshot);
} else if (!executionSource.includes("source: { name: source.name, mimeType: source.mimeType, origin: source.origin }")) {
  throw new Error("Image-motion immediate request snapshot marker was not found");
}

if (!executionSource.includes("if (!storageHydrated) return;") ||
    !executionSource.includes("prompt: prompt.trim()") ||
    !executionSource.includes("formats: [...formats]") ||
    !executionSource.includes("updatedAt: new Date().toISOString()")) {
  throw new Error("Image-motion full operation persistence was not installed");
}

writeFileSync(executionUrl, executionSource);
console.log("Image-motion Stage 1 now restores the complete operation without an initial empty-state overwrite.");
