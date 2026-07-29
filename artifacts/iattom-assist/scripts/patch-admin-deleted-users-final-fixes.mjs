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

for (const refreshHandler of [
  'onClick={() => { void refetch(); void fetchDeletedUsers(); }}',
  'onClick={() => void refetch()}',
]) {
  page = page.replace(refreshHandler, 'onClick={() => window.location.reload()}');
}

const confirmationPattern = /`Excluir o usuário \$\{email\}\?[\s\S]*?Usuários excluídos\.`/;
if (confirmationPattern.test(enhancer)) {
  enhancer = enhancer.replace(confirmationPattern, '`Excluir o usuário ${email}?`');
}

for (const marker of [
  '@deleted.iattom.invalid',
  'window.location.reload()',
]) {
  if (!page.includes(marker)) throw new Error(`Admin deleted-user final marker missing: ${marker}`);
}
if (page.includes("activeUsers")) throw new Error("Obsolete activeUsers helper remains");
if (enhancer.includes("Ele perderá plano")) throw new Error("Verbose delete confirmation remains");

fs.writeFileSync(pagePath, page);
fs.writeFileSync(enhancerPath, enhancer);
console.log("Deleted users are filtered inline from active rows and counts; admin refresh reloads the full page.");
