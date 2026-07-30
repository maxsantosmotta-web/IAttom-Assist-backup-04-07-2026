import fs from "node:fs";

const pagePath = new URL("../src/pages/admin/AdminUsers.tsx", import.meta.url);
const enhancerPath = new URL("../src/lib/adminManualDeleteEnhancer.ts", import.meta.url);
let page = fs.readFileSync(pagePath, "utf8");
let enhancer = fs.readFileSync(enhancerPath, "utf8");

page = page.replace(
  "Activity, CreditCard, Edit2, Eye, FolderOpen, Loader2, RefreshCw, Search, ShieldOff, UserCheck, UserX, Users, Zap",
  "Activity, CreditCard, Edit2, Eye, FolderOpen, Loader2, RefreshCw, Search, ShieldOff, Trash2, UserCheck, UserX, Users, Zap",
);

if (!page.includes("reason?: string | null;")) {
  page = page.replace(
    "  deletedBy?: string | null;\n};",
    "  deletedBy?: string | null;\n  reason?: string | null;\n};",
  );
}

if (!page.includes("const [deletedSearch")) {
  page = page.replace(
    "  const [deletedUsersLoading, setDeletedUsersLoading] = useState(true);",
    `  const [deletedUsersLoading, setDeletedUsersLoading] = useState(true);
  const [deletedSearch, setDeletedSearch] = useState("");
  const [deletingAuditId, setDeletingAuditId] = useState<number | null>(null);`,
  );
}

if (!page.includes("async function removeDeletedAuditRow")) {
  const anchor = "  async function fetchProfile(user: AdminUser): Promise<UserProfile | null> {";
  if (!page.includes(anchor)) throw new Error("Deleted-user action anchor not found");
  const functions = `  async function removeDeletedAuditRow(user: DeletedUser): Promise<void> {
    if (!window.confirm(\`Remover apenas este registro do histórico?\\n\\n\${user.email}\\n\\nIsso não bloqueia um novo cadastro com o mesmo e-mail.\`)) return;
    setDeletingAuditId(user.id);
    try {
      const token = await getToken();
      const res = await fetch(\`\${BASE}/api/admin/deleted-users/\${user.id}\`, {
        method: "DELETE",
        headers: token ? { Authorization: \`Bearer \${token}\` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setDeletedUsers((current) => current.filter((item) => item.id !== user.id));
      toast({ description: "Registro removido do histórico." });
    } catch {
      toast({ title: "Não foi possível remover o registro", variant: "destructive" });
    } finally {
      setDeletingAuditId(null);
    }
  }

  const visibleDeletedUsers = deletedUsers.filter((user) =>
    user.email.toLowerCase().includes(deletedSearch.trim().toLowerCase()),
  );

`;
  page = page.replace(anchor, `${functions}${anchor}`);
}

const blockStart = page.indexOf('      <div className="space-y-3 pt-4">\n        <div>\n          <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Histórico</p>\n          <h3 className="text-lg font-bold text-white">Usuários excluídos</h3>');
const blockEndMarker = `      </div>\n\n      <Dialog open={!!editingUser}`;
const blockEnd = page.indexOf(blockEndMarker, blockStart);
if (blockStart === -1 || blockEnd === -1) throw new Error("Deleted-user history block not found");

const newBlock = `      <div className="space-y-3 pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Histórico</p>
            <h3 className="text-lg font-bold text-white">Usuários excluídos</h3>
            <p className="text-xs text-muted-foreground">Histórico administrativo. Remover uma linha não bloqueia um novo cadastro com o mesmo e-mail.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={deletedSearch} onChange={(event) => setDeletedSearch(event.target.value)} placeholder="Pesquisar e-mail excluído" className="pl-10 bg-[#111111] border-white/5" />
          </div>
        </div>
        <Card className="bg-[#111111] border-white/5 overflow-hidden">
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 z-10 bg-[#111111]"><tr className="border-b border-white/5">
                <th className="text-left px-5 py-3.5 text-xs text-muted-foreground">Usuário</th>
                <th className="text-left px-4 py-3.5 text-xs text-muted-foreground">Plano anterior</th>
                <th className="text-left px-4 py-3.5 text-xs text-muted-foreground">Motivo</th>
                <th className="text-right px-4 py-3.5 text-xs text-muted-foreground">Excluído em</th>
                <th className="w-12 px-3 py-3.5" />
              </tr></thead>
              <tbody>
                {deletedUsersLoading ? <tr><td colSpan={5} className="p-4"><Skeleton className="h-9 w-full bg-white/5" /></td></tr> : visibleDeletedUsers.length ? visibleDeletedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-5 py-3"><p className="text-white">{user.name ?? "Usuário excluído"}</p><p className="text-xs text-muted-foreground">{user.email}</p></td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-zinc-400 bg-zinc-400/10 border-zinc-400/20">{planLabels[user.previousPlan] ?? user.previousPlan.toUpperCase()}</Badge></td>
                    <td className="max-w-[260px] px-4 py-3 text-xs text-zinc-400"><span className="line-clamp-2" title={user.reason ?? "Não informado"}>{user.reason?.trim() || "Não informado"}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">{new Date(user.deletedAt).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-3 text-right"><button type="button" title="Remover do histórico" onClick={() => void removeDeletedAuditRow(user)} disabled={deletingAuditId === user.id} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40">{deletingAuditId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></td>
                  </tr>
                )) : <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">{deletedSearch.trim() ? "Nenhum e-mail encontrado." : "Nenhum usuário excluído."}</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={!!editingUser}`;
page = page.slice(0, blockStart) + newBlock + page.slice(blockEnd + blockEndMarker.length);

const functionStart = enhancer.indexOf("async function deleteUser(email: string, button: HTMLButtonElement): Promise<void> {");
const functionEnd = enhancer.indexOf("\n}\n\nfunction enhanceRows", functionStart);
if (functionStart === -1 || functionEnd === -1) throw new Error("Manual deletion enhancer function not found");

const deleteFunction = `async function deleteUser(email: string, button: HTMLButtonElement): Promise<void> {
  const reason = window.prompt(\`Informe o motivo da exclusão de \${email}:\`)?.trim() ?? "";
  if (!reason) {
    window.alert("O motivo da exclusão é obrigatório.");
    return;
  }
  if (reason.length > 500) {
    window.alert("O motivo deve ter no máximo 500 caracteres.");
    return;
  }
  const confirmed = window.confirm(\`Excluir o usuário \${email}?\\n\\nMotivo: \${reason}\`);
  if (!confirmed) return;

  button.disabled = true;
  button.style.opacity = "0.45";

  try {
    const token = await getAuthToken();
    if (!token) throw new Error("Sessão administrativa não encontrada. Atualize a página e tente novamente.");

    const userId = await resolveUserId(email, token);
    const response = await fetch(\`/api/admin/users/\${userId}/remove-manual\`, {
      method: "DELETE",
      headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reason }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? "Falha ao excluir usuário.");

    window.dispatchEvent(new CustomEvent("iattom:admin-user-deleted"));
  } catch (error) {
    button.disabled = false;
    button.style.opacity = "1";
    window.alert(error instanceof Error ? error.message : "Falha ao excluir usuário.");
  }
}`;
enhancer = enhancer.slice(0, functionStart) + deleteFunction + enhancer.slice(functionEnd + 2);

for (const marker of [
  "visibleDeletedUsers",
  "Pesquisar e-mail excluído",
  "Remover do histórico",
  "O motivo da exclusão é obrigatório",
  'body: JSON.stringify({ reason })',
]) {
  if (!page.includes(marker) && !enhancer.includes(marker)) throw new Error(`Deleted-user UI marker missing: ${marker}`);
}

fs.writeFileSync(pagePath, page);
fs.writeFileSync(enhancerPath, enhancer);
console.log("Deleted-user history now has required reasons, email search, scrolling and removable audit rows.");
