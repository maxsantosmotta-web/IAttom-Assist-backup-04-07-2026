import fs from "node:fs";

const registeredPlansPath = new URL("../src/routes/adminRegisteredPlans.ts", import.meta.url);
const growthPath = new URL("../src/routes/adminGrowth.ts", import.meta.url);

let registeredPlans = fs.readFileSync(registeredPlansPath, "utf8");
let growth = fs.readFileSync(growthPath, "utf8");

const oldSelection = `    const rows = await db
      .select({ plan: users.plan })
      .from(users);

    const planBreakdown = {
      free: rows.filter((user) => user.plan === "free").length,
      pro: rows.filter((user) => user.plan === "pro").length,
      business: rows.filter((user) => user.plan === "business").length,
      agency: rows.filter((user) => user.plan === "agency").length,
    };

    res.json({
      totalUsers: rows.length,
      planBreakdown,
    });`;

const newSelection = `    const rows = await db
      .select({
        plan: users.plan,
        planSelected: users.planSelected,
        email: users.email,
      })
      .from(users);

    const activeUsers = rows.filter(
      (user) => !user.email.toLowerCase().endsWith("@deleted.iattom.invalid"),
    );
    const selectedUsers = activeUsers.filter((user) => user.planSelected);

    const planBreakdown = {
      unselected: activeUsers.filter((user) => !user.planSelected).length,
      free: selectedUsers.filter((user) => user.plan === "free").length,
      pro: selectedUsers.filter((user) => user.plan === "pro").length,
      business: selectedUsers.filter((user) => user.plan === "business").length,
      agency: selectedUsers.filter((user) => user.plan === "agency").length,
    };

    res.json({
      totalUsers: activeUsers.length,
      planBreakdown,
    });`;

if (!registeredPlans.includes("unselected: activeUsers.filter")) {
  if (!registeredPlans.includes(oldSelection)) {
    throw new Error("Registered plan stats anchor not found");
  }
  registeredPlans = registeredPlans.replace(oldSelection, newSelection);
}

const oldCommercialCondition = `const commercialUserCondition = and(
  eq(users.role, "user"),
  sql\`lower(coalesce(\${users.email}, '')) <> \${OWNER_EMAIL}\`,
);`;

const newCommercialCondition = `const commercialUserCondition = and(
  eq(users.role, "user"),
  sql\`lower(coalesce(\${users.email}, '')) <> \${OWNER_EMAIL}\`,
  sql\`lower(coalesce(\${users.email}, '')) not like '%@deleted.iattom.invalid'\`,
);`;

if (!growth.includes("not like '%@deleted.iattom.invalid'")) {
  if (!growth.includes(oldCommercialCondition)) {
    throw new Error("Admin growth active-user condition anchor not found");
  }
  growth = growth.replace(oldCommercialCondition, newCommercialCondition);
}

for (const marker of [
  "unselected: activeUsers.filter",
  "totalUsers: activeUsers.length",
  "not like '%@deleted.iattom.invalid'",
]) {
  if (!registeredPlans.includes(marker) && !growth.includes(marker)) {
    throw new Error(`Admin overview active-count marker missing: ${marker}`);
  }
}

fs.writeFileSync(registeredPlansPath, registeredPlans);
fs.writeFileSync(growthPath, growth);
console.log("Admin overview now counts only active users and separates users without a selected plan.");
