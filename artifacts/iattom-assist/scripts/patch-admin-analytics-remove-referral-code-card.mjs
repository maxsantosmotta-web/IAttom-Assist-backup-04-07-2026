import fs from "node:fs";

const analyticsPath = new URL("../src/pages/admin/AdminAnalytics.tsx", import.meta.url);
let analytics = fs.readFileSync(analyticsPath, "utf8");

const referralCard = '            <StatTile label="Códigos de Indicação Ativos" value={growthStats.totalReferralCodes.toString()} sub={`${growthStats.totalReferralUses} usos`} icon={GitBranch} color="text-amber-300" glow="rgba(245,180,35,.10)" />\n';

analytics = analytics.replace(referralCard, "");
analytics = analytics.replace(
  '<div className="grid grid-cols-2 gap-3 md:grid-cols-4">\n            <StatTile label="Novos Usuários (Semana)"',
  '<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">\n            <StatTile label="Novos Usuários (Semana)"',
);
analytics = analytics.replace(
  'import { TrendingUp, Zap, Users, DollarSign, Activity, AlertTriangle, GitBranch, RefreshCw } from "lucide-react";',
  'import { TrendingUp, Zap, Users, DollarSign, Activity, AlertTriangle, RefreshCw } from "lucide-react";',
);

if (analytics.includes('label="Códigos de Indicação Ativos"')) {
  throw new Error("Referral code analytics card still exists");
}

fs.writeFileSync(analyticsPath, analytics);
console.log("Admin Analytics referral-code card removed; remaining growth cards use a three-column grid.");
