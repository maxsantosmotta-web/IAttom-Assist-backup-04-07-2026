import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(scriptDir, "../src");
const adminPath = path.join(srcDir, "routes/admin.ts");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const userSyncPath = walk(srcDir).find((file) => {
  if (!file.endsWith(".ts")) return false;
  return fs.readFileSync(file, "utf8").includes("export async function getOrSyncUser");
});
if (!userSyncPath) throw new Error("User synchronization file not found");

let admin = fs.readFileSync(adminPath, "utf8");
let userSync = fs.readFileSync(userSyncPath, "utf8");

const stripeImport = 'import { getUncachableStripeClient } from "../lib/stripeClient.js";';
if (!admin.includes(stripeImport)) {
  const anchor = 'import { getPlansWithPrices } from "../lib/stripeStorage.js";';
  if (!admin.includes(anchor)) throw new Error("Admin Stripe import anchor not found");
  admin = admin.replace(anchor, `${anchor}\n${stripeImport}`);
}

if (!admin.includes("async function ensureDeletedUsersAuditTable()")) {
  const routerAnchor = "const router: IRouter = Router();";
  if (!admin.includes(routerAnchor)) throw new Error("Admin router anchor not found");
  const helper = [
    routerAnchor,
    "",
    'const DELETED_EMAIL_SUFFIX = "@deleted.iattom.invalid";',
    "const ACTIVE_USER_CONDITION = sql`${users.email} NOT LIKE '%@deleted.iattom.invalid'`;",
    "",
    "async function ensureDeletedUsersAuditTable(): Promise<void> {",
    "  await db.execute(sql`",
    "    CREATE TABLE IF NOT EXISTS deleted_users_audit (",
    "      id BIGSERIAL PRIMARY KEY,",
    "      original_email TEXT NOT NULL UNIQUE,",
    "      original_name TEXT,",
    "      previous_plan TEXT NOT NULL,",
    "      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
    "      deleted_by TEXT,",
    "      previous_clerk_id TEXT",
    "    )",
    "  `);",
    "}",
  ].join("\n");
  admin = admin.replace(routerAnchor, helper);
}

admin = admin.replace(
  "db.select({ count: count() }).from(users),",
  "db.select({ count: count() }).from(users).where(ACTIVE_USER_CONDITION),",
);
admin = admin.replace(
  'db.select({ count: count() }).from(users).where(eq(users.role, "admin")),',
  'db.select({ count: count() }).from(users).where(and(ACTIVE_USER_CONDITION, eq(users.role, "admin"))),',
);
for (const plan of ["free", "pro", "business", "agency"]) {
  admin = admin.replace(
    `db.select({ count: count() }).from(users).where(eq(users.plan, "${plan}"))`,
    `db.select({ count: count() }).from(users).where(and(ACTIVE_USER_CONDITION, eq(users.plan, "${plan}")))`,
  );
}

const conditionsAnchor = "  const conditions = [];";
if (!admin.includes("conditions.push(ACTIVE_USER_CONDITION)")) {
  if (!admin.includes(conditionsAnchor)) throw new Error("Admin user list conditions anchor not found");
  admin = admin.replace(conditionsAnchor, `${conditionsAnchor}\n  conditions.push(ACTIVE_USER_CONDITION);`);
}

if (!admin.includes('router.get("/admin/deleted-users"')) {
  const lifecycleRoutes = [
    "",
    'router.get("/admin/deleted-users", requireAdmin, async (_req, res): Promise<void> => {',
    "  await ensureDeletedUsersAuditTable();",
    "  const result = await db.execute(sql`",
    "    SELECT id, original_email, original_name, previous_plan, deleted_at, deleted_by",
    "    FROM deleted_users_audit",
    "    ORDER BY deleted_at DESC",
    "  `);",
    "  res.json((result.rows ?? []).map((row: any) => ({",
    "    id: Number(row.id),",
    "    email: row.original_email,",
    "    name: row.original_name,",
    "    previousPlan: row.previous_plan,",
    "    deletedAt: row.deleted_at,",
    "    deletedBy: row.deleted_by,",
    "  })));",
    "});",
    "",
    'router.delete("/admin/users/:id/remove-manual", requireAdmin, async (req, res): Promise<void> => {',
    "  const id = Number.parseInt(req.params.id as string, 10);",
    '  if (!Number.isInteger(id)) { res.status(400).json({ error: "ID de usuário inválido." }); return; }',
    "",
    "  const [targetUser] = await db.select().from(users).where(eq(users.id, id));",
    '  if (!targetUser) { res.status(404).json({ error: "Usuário não encontrado." }); return; }',
    '  if (targetUser.role === "admin") { res.status(403).json({ error: "Contas administrativas não podem ser excluídas por esta ação." }); return; }',
    "",
    "  try {",
    "    const stripe = await getUncachableStripeClient();",
    "    const customerIds = new Set<string>();",
    "    if (targetUser.stripeCustomerId) customerIds.add(targetUser.stripeCustomerId);",
    "    const customers = await stripe.customers.list({ email: targetUser.email, limit: 100 });",
    "    for (const customer of customers.data) if (!customer.deleted) customerIds.add(customer.id);",
    "    for (const customerId of customerIds) {",
    '      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });',
    "      for (const subscription of subscriptions.data) {",
    '        if (["active", "trialing", "past_due", "unpaid", "incomplete"].includes(subscription.status)) {',
    "          await stripe.subscriptions.cancel(subscription.id);",
    "        }",
    "      }",
    "    }",
    "  } catch (err) {",
    '    req.log.error({ err, userId: id }, "Failed to cancel Stripe subscriptions before deleting user");',
    '    res.status(502).json({ error: "A exclusão foi interrompida porque a assinatura não pôde ser cancelada com segurança." });',
    "    return;",
    "  }",
    "",
    "  await ensureDeletedUsersAuditTable();",
    "  const adminIdentity = (req as any).auth?.userId ?? null;",
    "  await db.execute(sql`",
    "    INSERT INTO deleted_users_audit (original_email, original_name, previous_plan, deleted_at, deleted_by, previous_clerk_id)",
    "    VALUES (${targetUser.email}, ${targetUser.name}, ${targetUser.plan}, NOW(), ${adminIdentity}, ${targetUser.clerkId})",
    "    ON CONFLICT (original_email) DO UPDATE SET",
    "      original_name = EXCLUDED.original_name,",
    "      previous_plan = EXCLUDED.previous_plan,",
    "      deleted_at = NOW(),",
    "      deleted_by = EXCLUDED.deleted_by,",
    "      previous_clerk_id = EXCLUDED.previous_clerk_id",
    "  `);",
    "",
    "  try {",
    "    await clerkClient.users.deleteUser(targetUser.clerkId);",
    "  } catch (err: any) {",
    "    if (err?.status !== 404) {",
    '      req.log.error({ err, userId: id }, "Failed to delete Clerk user");',
    '      res.status(502).json({ error: "A exclusão foi interrompida porque a conta de acesso não pôde ser removida." });',
    "      return;",
    "    }",
    "  }",
    "",
    "  const deletedKey = 'deleted_' + targetUser.id + '_' + Date.now();",
    "  await db.update(users).set({",
    "    email: deletedKey + DELETED_EMAIL_SUFFIX,",
    '    name: "Usuário excluído",',
    '    role: "user",',
    '    plan: "free",',
    "    credits: 0,",
    "    extraCredits: 0,",
    "    creativeCredits: 0,",
    "    extraCreativeCredits: 0,",
    "    videoBalance: 0,",
    "    helpMessagesUsed: 0,",
    "    helpUsedResetAt: null,",
    "    betaAccess: false,",
    "    planSelected: false,",
    "    stripeCustomerId: null,",
    "    stripeSubscriptionId: null,",
    "    stripeSubscriptionStatus: null,",
    "    registrationConfirmed: false,",
    "    updatedAt: new Date(),",
    "  }).where(eq(users.id, id));",
    "",
    "  res.json({ ok: true });",
    "});",
  ].join("\n");

  const routeAnchor = '\nrouter.post("/admin/users/:id/ban", requireAdmin, async (req, res): Promise<void> => {';
  if (!admin.includes(routeAnchor)) throw new Error("Admin lifecycle route insertion anchor not found");
  admin = admin.replace(routeAnchor, `${lifecycleRoutes}${routeAnchor}`);
}

if (!userSync.includes("DELETE FROM deleted_users_audit")) {
  if (userSync.includes('import { eq, count } from "drizzle-orm";')) {
    userSync = userSync.replace(
      'import { eq, count } from "drizzle-orm";',
      'import { eq, count, sql } from "drizzle-orm";',
    );
  }
  const syncAnchor = "export async function getOrSyncUser(clerkId: string, email?: string, name?: string) {";
  if (!userSync.includes(syncAnchor)) throw new Error("User sync function anchor not found");
  const reactivation = [
    syncAnchor,
    "  if (email) {",
    "    await db.execute(sql`",
    "      CREATE TABLE IF NOT EXISTS deleted_users_audit (",
    "        id BIGSERIAL PRIMARY KEY,",
    "        original_email TEXT NOT NULL UNIQUE,",
    "        original_name TEXT,",
    "        previous_plan TEXT NOT NULL,",
    "        deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
    "        deleted_by TEXT,",
    "        previous_clerk_id TEXT",
    "      )",
    "    `);",
    "    await db.execute(sql`DELETE FROM deleted_users_audit WHERE lower(original_email) = lower(${email})`);",
    "  }",
  ].join("\n");
  userSync = userSync.replace(syncAnchor, reactivation);
}

for (const marker of [
  'router.get("/admin/deleted-users"',
  'router.delete("/admin/users/:id/remove-manual"',
  "helpMessagesUsed: 0",
  "videoBalance: 0",
  "stripeSubscriptionId: null",
  "conditions.push(ACTIVE_USER_CONDITION)",
  "DELETE FROM deleted_users_audit",
]) {
  if (!admin.includes(marker) && !userSync.includes(marker)) throw new Error(`Deleted user lifecycle marker missing: ${marker}`);
}

fs.writeFileSync(adminPath, admin);
fs.writeFileSync(userSyncPath, userSync);
console.log("Deleted users leave active metrics, lose all access and balances, and automatically leave the audit list only after a new sign-up.");
