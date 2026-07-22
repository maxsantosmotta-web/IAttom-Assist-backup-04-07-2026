import fs from "node:fs";

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Required image-unit anchor not found: ${label}`);
  }
  return source.replace(before, after);
}

const sidebarPath = new URL("../src/components/layout/SidebarLayout.tsx", import.meta.url);
let sidebar = fs.readFileSync(sidebarPath, "utf8");

const sidebarAlreadyUsesImageUnits =
  sidebar.includes('>Imagens</span>') &&
  sidebar.includes('{Math.floor(creativeBalance / 10).toLocaleString()}');

if (!sidebarAlreadyUsesImageUnits) {
  sidebar = replaceRequired(
    sidebar,
    '  const creativeBalance = creditsData?.creativeBalance ?? 0;\n  const creativePct = creditsData?.creativePercentage ?? 0;\n  const creativePlanLimit = creditsData?.creativePlanLimit ?? 0;',
    '  const creativeBalance = creditsData?.creativeBalance ?? 0;\n  const creativePct = creditsData?.creativePercentage ?? 0;\n  const creativePlanLimit = creditsData?.creativePlanLimit ?? 0;\n  const imageBalance = Math.floor(creativeBalance / 10);',
    "sidebar balance variables",
  );

  sidebar = replaceRequired(
    sidebar,
    '<span className="text-[11px] text-zinc-500 font-semibold tracking-wide">Criativos</span>',
    '<span className="text-[11px] text-zinc-500 font-semibold tracking-wide">Imagens</span>',
    "sidebar creative label",
  );

  sidebar = replaceRequired(
    sidebar,
    '                    {creativeBalance.toLocaleString()}\n                    <span className="text-zinc-700 font-normal"> / {creativePlanLimit.toLocaleString()}</span>',
    '                    {imageBalance.toLocaleString()}\n                    <span className="text-zinc-700 font-normal"> imagens</span>',
    "sidebar creative balance rendering",
  );

  sidebar = replaceRequired(
    sidebar,
    '<p className="text-[10px] text-red-400 mt-1 font-medium">Criativos baixos</p>',
    '<p className="text-[10px] text-red-400 mt-1 font-medium">Imagens acabando</p>',
    "sidebar low creative warning",
  );

  fs.writeFileSync(sidebarPath, sidebar);
}

const gatePath = new URL("../src/components/CreditsGate.tsx", import.meta.url);
let gate = fs.readFileSync(gatePath, "utf8");

const gateAlreadyUsesImageUnits =
  gate.includes('const labelCreative = "Imagens Insuficientes";') &&
  gate.includes('Math.ceil((insufficient?.required ?? 0) / 10)');

if (!gateAlreadyUsesImageUnits) {
  gate = replaceRequired(
    gate,
    '  const labelCreative = "Créditos de Criativo Insuficientes";\n  const titleGeneral = "Créditos insuficientes";\n  const titleCreative = "Créditos de criativo insuficientes";',
    '  const labelCreative = "Imagens Insuficientes";\n  const titleGeneral = "Créditos insuficientes";\n  const titleCreative = "Imagens insuficientes";',
    "creative insufficient labels",
  );

  gate = replaceRequired(
    gate,
    '                  Esta ação custa{" "}\n                  <span className="text-white font-semibold">\n                    {insufficient?.required} crédito{insufficient?.isCreative ? "s de criativo" : "s"}\n                  </span>. Seu saldo{insufficient?.isCreative ? " de criativo" : ""} é{" "}\n                  <span className="text-amber-400 font-semibold">{insufficient?.balance}</span>.',
    '                  {insufficient?.isCreative ? (\n                    <>Esta ação precisa de <span className="text-white font-semibold">{Math.ceil((insufficient?.required ?? 0) / 10)} imagem(ns)</span>. Seu saldo é <span className="text-amber-400 font-semibold">{Math.floor((insufficient?.balance ?? 0) / 10)} imagem(ns)</span>.</>\n                  ) : (\n                    <>Esta ação custa <span className="text-white font-semibold">{insufficient?.required} créditos</span>. Seu saldo é <span className="text-amber-400 font-semibold">{insufficient?.balance}</span>.</>\n                  )}',
    "creative insufficient body",
  );

  const oldFooter = '                Você está no plano mais alto. Contate o suporte para adicionar mais créditos.';
  const rewrittenFooter = '                Suas imagens disponíveis acabaram. Adquira um pacote de imagens no Faturamento para continuar gerando.';
  const finalFooter = '                {insufficient?.isCreative\n                  ? "Suas imagens disponíveis acabaram. Adquira um pacote de imagens no Faturamento para continuar gerando."\n                  : "Você está no plano mais alto. Adquira créditos avulsos no Faturamento para continuar."}';

  if (gate.includes(oldFooter)) {
    gate = gate.replace(oldFooter, finalFooter);
  } else if (gate.includes(rewrittenFooter)) {
    gate = gate.replace(rewrittenFooter, finalFooter);
  } else {
    throw new Error("Required image-unit anchor not found: insufficient footer guidance");
  }

  fs.writeFileSync(gatePath, gate);
}

console.log("Image-unit presentation is already current or was applied successfully.");
