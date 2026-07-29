import fs from "node:fs";

const pagePath = new URL("../src/pages/admin/AdminUsers.tsx", import.meta.url);
const enhancerPath = new URL("../src/lib/adminManualDeleteEnhancer.ts", import.meta.url);
let page = fs.readFileSync(pagePath, "utf8");
let enhancer = fs.readFileSync(enhancerPath, "utf8");

if (!page.includes("type DeletedUser")) {
  const typeAnchor = 'type EditState = { role: Role; plan: Plan };';
  if (!page.includes(typeAnchor)) throw new Error("Deleted users type anchor not found");
  page = page.replace(typeAnchor, `type DeletedUser = {
  id: number;
  email: string;
  name?: string | null;
  previousPlan: string;
  deletedAt: string;
  deletedBy?: string | null;
};

${typeAnchor}`);
}

if (!page.includes("planSelected?: boolean;")) {
  const adminUserAnchor = "  banned: boolean;\n};";
  if (!page.includes(adminUserAnchor)) throw new Error("AdminUser type anchor not found");
  page = page.replace(adminUserAnchor, "  banned: boolean;\n  planSelected?: boolean;\n};");
}

if (!page.includes("const [deletedUsers")) {
  const stateAnchor = "  const [banLoading, setBanLoading] = useState(false);";
  if (!page.includes(stateAnchor)) throw new Error("Deleted users state anchor not found");
  page = page.replace(stateAnchor, `${stateAnchor}
  const [deletedUsers, setDeletedUsers] = useState<DeletedUser[]>([]);
  const [deletedUsersLoading, setDeletedUsersLoading] = useState(true);`);
}

if (!page.includes("async function fetchDeletedUsers")) {
  const functionAnchor = "  async function fetchProfile(user: AdminUser): Promise<UserProfile | null> {";
  if (!page.includes(functionAnchor)) throw new Error("Deleted users function anchor not found");
  const functions = `  async function fetchDeletedUsers(): Promise<void> {
    setDeletedUsersLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(\`\${BASE}/api/admin/deleted-users\`, {
        headers: token ? { Authorization: \`Bearer \${token}\` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setDeletedUsers(await res.json() as DeletedUser[]);
    } catch {
      setDeletedUsers([]);
    } finally {
      setDeletedUsersLoading(false);
    }
  }

  useEffect(() => {
    void fetchDeletedUsers();
  }, []);

  useEffect(() => {
    const handleDeletedUser = () => {
      void refetch();
      void fetchDeletedUsers();
    };
    window.addEventListener("iattom:admin-user-deleted", handleDeletedUser);
    return () => window.removeEventListener("iattom:admin-user-deleted", handleDeletedUser);
  }, [refetch]);

`;
  page = page.replace(functionAnchor, `${functions}${functionAnchor}`);
}

page = page.replaceAll("{data?.total ?? 0}", "{activeUsers.length}");
page = page.replaceAll(
  '((data?.users ?? []) as AdminUser[]).filter((user) => user.role === "user").length',
  'activeUsers.filter((user) => user.role === "user").length',
);
page = page.replaceAll(
  '((data?.users ?? []) as AdminUser[]).filter((user) => user.role === "admin").length',
  'activeUsers.filter((user) => user.role === "admin").length',
);
page = page.replaceAll(
  '((data?.users ?? []) as AdminUser[]).reduce((sum, user) => sum + Number(user.credits || 0), 0)',
  'activeUsers.reduce((sum, user) => sum + Number(user.credits || 0), 0)',
);
page = page.replaceAll(
  '((data?.users ?? []) as AdminUser[]).reduce((sum, user) => sum + Number(user.credits || 0) + Number(user.extraCredits || 0), 0)',
  'activeUsers.reduce((sum, user) => sum + Number(user.credits || 0) + Number(user.extraCredits || 0), 0)',
);
page = page.replace(
  "(data?.users as AdminUser[] | undefined)?.map((user) => {",
  "activeUsers.map((user) => {",
);

if (!page.includes("const activeUsers =")) {
  const queryAnchor = `  const { data, isLoading, isFetching, refetch } = useListAdminUsers(params, {
    query: { queryKey: getListAdminUsersQueryKey(params) },
  });`;
  if (!page.includes(queryAnchor)) throw new Error("Admin users query anchor not found");
  page = page.replace(queryAnchor, `${queryAnchor}

  const activeUsers = ((data?.users ?? []) as AdminUser[]).filter(
    (user) => !user.email.toLowerCase().endsWith("@deleted.iattom.invalid"),
  );`);
}

page = page.replace(
  '<Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching} className="gap-1.5">',
  '<Button size="sm" variant="outline" onClick={() => window.location.reload()} disabled={isFetching} className="gap-1.5">',
);
page = page.replace(
  '<Button size="sm" variant="outline" onClick={() => { void refetch(); void fetchDeletedUsers(); }} disabled={isFetching} className="gap-1.5">',
  '<Button size="sm" variant="outline" onClick={() => window.location.reload()} disabled={isFetching} className="gap-1.5">',
);

const planCell = '<td className="px-4 py-3"><Badge variant="outline" className={planColors[user.plan]}>{planLabels[user.plan]}</Badge></td>';
const planCellWithSelection = '<td className="px-4 py-3">{user.planSelected ? <Badge variant="outline" className={planColors[user.plan]}>{planLabels[user.plan]}</Badge> : <span className="text-muted-foreground">—</span>}</td>';
if (!page.includes(planCellWithSelection)) {
  if (!page.includes(planCell)) throw new Error("Admin plan cell anchor not found");
  page = page.replace(planCell, planCellWithSelection);
}

if (!page.includes("Usuários excluídos")) {
  const cardAnchor = `      </Card>\n\n      <Dialog open={!!editingUser}`;
  if (!page.includes(cardAnchor)) throw new Error("Deleted users card anchor not found");
  const deletedBlock = `      </Card>

      <div className="space-y-3 pt-4">
        <div>
          <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Histórico</p>
          <h3 className="text-lg font-bold text-white">Usuários excluídos</h3>
          <p className="text-xs text-muted-foreground">Saem automaticamente desta lista somente quando realizam um novo cadastro.</p>
        </div>
        <Card className="bg-[#111111] border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5">
                <th className="text-left px-5 py-3.5 text-xs text-muted-foreground">Usuário</th>
                <th className="text-left px-4 py-3.5 text-xs text-muted-foreground">Plano anterior</th>
                <th className="text-right px-4 py-3.5 text-xs text-muted-foreground">Excluído em</th>
              </tr></thead>
              <tbody>
                {deletedUsersLoading ? <tr><td colSpan={3} className="p-4"><Skeleton className="h-9 w-full bg-white/5" /></td></tr> : deletedUsers.length ? deletedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/5">
                    <td className="px-5 py-3"><p className="text-white">{user.name ?? "Usuário excluído"}</p><p className="text-xs text-muted-foreground">{user.email}</p></td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-zinc-400 bg-zinc-400/10 border-zinc-400/20">{planLabels[user.previousPlan] ?? user.previousPlan.toUpperCase()}</Badge></td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{new Date(user.deletedAt).toLocaleString("pt-BR")}</td>
                  </tr>
                )) : <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum usuário excluído.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={!!editingUser}`;
  page = page.replace(cardAnchor, deletedBlock);
}

enhancer = enhancer.replace(
  "Excluir definitivamente o usuário ${email}?\\n\\nA conta será removida do Clerk e do banco de dados.",
  "Excluir o usuário ${email}?",
);
enhancer = enhancer.replace(
  "Excluir o usuário ${email}?\\n\\nEle perderá plano, saldos e acesso, e será movido para Usuários excluídos.",
  "Excluir o usuário ${email}?",
);
enhancer = enhancer.replace(
  "    window.location.reload();",
  '    window.dispatchEvent(new CustomEvent("iattom:admin-user-deleted"));',
);

for (const marker of [
  "type DeletedUser",
  "planSelected?: boolean;",
  "fetchDeletedUsers",
  "Usuários excluídos",
  "/api/admin/deleted-users",
  "window.location.reload()",
  "const activeUsers =",
  "activeUsers.map((user) => {",
  "iattom:admin-user-deleted",
  "user.planSelected ?",
]) {
  if (!page.includes(marker) && !enhancer.includes(marker)) throw new Error(`Deleted users frontend marker missing: ${marker}`);
}
if (page.includes("const activeUsers = activeUsers")) throw new Error("Active users self-reference detected");
if (enhancer.includes("Ele perderá plano")) throw new Error("Verbose deletion confirmation remains");

fs.writeFileSync(pagePath, page);
fs.writeFileSync(enhancerPath, enhancer);
console.log("Admin users now shows a dash until planSelected becomes true, while preserving inline deletion flow.");
