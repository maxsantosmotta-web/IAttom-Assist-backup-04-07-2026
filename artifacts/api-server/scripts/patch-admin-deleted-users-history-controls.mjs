import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const adminPath = path.resolve(scriptDir, "../src/routes/admin.ts");
let source = fs.readFileSync(adminPath, "utf8");

const helperAnchor = `async function ensureDeletedUsersAuditTable(): Promise<void> {
  await db.execute(sql\`
    CREATE TABLE IF NOT EXISTS deleted_users_audit (`;
if (!source.includes(helperAnchor)) throw new Error("Deleted-user audit helper not found");

if (!source.includes("ADD COLUMN IF NOT EXISTS deletion_reason")) {
  const helperEnd = `  \`);
}`;
  const helperStart = source.indexOf(helperAnchor);
  const helperClose = source.indexOf(helperEnd, helperStart);
  if (helperClose === -1) throw new Error("Deleted-user audit helper end not found");
  const insertion = `  \`);
  await db.execute(sql\`
    ALTER TABLE deleted_users_audit
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT
  \`);
}`;
  source = source.slice(0, helperClose) + insertion + source.slice(helperClose + helperEnd.length);
}

const getStart = source.indexOf('router.get("/admin/deleted-users"');
const getEndMarker = `});\n\nrouter.delete("/admin/users/:id/remove-manual"`;
const getEnd = source.indexOf(getEndMarker, getStart);
if (getStart === -1 || getEnd === -1) throw new Error("Deleted-user GET route not found");

const replacement = `router.get("/admin/deleted-users", requireAdmin, async (req, res): Promise<void> => {
  await ensureDeletedUsersAuditTable();
  const search = String(req.query.search ?? "").trim();
  const result = search
    ? await db.execute(sql\`
        SELECT id, original_email, original_name, previous_plan, deleted_at, deleted_by, deletion_reason
        FROM deleted_users_audit
        WHERE original_email ILIKE ${"${`%${search}%`}"}
        ORDER BY deleted_at DESC
      \`)
    : await db.execute(sql\`
        SELECT id, original_email, original_name, previous_plan, deleted_at, deleted_by, deletion_reason
        FROM deleted_users_audit
        ORDER BY deleted_at DESC
      \`);
  res.json((result.rows ?? []).map((row: any) => ({
    id: Number(row.id),
    email: row.original_email,
    name: row.original_name,
    previousPlan: row.previous_plan,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    reason: row.deletion_reason ?? null,
  })));
});

router.delete("/admin/deleted-users/:id", requireAdmin, async (req, res): Promise<void> => {
  await ensureDeletedUsersAuditTable();
  const id = Number.parseInt(String(req.params.id ?? ""), 10);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "ID inválido." }); return; }
  const result = await db.execute(sql\`DELETE FROM deleted_users_audit WHERE id = ${"${id}"} RETURNING id\`);
  if (!(result.rows ?? []).length) { res.status(404).json({ error: "Registro não encontrado." }); return; }
  res.json({ ok: true });
});

router.delete("/admin/users/:id/remove-manual"`;
source = source.slice(0, getStart) + replacement + source.slice(getEnd + getEndMarker.length);

const routeStart = source.indexOf('router.delete("/admin/users/:id/remove-manual"');
if (routeStart === -1) throw new Error("Manual deletion route not found");

const idValidation = `  if (!Number.isInteger(id)) { res.status(400).json({ error: "ID de usuário inválido." }); return; }`;
const idPosition = source.indexOf(idValidation, routeStart);
if (idPosition === -1) throw new Error("Manual deletion ID validation not found");
if (!source.slice(routeStart, routeStart + 900).includes("deletionReason")) {
  const reasonBlock = `${idValidation}
  const deletionReason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!deletionReason) { res.status(400).json({ error: "Informe o motivo da exclusão." }); return; }
  if (deletionReason.length > 500) { res.status(400).json({ error: "O motivo deve ter no máximo 500 caracteres." }); return; }`;
  source = source.slice(0, idPosition) + source.slice(idPosition).replace(idValidation, reasonBlock);
}

const insertOld = `    INSERT INTO deleted_users_audit (original_email, original_name, previous_plan, deleted_at, deleted_by, previous_clerk_id)
    VALUES (${"${targetUser.email}"}, ${"${targetUser.name}"}, ${"${targetUser.plan}"}, NOW(), ${"${adminIdentity}"}, ${"${targetUser.clerkId}"})`;
const insertNew = `    INSERT INTO deleted_users_audit (original_email, original_name, previous_plan, deleted_at, deleted_by, previous_clerk_id, deletion_reason)
    VALUES (${"${targetUser.email}"}, ${"${targetUser.name}"}, ${"${targetUser.plan}"}, NOW(), ${"${adminIdentity}"}, ${"${targetUser.clerkId}"}, ${"${deletionReason}"})`;
if (source.includes(insertOld)) source = source.replace(insertOld, insertNew);

const conflictOld = `      previous_clerk_id = EXCLUDED.previous_clerk_id`;
const conflictNew = `      previous_clerk_id = EXCLUDED.previous_clerk_id,
      deletion_reason = EXCLUDED.deletion_reason`;
const conflictPosition = source.indexOf(conflictOld, routeStart);
if (conflictPosition !== -1 && !source.slice(conflictPosition, conflictPosition + 150).includes("deletion_reason")) {
  source = source.slice(0, conflictPosition) + source.slice(conflictPosition).replace(conflictOld, conflictNew);
}

for (const marker of [
  "ADD COLUMN IF NOT EXISTS deletion_reason",
  'router.delete("/admin/deleted-users/:id"',
  "Informe o motivo da exclusão",
  "deletion_reason = EXCLUDED.deletion_reason",
]) {
  if (!source.includes(marker)) throw new Error(`Deleted-user history marker missing: ${marker}`);
}

fs.writeFileSync(adminPath, source);
console.log("Deleted-user audit supports reason, search and removable history rows without blocking re-registration.");
