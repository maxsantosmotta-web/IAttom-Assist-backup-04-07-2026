import fs from "node:fs";

const financePath = new URL("../src/pages/admin/AdminFinance.tsx", import.meta.url);
let source = fs.readFileSync(financePath, "utf8");

if (!source.includes('const ORANGE = "#fb923c";')) {
  source = source.replace('const ROSE = "#fb7185";', 'const ROSE = "#fb7185";\nconst ORANGE = "#fb923c";');
}

if (!source.includes("unselected: number;")) {
  source = source.replace(
    `  planBreakdown: {
    free: number;`,
    `  planBreakdown: {
    unselected: number;
    free: number;`,
  );
}

if (!source.includes('{ label: "SEM PLANO"')) {
  source = source.replace(
    `  const planData = [
    { label: "FREE",`,
    `  const planData = [
    { label: "SEM PLANO", value: summary?.planBreakdown.unselected ?? 0, color: ORANGE },
    { label: "FREE",`,
  );
}

source = source
  .replace('sub="usuários convertidos em pagantes"', 'sub="cadastros comerciais convertidos em pagantes"')
  .replace('subtitle="Assinaturas ativas e usuários FREE" centerLabel="Planos"', 'subtitle="Cadastros comerciais ativos por situação" centerLabel="Cadastros"');

for (const marker of [
  "unselected: number;",
  '{ label: "SEM PLANO", value: summary?.planBreakdown.unselected ?? 0, color: ORANGE }',
  'centerLabel="Cadastros"',
]) {
  if (!source.includes(marker)) throw new Error(`Finance UI marker missing: ${marker}`);
}

fs.writeFileSync(financePath, source);
console.log("Admin Finance now displays active commercial registrations as Sem plano, FREE, START, PREMIUM or PRO.");
