import fs from "node:fs";

const adminPath = new URL("../src/routes/admin.ts", import.meta.url);
let source = fs.readFileSync(adminPath, "utf8");

if (!source.includes("const visibleActiveUsers =")) {
  const clerkAnchor = "  const clerkIds = allUsers.map((u) => u.clerkId);";
  if (!source.includes(clerkAnchor)) throw new Error("Admin active users response anchor not found");
  source = source.replace(
    clerkAnchor,
    `  const visibleActiveUsers = allUsers.filter(
    (user) => !user.email.toLowerCase().endsWith("@deleted.iattom.invalid"),
  );
  const clerkIds = visibleActiveUsers.map((u) => u.clerkId);`,
  );
}

source = source.replace(
  "const usersWithCounts = await Promise.all(allUsers.map(async (u) => {",
  "const usersWithCounts = await Promise.all(visibleActiveUsers.map(async (u) => {",
);
source = source.replace(
  "res.json(ListAdminUsersResponse.parse({ users: usersWithCounts, total: totalRes.count }));",
  "res.json(ListAdminUsersResponse.parse({ users: usersWithCounts, total: Math.max(0, totalRes.count - (allUsers.length - visibleActiveUsers.length)) }));",
);

for (const marker of ["const visibleActiveUsers =", "visibleActiveUsers.map", "allUsers.length - visibleActiveUsers.length"]) {
  if (!source.includes(marker)) throw new Error(`Admin active-user guard marker missing: ${marker}`);
}

fs.writeFileSync(adminPath, source);
console.log("Admin users endpoint now has a final response guard against deleted records.");
