import fs from "node:fs";

const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
let source = fs.readFileSync(overviewPath, "utf8");

const stateAnchor = "  const [growthStats, setGrowthStats] = useState<GrowthStats | null>(null);";
if (!source.includes("const [currentUsersTotal, setCurrentUsersTotal]")) {
  if (!source.includes(stateAnchor)) throw new Error("Admin Overview canonical user-total state anchor not found");
  source = source.replace(
    stateAnchor,
    `${stateAnchor}\n  const [currentUsersTotal, setCurrentUsersTotal] = useState<number | null>(null);`,
  );
}

const promiseAnchor = `        const [growthResponse, financialResponse, creditsResponse] = await Promise.all([
          fetch(\`${"${BASE}"}/api/admin/growth-stats\`, { headers, credentials: "include" }),
          fetch(\`${"${BASE}"}/api/admin/financial-summary\`, { headers, credentials: "include" }),
          fetch(\`${"${BASE}"}/api/admin/credits-analytics\`, { headers, credentials: "include" }),
        ]);`;
const promiseReplacement = `        const [growthResponse, financialResponse, creditsResponse, usersResponse] = await Promise.all([
          fetch(\`${"${BASE}"}/api/admin/growth-stats\`, { headers, credentials: "include" }),
          fetch(\`${"${BASE}"}/api/admin/financial-summary\`, { headers, credentials: "include" }),
          fetch(\`${"${BASE}"}/api/admin/credits-analytics\`, { headers, credentials: "include" }),
          fetch(\`${"${BASE}"}/api/admin/users?limit=1\`, { headers, credentials: "include", cache: "no-store" }),
        ]);`;
if (!source.includes("usersResponse")) {
  if (!source.includes(promiseAnchor)) throw new Error("Admin Overview canonical user-total fetch anchor not found");
  source = source.replace(promiseAnchor, promiseReplacement);
}

const responseAnchor = `        if (growthResponse.ok) setGrowthStats(await growthResponse.json() as GrowthStats);`;
const responseReplacement = `        if (growthResponse.ok) setGrowthStats(await growthResponse.json() as GrowthStats);
        if (usersResponse.ok) {
          const usersPayload = await usersResponse.json() as { total?: number };
          setCurrentUsersTotal(Number(usersPayload.total ?? 0));
        }`;
if (!source.includes("setCurrentUsersTotal(Number(usersPayload.total")) {
  if (!source.includes(responseAnchor)) throw new Error("Admin Overview canonical user-total response anchor not found");
  source = source.replace(responseAnchor, responseReplacement);
}

source = source.replace(
  'value={(stats?.totalUsers ?? 0).toString()}',
  'value={(currentUsersTotal ?? stats?.totalUsers ?? 0).toString()}',
);

for (const marker of [
  "const [currentUsersTotal, setCurrentUsersTotal]",
  "/api/admin/users?limit=1",
  "setCurrentUsersTotal(Number(usersPayload.total ?? 0))",
  "currentUsersTotal ?? stats?.totalUsers ?? 0",
]) {
  if (!source.includes(marker)) throw new Error(`Admin Overview canonical user-total marker missing: ${marker}`);
}

fs.writeFileSync(overviewPath, source);
console.log("Admin Overview user total now uses the same canonical total as the Users screen.");
