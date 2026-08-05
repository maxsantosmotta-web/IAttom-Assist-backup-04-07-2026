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
  /value=\{\((?:currentUsersTotal \?\? )?stats\?\.totalUsers \?\? 0\)\.toString\(\)\}/g,
  "value={(growthStats?.totalRegistrations ?? stats?.totalUsers ?? 0).toString()}",
);

if (!source.includes("growthStats?.totalRegistrations ?? stats?.totalUsers ?? 0")) {
  throw new Error("Admin Overview canonical registration total was not applied");
}

for (const forbidden of ["currentUsersTotal", "usersResponse", "/api/admin/users?limit="]) {
  if (source.includes(forbidden)) {
    throw new Error(`Obsolete Admin Overview user-total marker still present: ${forbidden}`);
  }
}

fs.writeFileSync(overviewPath, source);
console.log("Admin Overview user total now uses growth-stats totalRegistrations.");
