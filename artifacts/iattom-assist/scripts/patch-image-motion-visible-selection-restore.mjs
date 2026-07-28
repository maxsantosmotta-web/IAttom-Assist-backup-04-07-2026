import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const anchor = `  const [imageMotionFormats, setImageMotionFormats] = useState<string[]>(() => {`;
if (!source.includes(anchor)) {
  throw new Error("Image-motion persisted format state was not found");
}

const effectMarker = `  // Restaurar visualmente plataforma e formatos depois dos efeitos iniciais da tela`;
if (!source.includes(effectMarker)) {
  const insertionPoint = source.indexOf(`\n  useEffect(() => {`, source.indexOf(anchor));
  if (insertionPoint < 0) throw new Error("CreativeGenerator first effect marker was not found");

  const restoreEffect = `

  // Restaurar visualmente plataforma e formatos depois dos efeitos iniciais da tela
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedPlatform = localStorage.getItem("iattom_image_motion_platform_v1");
        if (savedPlatform && PLATFORMS.some((item) => item.key === savedPlatform)) {
          setImageMotionPlatform(savedPlatform as PlatformKey);
        }

        const savedFormats = localStorage.getItem("iattom_image_motion_formats_v1");
        if (savedFormats) {
          const parsed = JSON.parse(savedFormats) as unknown;
          if (Array.isArray(parsed)) {
            const valid = parsed
              .filter((format): format is string => ["vertical", "horizontal", "automatic"].includes(String(format)))
              .slice(0, MAX_FORMATS);
            if (valid.length > 0) setImageMotionFormats(valid);
          }
        }
      } catch { /* estado vazio permanece disponível para uma nova operação */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);`;

  source = source.slice(0, insertionPoint) + restoreEffect + source.slice(insertionPoint);
}

if (!source.includes('localStorage.getItem("iattom_image_motion_platform_v1")') ||
    !source.includes('localStorage.getItem("iattom_image_motion_formats_v1")') ||
    !source.includes("setImageMotionPlatform(savedPlatform as PlatformKey)") ||
    !source.includes("setImageMotionFormats(valid)")) {
  throw new Error("Image-motion visible selection restoration was not installed");
}

writeFileSync(creativeUrl, source);
console.log("Image-motion visibly restores the selected platform and formats after refresh.");
