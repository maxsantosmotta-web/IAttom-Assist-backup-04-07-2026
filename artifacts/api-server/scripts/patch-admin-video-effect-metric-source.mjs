import fs from "node:fs";

const adminPath = new URL("../src/routes/admin.ts", import.meta.url);
let source = fs.readFileSync(adminPath, "utf8");

source = source.replace(
  "db, users, projectsTable, historyTable, creditsTransactions, waitlistTable, feedbackTable",
  "db, users, projectsTable, historyTable, savedItemsTable, creditsTransactions, waitlistTable, feedbackTable",
);

if (!source.includes("videoEffectAssets")) {
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

  const newBlock = `  const [moduleRows, videoEffectAssets] = await Promise.all([
    db
      .select({ module: historyTable.module, count: count() })
      .from(historyTable)
      .where(isNull(historyTable.deletedAt))
      .groupBy(historyTable.module)
      .orderBy(desc(count())),
    db
      .select({
        count: sql<number>\`coalesce(sum(jsonb_array_length(coalesce(nullif(\${savedItemsTable.videosData}, ''), '[]')::jsonb)), 0)::int\`,
      })
      .from(savedItemsTable)
      .where(isNull(savedItemsTable.deletedAt)),
  ]);

  const videoEffectCount = Number(videoEffectAssets[0]?.count ?? 0);
  const rawCreativeCount = Number(moduleRows.find((row) => row.module === "creative")?.count ?? 0);
  const imageGenerationCount = Math.max(0, rawCreativeCount - videoEffectCount);
  const canonicalModuleRows = [
    ...moduleRows.filter((row) => row.module !== "creative" && row.module !== "video_effect"),
    ...(imageGenerationCount > 0 ? [{ module: "creative", count: imageGenerationCount }] : []),
    ...(videoEffectCount > 0 ? [{ module: "video_effect", count: videoEffectCount }] : []),
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
  "savedItemsTable",
  "videoEffectAssets",
  "rawCreativeCount",
  "imageGenerationCount = Math.max(0, rawCreativeCount - videoEffectCount)",
  'module: "video_effect"',
  "canonicalModuleRows",
]) {
  if (!source.includes(marker)) throw new Error(`Admin video metric marker missing: ${marker}`);
}

fs.writeFileSync(adminPath, source);
console.log("Admin analytics separates Gerar Imagem from persisted Vídeo com Efeito without double counting.");
