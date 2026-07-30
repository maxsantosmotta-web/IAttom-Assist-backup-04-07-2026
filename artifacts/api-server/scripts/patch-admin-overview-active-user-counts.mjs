import fs from "node:fs";

const registeredPlansPath = new URL("../src/routes/adminRegisteredPlans.ts", import.meta.url);
const growthPath = new URL("../src/routes/adminGrowth.ts", import.meta.url);
const adminPath = new URL("../src/routes/admin.ts", import.meta.url);

let registeredPlans = fs.readFileSync(registeredPlansPath, "utf8");
let growth = fs.readFileSync(growthPath, "utf8");
let admin = fs.readFileSync(adminPath, "utf8");

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

const previousSelection = `    const rows = await db
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

const classifiedSelection = `    const rows = await db
      .select({
        role: users.role,
        plan: users.plan,
        planSelected: users.planSelected,
        email: users.email,
      })
      .from(users);

    const activeUsers = rows.filter(
      (user) => !user.email.toLowerCase().endsWith("@deleted.iattom.invalid"),
    );
    const regularUsers = activeUsers.filter((user) => user.role !== "admin");
    const selectedUsers = regularUsers.filter((user) => user.planSelected);

    const planBreakdown = {
      admin: activeUsers.filter((user) => user.role === "admin").length,
      unselected: regularUsers.filter((user) => !user.planSelected).length,
      free: selectedUsers.filter((user) => user.plan === "free").length,
      pro: selectedUsers.filter((user) => user.plan === "pro").length,
      business: selectedUsers.filter((user) => user.plan === "business").length,
      agency: selectedUsers.filter((user) => user.plan === "agency").length,
    };

    res.json({
      totalUsers: activeUsers.length,
      planBreakdown,
    });`;

if (!registeredPlans.includes("admin: activeUsers.filter")) {
  if (registeredPlans.includes(previousSelection)) {
    registeredPlans = registeredPlans.replace(previousSelection, classifiedSelection);
  } else if (registeredPlans.includes(oldSelection)) {
    registeredPlans = registeredPlans.replace(oldSelection, classifiedSelection);
  } else {
    throw new Error("Registered plan stats classification anchor not found");
  }
}

const commercialConditionAnchor = `const commercialUserCondition = and(
  eq(users.role, "user"),
  sql\`lower(coalesce(\${users.email}, '')) <> \${OWNER_EMAIL}\`,
);`;
const commercialConditionWithDeletedGuard = `const commercialUserCondition = and(
  eq(users.role, "user"),
  sql\`lower(coalesce(\${users.email}, '')) <> \${OWNER_EMAIL}\`,
  sql\`lower(coalesce(\${users.email}, '')) not like '%@deleted.iattom.invalid'\`,
);`;
const registrationConditionBlock = `const activeRegistrationCondition = sql\`lower(coalesce(\${users.email}, '')) not like '%@deleted.iattom.invalid'\`;

${commercialConditionWithDeletedGuard}`;

if (!growth.includes("const activeRegistrationCondition =")) {
  if (growth.includes(commercialConditionWithDeletedGuard)) {
    growth = growth.replace(commercialConditionWithDeletedGuard, registrationConditionBlock);
  } else if (growth.includes(commercialConditionAnchor)) {
    growth = growth.replace(commercialConditionAnchor, registrationConditionBlock);
  } else {
    throw new Error("Admin growth registration condition anchor not found");
  }
}

growth = growth.replaceAll(
  "and(commercialUserCondition, gte(users.createdAt, weekAgo))",
  "and(activeRegistrationCondition, gte(users.createdAt, weekAgo))",
);
growth = growth.replaceAll(
  "and(commercialUserCondition, gte(users.createdAt, monthAgo))",
  "and(activeRegistrationCondition, gte(users.createdAt, monthAgo))",
);

if (!admin.includes("const activeAdminUserCondition =")) {
  const routerAnchor = "const router: IRouter = Router();";
  if (!admin.includes(routerAnchor)) throw new Error("Admin route condition anchor not found");
  admin = admin.replace(
    routerAnchor,
    `${routerAnchor}\nconst activeAdminUserCondition = sql\`lower(coalesce(\${users.email}, '')) not like '%@deleted.iattom.invalid'\`;`,
  );
}

admin = admin.replace("db.select({ count: count() }).from(users),", "db.select({ count: count() }).from(users).where(activeAdminUserCondition),");
admin = admin.replace(
  'db.select({ count: count() }).from(users).where(eq(users.role, "admin")),',
  'db.select({ count: count() }).from(users).where(and(activeAdminUserCondition, eq(users.role, "admin"))),',
);
for (const plan of ["free", "pro", "business", "agency"]) {
  admin = admin.replaceAll(
    `db.select({ count: count() }).from(users).where(eq(users.plan, "${plan}"))`,
    `db.select({ count: count() }).from(users).where(and(activeAdminUserCondition, eq(users.role, "user"), eq(users.planSelected, true), eq(users.plan, "${plan}")))`,
  );
}
admin = admin.replaceAll(
  "db.select({ count: count() }).from(users).where(gte(users.createdAt, monthStart))",
  "db.select({ count: count() }).from(users).where(and(activeAdminUserCondition, gte(users.createdAt, monthStart)))",
);
admin = admin.replaceAll(
  "db.select({ count: count() }).from(users).where(gte(users.createdAt, sixMonthsAgo))",
  "db.select({ count: count() }).from(users).where(and(activeAdminUserCondition, gte(users.createdAt, sixMonthsAgo)))",
);

for (const marker of [
  "admin: activeUsers.filter",
  "unselected: regularUsers.filter",
  "const activeRegistrationCondition =",
  "and(activeRegistrationCondition, gte(users.createdAt, weekAgo))",
  "const activeAdminUserCondition =",
]) {
  if (!registeredPlans.includes(marker) && !growth.includes(marker) && !admin.includes(marker)) {
    throw new Error(`Unified admin registration marker missing: ${marker}`);
  }
}

fs.writeFileSync(registeredPlansPath, registeredPlans);
fs.writeFileSync(growthPath, growth);
fs.writeFileSync(adminPath, admin);
console.log("Admin metrics now classify every active registration exactly once as ADM, unselected, FREE, START, PREMIUM or PRO.");
