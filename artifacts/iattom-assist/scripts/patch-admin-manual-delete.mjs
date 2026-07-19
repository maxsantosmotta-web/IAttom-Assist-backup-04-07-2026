import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`${label} marker was not found`);
  return source.replace(before, after);
}

const protectedEmail = "maxsantosmotta@gmail.com";

const backendUrl = new URL("../../api-server/src/app.ts", import.meta.url);
let backend = readFileSync(backendUrl, "utf8");

const backendMarker = `app.use("/api", router);`;
const backendRoute = `// Manual user deletion from Admin. The primary administrator is permanently protected.
app.delete("/api/admin/users/:id/remove-manual", requireAdmin, async (req, res): Promise<void> => {
  const id = Number.parseInt(req.params.id as string, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID de usuário inválido" });
    return;
  }

  const [targetUser] = await db.select().from(users).where(eq(users.id, id));
  if (!targetUser) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  if (targetUser.email.trim().toLowerCase() === "${protectedEmail}") {
    res.status(403).json({ error: "A conta principal do administrador não pode ser excluída." });
    return;
  }

  try {
    try {
      await clerkClient.users.deleteUser(targetUser.clerkId);
    } catch (clerkError: unknown) {
      const status = typeof clerkError === "object" && clerkError !== null && "status" in clerkError
        ? Number((clerkError as { status?: unknown }).status)
        : undefined;
      if (status !== 404) {
        req.log.error({ err: clerkError, clerkId: targetUser.clerkId }, "Manual user deletion failed in Clerk");
        res.status(502).json({ error: "Não foi possível excluir a conta no Clerk. Nenhuma alteração foi feita no banco." });
        return;
      }
    }

    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (!deleted) {
      res.status(500).json({ error: "O banco não confirmou a exclusão do usuário." });
      return;
    }

    res.json({ ok: true, deletedEmail: targetUser.email });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido";
    req.log.error({ err, userId: id, clerkId: targetUser.clerkId }, "Manual user deletion failed");
    res.status(500).json({ error: `Falha ao excluir usuário: ${detail}` });
  }
});

${backendMarker}`;
backend = replaceRequired(backend, backendMarker, backendRoute, "manual delete backend route");
writeFileSync(backendUrl, backend);

const frontendUrl = new URL("../src/pages/admin/AdminUsers.tsx", import.meta.url);
let frontend = readFileSync(frontendUrl, "utf8");

frontend = replaceRequired(
  frontend,
  `import { Search, Loader2, Users, Edit2, Zap, Plus, Minus, RefreshCw, Eye, Activity, CreditCard, FolderOpen, Download, UserX, UserCheck, ShieldOff } from "lucide-react";`,
  `import { Search, Loader2, Users, Edit2, Zap, Plus, Minus, RefreshCw, Eye, Activity, CreditCard, FolderOpen, Download, UserX, UserCheck, ShieldOff, Trash2 } from "lucide-react";`,
  "Trash icon import",
);

frontend = replaceRequired(
  frontend,
  `  const [banLoading, setBanLoading] = useState(false);`,
  `  const [banLoading, setBanLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; email: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);`,
  "delete state",
);

frontend = replaceRequired(
  frontend,
  `  const handleCreditAdjust = () => {`,
  `  const handleDeleteUser = async () => {
    if (!deleteTarget || deleteTarget.email.trim().toLowerCase() === "${protectedEmail}") return;

    setDeleteLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(\`\${BASE}/api/admin/users/\${deleteTarget.id}/remove-manual\`, {
        method: "DELETE",
        headers: { Authorization: \`Bearer \${token}\` },
      });
      const payload = await res.json().catch(() => null) as { error?: string; deletedEmail?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? "Falha ao excluir usuário.");

      await queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
      await refetch();
      toast({ description: \`Usuário \${payload?.deletedEmail ?? deleteTarget.email} excluído.\` });
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast({
        title: "Falha ao excluir usuário",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreditAdjust = () => {`,
  "delete handler",
);

frontend = replaceRequired(
  frontend,
  `                            )}
                          </div>`,
  `                            )}
                            {user.email.trim().toLowerCase() !== "${protectedEmail}" && (
                              <button
                                onClick={() => setDeleteTarget({ id: user.id, email: user.email })}
                                title="Excluir usuário"
                                className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>`,
  "delete action button",
);

const dialogMarker = `      {/* ── DIALOG: Perfil Expandido ──────────────────────────────── */}`;
const deleteDialog = `      {/* ── DIALOG: Excluir Usuário ───────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleteLoading) setDeleteTarget(null); }}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400" /> Excluir Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/[0.05] border border-red-500/20 mb-3">
              <Trash2 className="w-4 h-4 shrink-0 text-red-400" />
              <p className="text-sm text-zinc-300 break-all">{deleteTarget?.email}</p>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Esta ação exclui a conta do Clerk e remove o usuário do banco. Ela não pode ser desfeita.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className="text-muted-foreground">
              Cancelar
            </Button>
            <Button
              onClick={() => void handleDeleteUser()}
              disabled={deleteLoading}
              className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-semibold"
            >
              {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

${dialogMarker}`;
frontend = replaceRequired(frontend, dialogMarker, deleteDialog, "delete confirmation dialog");
writeFileSync(frontendUrl, frontend);

console.log("Safe manual Admin user deletion enabled without anonymization or name filters.");
