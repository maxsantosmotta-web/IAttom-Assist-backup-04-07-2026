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

if (!source.includes("commercialVideoDeliveries")) {
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

  const newBlock = `  const VIDEO_EFFECT_TRACKING_CUTOFF = Date.parse("2026-07-30T04:30:00.000Z");
  const [moduleRows, commercialVideoDeliveries, legacyAdminVideoRows] = await Promise.all([
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
        sql\`\${videoTransactions.description} like \${"Vídeo com Efeito entregue • requestId:%"}\`,
        sql\`\${videoTransactions.amount} < 0\`,
      )),
    db
      .select({ videosData: savedItemsTable.videosData })
      .from(savedItemsTable)
      .innerJoin(users, eq(savedItemsTable.clerkUserId, users.clerkId))
      .where(and(
        isNull(savedItemsTable.deletedAt),
        eq(users.role, "admin"),
      )),
  ]);

  const commercialVideoCount = Number(commercialVideoDeliveries[0]?.count ?? 0);
  const trackedAdminVideoCount = Number(moduleRows.find((row) => row.module === "video_effect")?.count ?? 0);
  const legacyAdminVideoCount = legacyAdminVideoRows.reduce((total, row) => {
    if (!row.videosData) return total;
    try {
      const videos = JSON.parse(row.videosData) as Array<{ savedAt?: string }>;
      if (!Array.isArray(videos)) return total;
      return total + videos.filter((video) => {
        const savedAt = video.savedAt ? Date.parse(video.savedAt) : Number.NaN;
        return !Number.isFinite(savedAt) || savedAt < VIDEO_EFFECT_TRACKING_CUTOFF;
      }).length;
    } catch {
      return total;
    }
  }, 0);
  const videoEffectCount = commercialVideoCount + trackedAdminVideoCount + legacyAdminVideoCount;
  const canonicalModuleRows = [
    ...moduleRows.filter((row) => row.module !== "video_effect"),
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
  "videoTransactions",
  "commercialVideoDeliveries",
  "trackedAdminVideoCount",
  "legacyAdminVideoCount",
  'module: "video_effect"',
  "canonicalModuleRows",
]) {
  if (!source.includes(marker)) throw new Error(`Admin video metric marker missing: ${marker}`);
}
if (source.includes("rawCreativeCount - videoEffectCount")) {
  throw new Error("Video metric must not be subtracted from the independent creative count");
}

fs.writeFileSync(adminPath, source);
console.log("Admin analytics counts completed video effects independently from image generation.");
