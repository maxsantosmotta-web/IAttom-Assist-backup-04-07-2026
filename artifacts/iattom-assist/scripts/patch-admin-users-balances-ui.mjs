import fs from "node:fs";

const filePath = new URL("../src/pages/admin/AdminUsers.tsx", import.meta.url);
let source = fs.readFileSync(filePath, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Admin users UI patch anchor not found: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
`const planLabels: Record<string, string> = {
  free: "Gratuito",
  pro: "Pro",
  business: "Empresarial",
  agency: "Agência",
};`,
`const planLabels: Record<string, string> = {
  free: "Gratuito",
  pro: "START",
  business: "PREMIUM",
  agency: "PRO",
};`,
"public plan labels",
);

replaceOnce(
`const planPT: Record<string, string> = {
  free: "Gratuito", pro: "Pro", business: "Empresarial", agency: "Agência",
};`,
`const planPT: Record<string, string> = {
  free: "Gratuito", pro: "START", business: "PREMIUM", agency: "PRO",
};`,
"profile plan labels",
);

replaceOnce('            <SelectItem value="free">Start</SelectItem>\n            <SelectItem value="pro">Completo</SelectItem>\n            <SelectItem value="business">Premium</SelectItem>\n            <SelectItem value="agency">Pro</SelectItem>', '            <SelectItem value="free">Gratuito</SelectItem>\n            <SelectItem value="pro">START</SelectItem>\n            <SelectItem value="business">PREMIUM</SelectItem>\n            <SelectItem value="agency">PRO</SelectItem>', "plan filter labels");

replaceOnce('                  <SelectItem value="free">Gratuito</SelectItem>\n                  <SelectItem value="pro">Pro</SelectItem>\n                  <SelectItem value="business">Empresarial</SelectItem>\n                  <SelectItem value="agency">Agência</SelectItem>', '                  <SelectItem value="free">Gratuito</SelectItem>\n                  <SelectItem value="pro">START</SelectItem>\n                  <SelectItem value="business">PREMIUM</SelectItem>\n                  <SelectItem value="agency">PRO</SelectItem>', "edit plan labels");

replaceOnce(
`type CreditAdjust = {
  userId: number;
  userEmail: string;
  amount: string;
  description: string;
};`,
`type CreditAdjust = {
  userId: number;
  userEmail: string;
  generalCredits: string;
  images: string;
  description: string;
};`,
"balance editor state",
);

replaceOnce(
`type UserProfile = AdminUser & {
  stripeSubscriptionStatus: string | null;`,
`type UserProfile = AdminUser & {
  extraCredits: number;
  creativeCredits: number;
  extraCreativeCredits: number;
  stripeSubscriptionStatus: string | null;`,
"profile balance fields",
);

replaceOnce(
`    id: number; amount: number; type: string; feature: string | null;
    description: string | null; balanceBefore: number; balanceAfter: number; createdAt: string;`,
`    id: number; amount: number; type: string; feature: string | null; balanceType?: string | null;
    description: string | null; balanceBefore: number; balanceAfter: number; createdAt: string;`,
"transaction balance type",
);

replaceOnce(
`  const adjustCredits = useAdminAdjustCredits();`,
`  const adjustCredits = useAdminAdjustCredits(); // legado mantido apenas para compatibilidade do cliente gerado`,
"legacy generated hook marker",
);

replaceOnce(
`  const openCreditAdjust = (user: AdminUser) => {
    setCreditAdjust({ userId: user.id, userEmail: user.email, amount: "", description: "" });
  };`,
`  const openCreditAdjust = (user: AdminUser) => {
    setCreditAdjust({ userId: user.id, userEmail: user.email, generalCredits: String(user.credits), images: "0", description: "Teste/controladoria pelo ADM" });
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch(\`${BASE}/api/admin/users/${user.id}\`, { headers: { Authorization: \`Bearer ${token}\` } });
        if (!res.ok) return;
        const profile = await res.json() as UserProfile;
        const totalGeneral = profile.credits + (profile.extraCredits ?? 0);
        const totalCreative = profile.creativeCredits + (profile.extraCreativeCredits ?? 0);
        setCreditAdjust((current) => current?.userId === user.id ? {
          ...current,
          generalCredits: String(totalGeneral),
          images: String(Math.floor(totalCreative / 10)),
        } : current);
      } catch { /* mantém os valores disponíveis na tabela */ }
    })();
  };`,
"open complete balance editor",
);

const oldHandlerStart = source.indexOf("  const handleCreditAdjust = () => {");
const oldHandlerEnd = source.indexOf("\n  return (", oldHandlerStart);
if (oldHandlerStart < 0 || oldHandlerEnd < 0) throw new Error("Admin users UI patch anchor not found: balance handler");
const newHandler = `  const handleCreditAdjust = () => {
    if (!creditAdjust) return;
    const generalCredits = parseInt(creditAdjust.generalCredits, 10);
    const images = parseInt(creditAdjust.images, 10);
    if (!Number.isInteger(generalCredits) || generalCredits < 0 || !Number.isInteger(images) || images < 0) return;
    if (!creditAdjust.description.trim()) return;

    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch(\`${BASE}/api/admin/users/${creditAdjust.userId}/balances\`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: \`Bearer ${token}\`,
          },
          body: JSON.stringify({ generalCredits, images, description: creditAdjust.description }),
        });
        if (!res.ok) throw new Error(await res.text());
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        setCreditAdjust(null);
        toast({ description: \`Saldo definido: ${generalCredits} créditos e ${images} imagens.\` });
      } catch {
        toast({ description: "Falha ao definir os saldos do usuário.", variant: "destructive" });
      }
    })();
  };
`;
source = source.slice(0, oldHandlerStart) + newHandler + source.slice(oldHandlerEnd);

const dialogStart = source.indexOf("      <Dialog open={!!creditAdjust}");
const dialogEndMarker = "      {/* ── DIALOG: Confirmar Ban/Unban";
const dialogEnd = source.indexOf(dialogEndMarker, dialogStart);
if (dialogStart < 0 || dialogEnd < 0) throw new Error("Admin users UI patch anchor not found: balance dialog");
const newDialog = `      <Dialog open={!!creditAdjust} onOpenChange={(open) => !open && setCreditAdjust(null)}>
        <DialogContent className="bg-[#111111] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Definir Saldos
            </DialogTitle>
            {creditAdjust && <p className="text-xs text-muted-foreground">{creditAdjust.userEmail}</p>}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Créditos gerais disponíveis</Label>
              <Input type="number" min={0} value={creditAdjust?.generalCredits ?? ""}
                onChange={(e) => setCreditAdjust((s) => s ? { ...s, generalCredits: e.target.value } : s)}
                className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Imagens disponíveis</Label>
              <Input type="number" min={0} value={creditAdjust?.images ?? ""}
                onChange={(e) => setCreditAdjust((s) => s ? { ...s, images: e.target.value } : s)}
                className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50" />
              <p className="text-[10px] text-zinc-600">Cada imagem corresponde a 10 créditos internos. O usuário verá apenas a quantidade de imagens.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Motivo / Descrição</Label>
              <Input value={creditAdjust?.description ?? ""}
                onChange={(e) => setCreditAdjust((s) => s ? { ...s, description: e.target.value } : s)}
                className="bg-[#0a0a0a] border-white/10 focus-visible:ring-primary/50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreditAdjust(null)} className="text-muted-foreground">Cancelar</Button>
            <Button onClick={handleCreditAdjust}
              disabled={!creditAdjust?.generalCredits || !creditAdjust?.images || !creditAdjust?.description.trim()}
              className="bg-primary text-black hover:bg-primary/90 font-semibold">Definir Saldos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
`;
source = source.slice(0, dialogStart) + newDialog + source.slice(dialogEnd);

replaceOnce(
`                  { icon: Zap,        label: "Créditos",        value: profileData.credits.toLocaleString("pt-BR"),      color: "text-primary" },
                  { icon: FolderOpen, label: "Projetos",        value: profileData.projectCount.toLocaleString("pt-BR"), color: "text-blue-400" },`,
`                  { icon: Zap,        label: "Créditos",        value: (profileData.credits + (profileData.extraCredits ?? 0)).toLocaleString("pt-BR"), color: "text-primary" },
                  { icon: Zap,        label: "Imagens",         value: Math.floor((profileData.creativeCredits + (profileData.extraCreativeCredits ?? 0)) / 10).toLocaleString("pt-BR"), color: "text-violet-400" },
                  { icon: FolderOpen, label: "Projetos",        value: profileData.projectCount.toLocaleString("pt-BR"), color: "text-blue-400" },`,
"profile total balances",
);

replaceOnce(
`                              {tx.feature ?? tx.description ?? "—"}`,
`                              {tx.balanceType === "creative"
                                ? (tx.description?.includes("Compra") ? "Compra de imagens" : tx.feature?.startsWith("creativeImage") ? "Geração de imagens" : tx.description ?? "Imagens")
                                : tx.feature === "prompt_creation" ? "Criação de prompt"
                                : tx.feature === "campaign" ? "Criação de campanha"
                                : tx.description ?? tx.feature ?? "—"}`,
"readable transaction names",
);

replaceOnce(
`                              {tx.amount >= 0 ? "+" : ""}{tx.amount}`,
`                              {tx.amount >= 0 ? "+" : ""}{tx.balanceType === "creative" ? tx.amount / 10 : tx.amount}{tx.balanceType === "creative" ? " img" : ""}`,
"transaction values by balance",
);

replaceOnce(
`                            <td className="px-3 py-2 text-right text-zinc-400 font-mono">{tx.balanceAfter}</td>`,
`                            <td className="px-3 py-2 text-right text-zinc-400 font-mono">{tx.balanceType === "creative" ? `${tx.balanceAfter / 10} img` : tx.balanceAfter}</td>`,
"transaction balance display",
);

fs.writeFileSync(filePath, source);
console.log("Admin users public plan names and complete balance controls patched.");
