import fs from "node:fs";

const pagePath = new URL("../src/pages/admin/AdminUsers.tsx", import.meta.url);
const enhancerPath = new URL("../src/lib/adminManualDeleteEnhancer.ts", import.meta.url);
let page = fs.readFileSync(pagePath, "utf8");
let enhancer = fs.readFileSync(enhancerPath, "utf8");

const activeList = '((data?.users ?? []) as AdminUser[]).filter((user) => !user.email.toLowerCase().endsWith("@deleted.iattom.invalid"))';

page = page.replaceAll("{data?.total ?? 0}", `{${activeList}.length}`);
page = page.replaceAll(
  '((data?.users ?? []) as AdminUser[]).filter((user) => user.role === "user").length',
  `${activeList}.filter((user) => user.role === "user").length`,
);
page = page.replaceAll(
  '((data?.users ?? []) as AdminUser[]).filter((user) => user.role === "admin").length',
  `${activeList}.filter((user) => user.role === "admin").length`,
);
page = page.replaceAll(
  '((data?.users ?? []) as AdminUser[]).reduce((sum, user) => sum + Number(user.credits || 0), 0)',
  `${activeList}.reduce((sum, user) => sum + Number(user.credits || 0), 0)`,
);
page = page.replaceAll(
  '((data?.users ?? []) as AdminUser[]).reduce((sum, user) => sum + Number(user.credits || 0) + Number(user.extraCredits || 0), 0)',
  `${activeList}.reduce((sum, user) => sum + Number(user.credits || 0) + Number(user.extraCredits || 0), 0)`,
);
page = page.replace(
  "(data?.users as AdminUser[] | undefined)?.map((user) => {",
  `((data?.users as AdminUser[] | undefined) ?? []).filter((user) => !user.email.toLowerCase().endsWith("@deleted.iattom.invalid")).map((user) => {`,
);

page = page.replace(
  'onClick={() => { void refetch(); void fetchDeletedUsers(); }}',
  'onClick={() => window.location.reload()}',
);
page = page.replace(
  'onClick={() => void refetch()}',
  'onClick={() => window.location.reload()}',
);

enhancer = enhancer.replace(
  /`Excluir o usuário \$\{email\}\?[\s\S]*?Usuários excluídos\.`/,
  '`Excluir o usuário ${email}?`',
);

fs.writeFileSync(pagePath, page);
fs.writeFileSync(enhancerPath, enhancer);
console.log("Admin deleted-user UI adjustments applied without blocking the build.");
