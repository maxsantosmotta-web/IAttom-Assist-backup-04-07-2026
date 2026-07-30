import fs from "node:fs";

const growthPath = new URL("../src/routes/adminGrowth.ts", import.meta.url);
let source = fs.readFileSync(growthPath, "utf8");

if (!source.includes("planSelected: boolean;")) {
  source = source.replace(
    "  plan: string;\n  credits: number;",
    "  plan: string;\n  planSelected: boolean;\n  credits: number;",
  );
}

if (!source.includes("planSelected: users.planSelected,")) {
  source = source.replace(
    "      plan: users.plan,\n      credits: users.credits,",
    "      plan: users.plan,\n      planSelected: users.planSelected,\n      credits: users.credits,",
  );
}

if (!source.includes("not like '%@deleted.iattom.invalid'")) {
  const conditionAnchor = `const commercialUserCondition = and(
  eq(users.role, "user"),
  sql\`lower(coalesce(\${users.email}, '')) <> \${OWNER_EMAIL}\`,
);`;
  const conditionReplacement = `const commercialUserCondition = and(
  eq(users.role, "user"),
  sql\`lower(coalesce(\${users.email}, '')) <> \${OWNER_EMAIL}\`,
  sql\`lower(coalesce(\${users.email}, '')) not like '%@deleted.iattom.invalid'\`,
);`;
  if (!source.includes(conditionAnchor)) throw new Error("Finance active-user condition anchor not found");
  source = source.replace(conditionAnchor, conditionReplacement);
}

source = source.replaceAll(
  "planBreakdown: { free: number; pro: number; business: number; agency: number }",
  "planBreakdown: { unselected: number; free: number; pro: number; business: number; agency: number }",
);

source = source.replaceAll(
  `planBreakdown: {
      free: allUsers.filter((user) => user.plan === "free").length,`,
  `planBreakdown: {
      unselected: allUsers.filter((user) => !user.planSelected).length,
      free: allUsers.filter((user) => user.planSelected && user.plan === "free").length,`,
);

source = source.replaceAll(
  `const planBreakdown = {
      free: allUsers.filter((user) => user.plan === "free").length,`,
  `const planBreakdown = {
      unselected: allUsers.filter((user) => !user.planSelected).length,
      free: allUsers.filter((user) => user.planSelected && user.plan === "free").length,`,
);

for (const marker of [
  "planSelected: boolean;",
  "planSelected: users.planSelected,",
  "not like '%@deleted.iattom.invalid'",
  "unselected: allUsers.filter((user) => !user.planSelected).length",
  "free: allUsers.filter((user) => user.planSelected && user.plan === \"free\").length",
]) {
  if (!source.includes(marker)) throw new Error(`Finance classification marker missing: ${marker}`);
}

fs.writeFileSync(growthPath, source);
console.log("Admin Finance now counts only active commercial registrations and separates users without a selected plan.");
