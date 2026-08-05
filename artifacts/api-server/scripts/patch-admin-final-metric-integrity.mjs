import fs from "node:fs";

const adminPath = new URL("../src/routes/admin.ts", import.meta.url);
const growthPath = new URL("../src/routes/adminGrowth.ts", import.meta.url);
let admin = fs.readFileSync(adminPath, "utf8");
let growth = fs.readFileSync(growthPath, "utf8");

const totalUsersOld = "    db.select({ count: count() }).from(users),";
const totalUsersNew = "    db.select({ count: count() }).from(users).where(isNull(users.deletedAt)),";
if (!admin.includes(totalUsersNew)) {
  if (!admin.includes(totalUsersOld)) throw new Error("Admin stats total-users anchor not found");
  admin = admin.replace(totalUsersOld, totalUsersNew);
}

if (!growth.includes("isNull,")) {
  growth = growth.replace(
    'import { eq, gte, and, count, sql } from "drizzle-orm";',
    'import { eq, gte, and, count, sql, isNull } from "drizzle-orm";',
  );
}

const activitySummaryRoute = `
router.get("/admin/activity-summary", requireAdmin, async (_req, res): Promise<void> => {
  const [[periodCounts], dailyRows] = await Promise.all([
    db.select({
      today: sql<number>\`count(*) filter (where (\${historyTable.createdAt} at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date)::int\`,
      last7Days: sql<number>\`count(*) filter (where \${historyTable.createdAt} >= now() - interval '7 days')::int\`,
      last30Days: sql<number>\`count(*) filter (where \${historyTable.createdAt} >= now() - interval '30 days')::int\`,
    })
      .from(historyTable)
      .where(isNull(historyTable.deletedAt)),
    db.select({
      day: sql<string>\`to_char((\${historyTable.createdAt} at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')\`,
      total: count(),
    })
      .from(historyTable)
      .where(and(
        isNull(historyTable.deletedAt),
        sql\`\${historyTable.createdAt} >= now() - interval '14 days'\`,
      ))
      .groupBy(sql\`(\${historyTable.createdAt} at time zone 'America/Sao_Paulo')::date\`)
      .orderBy(sql\`(\${historyTable.createdAt} at time zone 'America/Sao_Paulo')::date\`),
  ]);

  res.setHeader("Cache-Control", "no-store");
  res.json({
    today: Number(periodCounts?.today ?? 0),
    last7Days: Number(periodCounts?.last7Days ?? 0),
    last30Days: Number(periodCounts?.last30Days ?? 0),
    daily14: dailyRows.map((row) => ({ day: row.day, total: Number(row.total ?? 0) })),
  });
});

`;
if (!growth.includes('router.get("/admin/activity-summary"')) {
  const exportAnchor = "export default router;";
  if (!growth.includes(exportAnchor)) throw new Error("Admin growth export anchor not found");
  growth = growth.replace(exportAnchor, activitySummaryRoute + exportAnchor);
}

for (const marker of [
  ".from(users).where(isNull(users.deletedAt))",
  'router.get("/admin/activity-summary"',
  "America/Sao_Paulo",
  "last7Days",
  "last30Days",
  "daily14",
]) {
  if (!admin.includes(marker) && !growth.includes(marker)) {
    throw new Error(`Admin final metric marker missing: ${marker}`);
  }
}

fs.writeFileSync(adminPath, admin);
fs.writeFileSync(growthPath, growth);
console.log("Admin current-user total and uncapped activity period metrics are canonical.");
