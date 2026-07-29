import fs from "node:fs";

const pagePath = new URL("../src/pages/admin/AdminUsers.tsx", import.meta.url);
const enhancerPath = new URL("../src/lib/adminManualDeleteEnhancer.ts", import.meta.url);
let page = fs.readFileSync(pagePath, "utf8");
let enhancer = fs.readFileSync(enhancerPath, "utf8");

page = page.replace(
  'onClick={() => { void refetch(); void fetchDeletedUsers(); }}',
  'onClick={() => window.location.reload()}',
);
page = page.replace(
  'onClick={() => void refetch()}',
  'onClick={() => window.location.reload()}',
);

enhancer = enhancer.replace(
  "Excluir o usuário ${email}?\\n\\nEle perderá plano, saldos e acesso, e será movido para Usuários excluídos.",
  "Excluir o usuário ${email}?",
);
enhancer = enhancer.replace(
  "Excluir definitivamente o usuário ${email}?\\n\\nA conta será removida do Clerk e do banco de dados.",
  "Excluir o usuário ${email}?",
);

fs.writeFileSync(pagePath, page);
fs.writeFileSync(enhancerPath, enhancer);
console.log("Admin Usuários now uses browser-like refresh and a short delete confirmation.");
