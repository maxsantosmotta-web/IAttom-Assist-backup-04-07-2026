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

const originalResponse = "res.json(ListAdminUsersResponse.parse({ users: usersWithCounts, total: totalRes.count }));";
const guardedResponse = "res.json(ListAdminUsersResponse.parse({ users: usersWithCounts, total: Math.max(0, totalRes.count - (allUsers.length - visibleActiveUsers.length)) }));";
const responseWithPlanSelection = `const parsedUsersResponse = ListAdminUsersResponse.parse({
    users: usersWithCounts,
    total: Math.max(0, totalRes.count - (allUsers.length - visibleActiveUsers.length)),
  });
  res.json({
    ...parsedUsersResponse,
    users: parsedUsersResponse.users.map((user, index) => ({
      ...user,
      planSelected: Boolean(visibleActiveUsers[index]?.planSelected),
    })),
  });`;

if (!source.includes("planSelected: Boolean(visibleActiveUsers[index]?.planSelected)")) {
  if (source.includes(guardedResponse)) {
    source = source.replace(guardedResponse, responseWithPlanSelection);
  } else if (source.includes(originalResponse)) {
    source = source.replace(originalResponse, responseWithPlanSelection);
  } else {
    throw new Error("Admin users response anchor not found");
  }
}

for (const marker of [
  "const visibleActiveUsers =",
  "visibleActiveUsers.map",
  "allUsers.length - visibleActiveUsers.length",
  "planSelected: Boolean(visibleActiveUsers[index]?.planSelected)",
]) {
  if (!source.includes(marker)) throw new Error(`Admin active-user guard marker missing: ${marker}`);
}

fs.writeFileSync(adminPath, source);
console.log("Admin users endpoint filters deleted records and preserves planSelected for display.");
