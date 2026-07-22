import fs from "node:fs";

const routePath = new URL("../src/routes/admin.ts", import.meta.url);
let source = fs.readFileSync(routePath, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Admin balance patch anchor not found: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  "    return { ...u, projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };",
  "    return { ...u, credits: u.credits + (u.extraCredits ?? 0), projectCount: pc.count, actionCount: ac.count, banned: clerkBannedMap.get(u.clerkId) ?? false };",
  "admin user list total credits",
);

const balancesRoute = `

/* ── POST /admin/users/:id/balances — define saldos finais para teste/suporte ── */
router.post("/admin/users/:id/balances", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const parsed = z.object({
    generalCredits: z.number().int().min(0),
    images: z.number().int().min(0),
    description: z.string().trim().min(3).max(240),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [targetUser] = await db.select().from(users).where(eq(users.id, id));
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  const generalBefore = targetUser.credits + (targetUser.extraCredits ?? 0);
  const creativeBefore = targetUser.creativeCredits + (targetUser.extraCreativeCredits ?? 0);
  const creativeAfter = parsed.data.images * 10;

  const [updated] = await db.update(users).set({
    credits: parsed.data.generalCredits,
    extraCredits: 0,
    creativeCredits: creativeAfter,
    extraCreativeCredits: 0,
    updatedAt: new Date(),
  }).where(eq(users.id, id)).returning();

  await db.insert(creditsTransactions).values([
    {
      clerkUserId: targetUser.clerkId,
      amount: parsed.data.generalCredits - generalBefore,
      type: "adjustment",
      balanceType: "general",
      description: `Ajuste administrativo de créditos gerais — ${parsed.data.description}`,
      balanceBefore: generalBefore,
      balanceAfter: parsed.data.generalCredits,
    },
    {
      clerkUserId: targetUser.clerkId,
      amount: creativeAfter - creativeBefore,
      type: "adjustment",
      balanceType: "creative",
      description: `Ajuste administrativo de imagens — ${parsed.data.description}`,
      balanceBefore: creativeBefore,
      balanceAfter: creativeAfter,
    },
  ]);

  res.json({
    ...updated,
    generalBalance: parsed.data.generalCredits,
    creativeBalance: creativeAfter,
    images: parsed.data.images,
  });
});`;

if (!source.includes('router.post("/admin/users/:id/balances"')) {
  const anchor = "\nrouter.post(\"/admin/users/:id/ban\", requireAdmin, async (req, res): Promise<void> => {";
  if (!source.includes(anchor)) throw new Error("Admin balance patch anchor not found: insert balances route");
  source = source.replace(anchor, `${balancesRoute}${anchor}`);
}

replaceOnce(
  '  const PLAN_PT: Record<string, string> = { free: "Gratuito", pro: "Pro", business: "Completo", agency: "Agência" };',
  '  const PLAN_PT: Record<string, string> = { free: "Gratuito", pro: "START", business: "PREMIUM", agency: "PRO" };',
  "CSV public plan labels",
);

fs.writeFileSync(routePath, source);
console.log("Admin user balances and public plan labels patched.");
