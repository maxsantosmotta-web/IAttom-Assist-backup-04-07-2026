import fs from "node:fs";

const pagePath = new URL("../src/pages/admin/AdminUsers.tsx", import.meta.url);
const enhancerPath = new URL("../src/lib/adminManualDeleteEnhancer.ts", import.meta.url);
let page = fs.readFileSync(pagePath, "utf8");
let enhancer = fs.readFileSync(enhancerPath, "utf8");

page = page.replaceAll("{data?.total ?? 0}", "{activeUsers.length}");
page = page.replaceAll("((data?.users ?? []) as AdminUser[])", "activeUsers");
page = page.replace(
  "(data?.users as AdminUser[] | undefined)?.map((user) => {",
  "activeUsers.map((user) => {",
);

if (!page.includes("const activeUsers =")) {
  const hookAnchor = `  const { data, isLoading, isFetching, refetch } = useListAdminUsers(params, {
    query: { queryKey: getListAdminUsersQueryKey(params) },
  });`;
  if (!page.includes(hookAnchor)) throw new Error("Admin users query anchor not found");
  page = page.replace(hookAnchor, `${hookAnchor}

  const activeUsers = ((data?.users ?? []) as AdminUser[]).filter(
    (user) => !user.email.toLowerCase().endsWith("@deleted.iattom.invalid"),
  );`);
}

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
  "const activeUsers = ((data?.users ?? []) as AdminUser[]).filter(",
  "{activeUsers.length}",
  "activeUsers.map((user) => {",
  "window.location.reload()",
]) {
  if (!page.includes(marker)) throw new Error(`Admin deleted-user final marker missing: ${marker}`);
}
if (page.includes("const activeUsers = activeUsers.filter")) throw new Error("Active users self-reference remains");
if (enhancer.includes("Ele perderá plano")) throw new Error("Verbose delete confirmation remains");

fs.writeFileSync(pagePath, page);
fs.writeFileSync(enhancerPath, enhancer);
console.log("Deleted users no longer appear in active rows or counts; admin refresh now reloads the full page.");
