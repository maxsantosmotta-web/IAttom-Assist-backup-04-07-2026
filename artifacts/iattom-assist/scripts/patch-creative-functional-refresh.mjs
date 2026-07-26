import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

const oldButton = `        <Button size="sm" variant="outline" onClick={() => { setIsRefreshing(true); void refetchCredits(); setTimeout(() => { try { const p = loadModuleState<{ type: "image" | "video"; form: Record<string, unknown>; result: unknown }>("creative"); if (p?.type === "image" && p.result && typeof p.result === "object" && "concepts" in (p.result as object)) { setRestoredResult(p.result as CreativeIdeasResult); } else if (p?.type === "video" && p.result) { setRestoredVideoResult(p.result as VideoGenerationResult); } } catch {} setIsRefreshing(false); }, 750); }} disabled={fetchingCredits || isRefreshing} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">`;

const newButton = `        <Button size="sm" variant="outline" onClick={() => { setIsRefreshing(true); window.location.reload(); }} disabled={isRefreshing} className="border-white/10 text-zinc-400 hover:text-white hover:border-white/20 gap-1.5 shrink-0 mt-1">`;

if (!source.includes(newButton)) {
  if (!source.includes(oldButton)) {
    throw new Error("Creative refresh button marker was not found");
  }
  source = source.replace(oldButton, newButton);
}

if (!source.includes("window.location.reload()")) {
  throw new Error("Creative refresh button does not perform a real page reload");
}

writeFileSync(creativeUrl, source);
console.log("Creative Atualizar button now performs a real browser reload.");
