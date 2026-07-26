import { readFileSync, writeFileSync } from "node:fs";

const creativeUrl = new URL("../src/pages/dashboard/CreativeGenerator.tsx", import.meta.url);
let source = readFileSync(creativeUrl, "utf8");

source = source.replace(
  'type PlatformKey = "instagram" | "facebook" | "tiktok" | "mercado_livre" | "shopee" | "hotmart" | "kiwify" | "perfil";',
  'type PlatformKey = "instagram" | "facebook" | "tiktok" | "mercado_livre" | "shopee" | "hotmart" | "kiwify";',
);

source = source.replace(
  '  { key: "perfil",        label: "Perfil",        formats: [{ key: "perfil", label: "Perfil" }] },\n',
  '',
);

if (source.includes('key: "perfil"') || source.includes('| "perfil"')) {
  throw new Error("Profile platform was not fully removed from CreativeGenerator");
}

writeFileSync(creativeUrl, source);
console.log("Profile block removed from Criar Imagem e Vídeo; only real platforms remain.");
