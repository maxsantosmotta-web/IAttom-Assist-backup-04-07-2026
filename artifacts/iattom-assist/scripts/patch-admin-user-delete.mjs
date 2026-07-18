import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`${label} marker was not found`);
  return source.replace(before, after);
}

const protectedEmail = "maxsantosmotta@gmail.com";

const backendUrl = new URL("../../api-server/src/routes/admin.ts", import.meta.url);
let backend = readFileSync(backendUrl, "utf8");

const backendMarker = `router.post("/admin/users/:id/unban", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const [targetUser] = await db.select({ clerkId: users.clerkId }).from(users).where(eq(users.id, id));
  if (!targetUser) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  try {
    await clerkClient.users.unbanUser(targetUser.clerkId);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to unban user");
    res.status(500).json({ error: "Falha ao desbloquear usuário" });
  }
});`;

const backendReplacement = `${backendMarker}

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID de usuário inválido" }); return; }

  const [targetUser] = await db.select().from(users).where(eq(users.id, id));
  if (!targetUser) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  if (targetUser.email.trim().toLowerCase() === "${protectedEmail}") {
    res.status(403).json({ error: "A conta principal do administrador não pode ser excluída." });
    return;
  }

  try {
    try {
      await clerkClient.users.deleteUser(targetUser.clerkId);
    } catch (clerkError: unknown) {
      req.log.warn({ err: clerkError, clerkId: targetUser.clerkId }, "Clerk deletion failed; continuing safe anonymization");
    }

    const deletedEmail = \`deleted_\${targetUser.id}_\${Date.now()}@deleted.iattom.invalid\`;
    const [updated] = await db.update(users).set({
      email: deletedEmail,
      name: "Usuário excluído",
      updatedAt: new Date(),
    }).where(eq(users.id, targetUser.id)).returning({ id: users.id });

    if (!updated) {
      res.status(500).json({ error: "O banco não confirmou a remoção do usuário." });
      return;
    }

    res.json({ ok: true, deletedEmail: targetUser.email, cleanupMode: "anonymized" });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido";
    req.log.error({ err, userId: id, clerkId: targetUser.clerkId }, "Failed to anonymize legacy user");
    res.status(500).json({ error: `Falha ao remover usuário do painel: ${detail}` });
  }
});`;

backend = replaceRequired(backend, backendMarker, backendReplacement, "admin delete endpoint");
backend = backend.replace(
  `  const conditions = [];`,
  `  const conditions = [ne(users.name, "Usuário excluído")];`,
);
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
      const res = await fetch(\`${"${BASE}"}/api/admin/users/${"${deleteTarget.id}"}\`, {
        method: "DELETE",
        headers: { Authorization: \`Bearer ${"${token}"}\` },
      });
      const payload = await res.json().catch(() => null) as { error?: string; deletedEmail?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? "Falha ao excluir usuário.");

      await queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
      await refetch();
      toast({ description: \`Usuário ${"${payload?.deletedEmail ?? deleteTarget.email}"} removido do painel.\` });
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
                                title="Excluir usuário definitivamente"
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
              Esta ação remove a conta do painel, libera o e-mail para novo cadastro e não pode ser desfeita.
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

console.log("Protected safe user removal added to Admin Users.");