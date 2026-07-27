import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const currentFormatsMarker = `  const currentPlatformFormats = platform ? (PLATFORMS.find((p) => p.key === platform)?.formats ?? []) : [];`;
const currentFormatsReplacement = `  const currentPlatformFormats = creativeType === "video"
    ? [
        { key: "vertical", label: "Vertical" },
        { key: "horizontal", label: "Horizontal" },
        { key: "automatic", label: "Automático" },
      ]
    : platform
      ? (PLATFORMS.find((p) => p.key === platform)?.formats ?? [])
      : [];`;

if (source.includes(currentFormatsMarker)) {
  source = source.replace(currentFormatsMarker, currentFormatsReplacement);
} else if (!source.includes(currentFormatsReplacement)) {
  throw new Error("Current platform formats marker was not found");
}

const resetFormatsMarker = `  useEffect(() => { setSelectedFormats([]); }, [platform]);`;
const resetFormatsReplacement = `  useEffect(() => { setSelectedFormats([]); }, [platform, creativeType]);`;

if (source.includes(resetFormatsMarker)) {
  source = source.replace(resetFormatsMarker, resetFormatsReplacement);
} else if (!source.includes(resetFormatsReplacement)) {
  throw new Error("Format reset effect marker was not found");
}

if (!source.includes("<ImageMotionSourcePicker")) {
  throw new Error("Visible image-motion source picker is not mounted");
}

if (!source.includes(`{ key: "vertical", label: "Vertical" }`) ||
    !source.includes(`{ key: "horizontal", label: "Horizontal" }`) ||
    !source.includes(`{ key: "automatic", label: "Automático" }`)) {
  throw new Error("Video format labels were not installed");
}

writeFileSync(creativeUrl, source);
console.log("Visible image-motion flow uses Vertical, Horizontal and Automático; existing picker and prompt flow preserved.");
