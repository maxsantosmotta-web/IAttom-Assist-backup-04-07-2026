import fs from "node:fs";

const financePath = new URL("../src/pages/admin/AdminFinance.tsx", import.meta.url);
let source = fs.readFileSync(financePath, "utf8");

if (!source.includes('billingCycle: "monthly" | "annual" | null;')) {
  const typeAnchor = `  status: string;
  createdAt: string;
}`;
  const typeReplacement = `  status: string;
  billingCycle: "monthly" | "annual" | null;
  createdAt: string;
}`;
  if (!source.includes(typeAnchor)) throw new Error("Finance UI movement type anchor not found");
  source = source.replace(typeAnchor, typeReplacement);
}

const oldMovementLine = `<p className="mt-0.5 truncate text-[10px] text-zinc-600">{item.userName || item.userEmail} · {getPlanName(item.plan)} · {item.status}</p>`;
const newMovementLine = `<p className="mt-0.5 truncate text-[10px] text-zinc-600">{item.userName || item.userEmail} · {getPlanName(item.plan)}{item.type === "subscription" && item.billingCycle ? \` · \${item.billingCycle === "annual" ? "Anual" : "Mensal"}\` : ""} · {item.status}</p>`;

if (source.includes(oldMovementLine)) {
  source = source.replace(oldMovementLine, newMovementLine);
} else if (!source.includes('item.billingCycle === "annual" ? "Anual" : "Mensal"')) {
  throw new Error("Finance UI movement display anchor not found");
}

for (const marker of [
  'billingCycle: "monthly" | "annual" | null;',
  'item.billingCycle === "annual" ? "Anual" : "Mensal"',
]) {
  if (!source.includes(marker)) throw new Error(`Finance UI billing-cycle marker missing: ${marker}`);
}

fs.writeFileSync(financePath, source);
console.log("Admin Finance history now labels subscription movements as Mensal or Anual without changing operations.");
