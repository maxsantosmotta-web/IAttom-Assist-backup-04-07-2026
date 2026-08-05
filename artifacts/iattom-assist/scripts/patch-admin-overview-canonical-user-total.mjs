import fs from "node:fs";

const overviewPath = new URL("../src/pages/admin/AdminOverview.tsx", import.meta.url);
let source = fs.readFileSync(overviewPath, "utf8");

if (!source.includes("totalRegistrations?: number;")) {
  const interfaceAnchor = "  totalUsers: number;";
  if (!source.includes(interfaceAnchor)) {
    throw new Error("Admin Overview GrowthStats totalUsers anchor not found");
  }
  source = source.replace(
    interfaceAnchor,
    `${interfaceAnchor}\n  totalRegistrations?: number;`,
  );
}

source = source.replace(
  /\n\s*const \[currentUsersTotal, setCurrentUsersTotal\] = useState<number \| null>\(null\);/g,
  "",
);

source = source.replace(
  /const \[growthResponse, financialResponse, creditsResponse, usersResponse\] = await Promise\.all\(\[([\s\S]*?)\n\s*fetch\(`\$\{BASE\}\/api\/admin\/users\?limit=\d+`, \{ headers, credentials: "include", cache: "no-store" \}\),\n\s*\]\);/g,
  "const [growthResponse, financialResponse, creditsResponse] = await Promise.all([$1\n        ]);",
);

source = source.replace(
  /\n\s*if \(usersResponse\.ok\) \{\n\s*const usersPayload = await usersResponse\.json\(\) as \{[^\n]*\};\n\s*setCurrentUsersTotal\([^\n]*\);\n\s*\}/g,
  "",
);

source = source.replace(
  /value=\{\((?:growthStats\?\.totalRegistrations \?\? )?(?:currentUsersTotal \?\? )?stats\?\.totalUsers \?\? 0\)\.toString\(\)\}/g,
  "value={(growthStats?.totalRegistrations ?? 0).toString()}",
);

source = source.replace(
  /(<PremiumMetric label="Usuários Totais"[^>]*?)loading=\{statsLoading\}/,
  "$1loading={growthLoading}",
);

if (!source.includes("growthStats?.totalRegistrations ?? 0")) {
  throw new Error("Admin Overview canonical registration total without stale fallback was not applied");
}

if (!source.includes('label="Usuários Totais"') || !source.includes("loading={growthLoading}")) {
  throw new Error("Admin Overview user-total loading source was not switched to growth loading");
}

for (const forbidden of [
  "currentUsersTotal",
  "usersResponse",
  "/api/admin/users?limit=",
  "growthStats?.totalRegistrations ?? stats?.totalUsers",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`Obsolete Admin Overview user-total marker still present: ${forbidden}`);
  }
}

fs.writeFileSync(overviewPath, source);
console.log("Admin Overview waits for canonical registration total and never renders the stale 16-user fallback.");
