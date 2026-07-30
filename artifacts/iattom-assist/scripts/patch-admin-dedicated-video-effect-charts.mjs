import fs from "node:fs";

const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
const activityPath = new URL("../src/pages/admin/AdminActivity.tsx", import.meta.url);

let overview = fs.readFileSync(overviewPath, "utf8");
let analytics = fs.readFileSync(analyticsPath, "utf8");
let activity = fs.readFileSync(activityPath, "utf8");

function ensureCount(source, anchor, declaration) {
  if (source.includes("const videoEffectGenerationCount")) return source;
  if (!source.includes(anchor)) throw new Error(`Video-effect count anchor missing: ${anchor}`);
  return source.replace(anchor, `${declaration}\n\n${anchor}`);
}

overview = ensureCount(
  overview,
  "  const actionDonut = useMemo(() => {",
  `  const videoEffectGenerationCount = Number(
    (analytics?.featureUsage ?? []).find((item) => item.name.toLowerCase().replaceAll(" ", "_") === "video_effect")?.count ?? 0,
  );
  const videoEffectChart = [{ label: "Vídeo com Efeito", value: videoEffectGenerationCount, color: CYAN }];`,
);

analytics = ensureCount(
  analytics,
  "  const hasPaidSubscribers =",
  `  const videoEffectGenerationCount = Number(
    (analytics?.featureUsage ?? []).find((item) => item.name.toLowerCase().replaceAll(" ", "_") === "video_effect")?.count ?? 0,
  );
  const videoEffectChart = [{ label: "Vídeo com Efeito", value: videoEffectGenerationCount, color: CYAN }];`,
);

activity = ensureCount(
  activity,
  "  const items = activity ?? [];",
  `  const videoEffectGenerationCount = Number(
    mediaMetrics.find((item) => item.name.toLowerCase().replaceAll(" ", "_") === "video_effect")?.count ?? 0,
  );
  const videoEffectChart = [{ label: "Vídeo com Efeito", value: videoEffectGenerationCount, color: MODULE_COLORS.video_effect }];`,
);

const overviewAnchor = `      <SectionLabel>Atividade</SectionLabel>`;
if (!overview.includes('title="Vídeo com Efeito"')) {
  if (!overview.includes(overviewAnchor)) throw new Error("Overview chart insertion anchor missing");
  overview = overview.replace(
    overviewAnchor,
    `      <SectionLabel>Vídeo com Efeito</SectionLabel>
      <DomnDonutChart data={videoEffectChart} title="Vídeo com Efeito" subtitle="Total de vídeos gerados" centerLabel="Gerações" />

${overviewAnchor}`,
  );
}

const analyticsAnchor = `      <div className="grid gap-6 md:grid-cols-2">`;
if (!analytics.includes('title="Vídeo com Efeito"')) {
  if (!analytics.includes(analyticsAnchor)) throw new Error("Analytics chart insertion anchor missing");
  analytics = analytics.replace(
    analyticsAnchor,
    `      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.16 }}>
        <DomnDonutChart data={videoEffectChart} title="Vídeo com Efeito" subtitle="Total de vídeos gerados" centerLabel="Gerações" />
      </motion.div>

${analyticsAnchor}`,
  );
}

const activityAnchor = `      <div className="grid gap-6 lg:grid-cols-2">`;
if (!activity.includes('title="Vídeo com Efeito"')) {
  if (!activity.includes(activityAnchor)) throw new Error("Activity chart insertion anchor missing");
  activity = activity.replace(
    activityAnchor,
    `      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <DomnDonutChart data={videoEffectChart} title="Vídeo com Efeito" subtitle="Total de vídeos gerados" centerLabel="Gerações" />
      </motion.div>

${activityAnchor}`,
  );
}

for (const [name, source] of [["overview", overview], ["analytics", analytics], ["activity", activity]]) {
  if (!source.includes("videoEffectGenerationCount")) throw new Error(`${name} video-effect count missing`);
  if (!source.includes('title="Vídeo com Efeito"')) throw new Error(`${name} dedicated video-effect chart missing`);
  if (!source.includes('centerLabel="Gerações"')) throw new Error(`${name} video-effect chart center label missing`);
}

fs.writeFileSync(overviewPath, overview);
fs.writeFileSync(analyticsPath, analytics);
fs.writeFileSync(activityPath, activity);
console.log("Dedicated Vídeo com Efeito charts added to Overview, Analytics and Activity.");
