import { readFileSync, writeFileSync } from "node:fs";

const routeUrl = new URL("../src/routes/userAnalytics.ts", import.meta.url);
let source = readFileSync(routeUrl, "utf8");

source = source.replace(
  "const [activityByModule, creditsSpent, imagesSpent, recentHistory, projectStats] = await Promise.all([",
  "const [activityByModule, videoAssetsCount, creditsSpent, imagesSpent, recentHistory, projectStats] = await Promise.all([",
);

if (!source.includes("videosData}, ''), '[]')::jsonb")) {
  const activityQueryEnd = `      .groupBy(historyTable.module),\n\n    db\n      .select({\n        day: sql<string>`;
  const videoCountQuery = `      .groupBy(historyTable.module),\n\n    db\n      .select({\n        count: sql<number>\`coalesce(sum(jsonb_array_length(coalesce(nullif(\${savedItemsTable.videosData}, ''), '[]')::jsonb)), 0)::int\`,\n      })\n      .from(savedItemsTable)\n      .where(and(\n        eq(savedItemsTable.clerkUserId, clerkUserId),\n        isNull(savedItemsTable.deletedAt),\n      )),\n\n    db\n      .select({\n        day: sql<string>`;

  if (!source.includes(activityQueryEnd)) {
    throw new Error("Analytics activity query boundary not found");
  }
  source = source.replace(activityQueryEnd, videoCountQuery);
}

if (!source.includes("const activityWithVideoEffect")) {
  source = source.replace(
    "  const totalProjects = projectStats[0]?.total ?? 0;",
    `  const totalProjects = projectStats[0]?.total ?? 0;\n  const videoEffectCount = videoAssetsCount[0]?.count ?? 0;\n  const activityWithVideoEffect = [\n    ...activityByModule.filter((item) => item.module !== "video_effect"),\n    { module: "video_effect", count: videoEffectCount },\n  ];`,
  );
}

source = source.replace(
  "    activityByModule,",
  "    activityByModule: activityWithVideoEffect,",
);

const required = [
  "videoAssetsCount",
  "jsonb_array_length",
  "const activityWithVideoEffect",
  'module: "video_effect"',
  "activityByModule: activityWithVideoEffect",
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Video effect analytics marker missing: ${marker}`);
}

writeFileSync(routeUrl, source);
console.log("Analytics counts persisted video assets as Vídeo com Efeito without changing generation flows.");
