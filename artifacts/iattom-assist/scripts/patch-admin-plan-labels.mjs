import { readFileSync, writeFileSync } from "node:fs";

function replaceExact(relativePath, replacements) {
  const fileUrl = new URL(relativePath, import.meta.url);
  let source = readFileSync(fileUrl, "utf8");

  for (const [before, after] of replacements) {
    source = source.split(before).join(after);
  }

  writeFileSync(fileUrl, source);
}

replaceExact("../src/pages/admin/AdminUsers.tsx", [
  ['free: "Gratuito"', 'free: "FREE"'],
  ['<SelectItem value="free">Gratuito</SelectItem>', '<SelectItem value="free">FREE</SelectItem>'],
  ['<SelectItem value="free">Start</SelectItem>', '<SelectItem value="free">FREE</SelectItem>'],
  ['<SelectItem value="pro">Completo</SelectItem>', '<SelectItem value="pro">START</SelectItem>'],
  ['<SelectItem value="pro">Pro</SelectItem>', '<SelectItem value="pro">START</SelectItem>'],
  ['<SelectItem value="business">Empresarial</SelectItem>', '<SelectItem value="business">PREMIUM</SelectItem>'],
  ['<SelectItem value="business">Premium</SelectItem>', '<SelectItem value="business">PREMIUM</SelectItem>'],
  ['<SelectItem value="agency">Agência</SelectItem>', '<SelectItem value="agency">PRO</SelectItem>'],
  ['<SelectItem value="agency">Pro</SelectItem>', '<SelectItem value="agency">PRO</SelectItem>'],
  ['  plan: Plan;\n  credits: number;', '  plan: Plan;\n  planSelected?: boolean;\n  credits: number;'],
  ['<td className="px-4 py-3"><Badge variant="outline" className={planColors[user.plan]}>{planLabels[user.plan]}</Badge></td>', '<td className="px-4 py-3"><Badge variant="outline" className={user.planSelected === false ? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20" : planColors[user.plan]}>{user.planSelected === false ? "SEM PLANO" : planLabels[user.plan]}</Badge></td>'],
  ['<Badge variant="outline" className={planColors[profileUser?.plan ?? "free"]}>{planLabels[profileUser?.plan ?? "free"]}</Badge>', '<Badge variant="outline" className={profileUser?.planSelected === false ? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20" : planColors[profileUser?.plan ?? "free"]}>{profileUser?.planSelected === false ? "SEM PLANO" : planLabels[profileUser?.plan ?? "free"]}</Badge>']
]);

replaceExact("../src/pages/admin/AdminOverview.tsx", [
  ['Free: BLUE', 'FREE: BLUE'],
  ['Start: EMERALD', 'START: EMERALD'],
  ['Premium: PURPLE', 'PREMIUM: PURPLE'],
  ['Pro: GOLD', 'PRO: GOLD'],
  ['label: "Free", color: PLAN_COLORS.Free', 'label: "FREE", color: PLAN_COLORS.FREE'],
  ['label: "Start", color: PLAN_COLORS.Start', 'label: "START", color: PLAN_COLORS.START'],
  ['label: "Premium", color: PLAN_COLORS.Premium', 'label: "PREMIUM", color: PLAN_COLORS.PREMIUM'],
  ['label: "Pro", color: PLAN_COLORS.Pro', 'label: "PRO", color: PLAN_COLORS.PRO'],
  ['plan.label === "Free"', 'plan.label === "FREE"'],
  ['plan.label === "Start"', 'plan.label === "START"'],
  ['plan.label === "Premium"', 'plan.label === "PREMIUM"'],
  ['plan.label === "Pro"', 'plan.label === "PRO"']
]);

replaceExact("../src/pages/admin/AdminAnalytics.tsx", [
  ['Free: BLUE', 'FREE: BLUE'],
  ['Start: EMERALD', 'START: EMERALD'],
  ['Premium: PURPLE', 'PREMIUM: PURPLE'],
  ['Pro: GOLD', 'PRO: GOLD'],
  ['free: "Free"', 'free: "FREE"'],
  ['start: "Start"', 'start: "START"'],
  ['premium: "Premium"', 'premium: "PREMIUM"'],
  ['pro: "Pro"', 'pro: "PRO"'],
  ['business: "Premium"', 'business: "PREMIUM"'],
  ['agency: "Pro"', 'agency: "PRO"']
]);

console.log("Admin plan labels standardized: FREE, START, PREMIUM, PRO; users without plan selection display SEM PLANO.");
