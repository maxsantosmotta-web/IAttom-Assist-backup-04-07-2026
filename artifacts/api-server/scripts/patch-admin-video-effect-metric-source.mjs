import fs from "node:fs";

const adminPath = new URL("../src/routes/admin.ts", import.meta.url);
let source = fs.readFileSync(adminPath, "utf8");

source = source.replace(
  "db, users, projectsTable, historyTable, creditsTransactions, waitlistTable, feedbackTable",
  "db, users, projectsTable, historyTable, savedItemsTable, videoTransactions, creditsTransactions, waitlistTable, feedbackTable",
);
source = source.replace(
  "db, users, projectsTable, historyTable, savedItemsTable, creditsTransactions, waitlistTable, feedbackTable",
  "db, users, projectsTable, historyTable, savedItemsTable, videoTransactions, creditsTransactions, waitlistTable, feedbackTable",
);

if (!source.includes("persistedVideoAssets")) {
  const oldBlock = `  const moduleRows = await db
    .select({ module: historyTable.module, count: count() })
    .from(historyTable)
    .groupBy(historyTable.module)
    .orderBy(desc(count()));

  const totalModuleCount = moduleRows.reduce((s, r) => s + r.count, 0) || 1;
  const featureUsage = moduleRows.map((r) => ({
    name: r.module.replace(/_/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase()),
    count: r.count,
    percentage: Math.round((r.count / totalModuleCount) * 100),
  }));`;

  const newBlock = `  const [moduleRows, completedVideoUses, persistedVideoAssets] = await Promise.all([
    db
      .select({ module: historyTable.module, count: count() })
      .from(historyTable)
      .where(isNull(historyTable.deletedAt))
      .groupBy(historyTable.module)
      .orderBy(desc(count())),
    db
      .select({ count: count() })
      .from(videoTransactions)
      .where(and(
        eq(videoTransactions.type, "use"),
        sql\`\${videoTransactions.amount} < 0\`,
      )),
    db
      .select({
        count: sql<number>\`coalesce(sum(jsonb_array_length(coalesce(nullif(\${savedItemsTable.videosData}, ''), '[]')::jsonb)), 0)::int\`,
      })
      .from(savedItemsTable)
      .where(isNull(savedItemsTable.deletedAt)),
  ]);

  const completedVideoCount = Number(completedVideoUses[0]?.count ?? 0);
  const persistedVideoCount = Number(persistedVideoAssets[0]?.count ?? 0);
  const trackedVideoCount = Number(moduleRows.find((row) => row.module === "video_effect")?.count ?? 0);
  const videoEffectCount = Math.max(persistedVideoCount, completedVideoCount + trackedVideoCount);
  const canonicalModuleRows = [
    ...moduleRows.filter((row) => row.module !== "video_effect"),
    { module: "video_effect", count: videoEffectCount },
  ];
  const totalModuleCount = canonicalModuleRows.reduce((sum, row) => sum + Number(row.count), 0) || 1;
  const featureUsage = canonicalModuleRows.map((row) => ({
    name: row.module.replace(/_/g, " ").replace(/\\b\\w/g, (character) => character.toUpperCase()),
    count: Number(row.count),
    percentage: Math.round((Number(row.count) / totalModuleCount) * 100),
  }));`;

  if (!source.includes(oldBlock)) throw new Error("Admin analytics module source anchor not found");
  source = source.replace(oldBlock, newBlock);
}

for (const marker of [
  "videoTransactions",
  "completedVideoUses",
  "persistedVideoAssets",
  "persistedVideoCount",
  "Math.max(persistedVideoCount, completedVideoCount + trackedVideoCount)",
  '{ module: "video_effect", count: videoEffectCount }',
  "canonicalModuleRows",
]) {
  if (!source.includes(marker)) throw new Error(`Admin video metric marker missing: ${marker}`);
}
if (source.includes("rawCreativeCount - videoEffectCount")) {
  throw new Error("Video metric must not be subtracted from the independent creative count");
}

fs.writeFileSync(adminPath, source);
console.log("Admin analytics adds Vídeo com Efeito to the existing module charts with the canonical generation count.");
