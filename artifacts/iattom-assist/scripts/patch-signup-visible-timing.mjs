import { readFileSync, writeFileSync } from "node:fs";

const signUpUrl = new URL("../src/pages/SignUpPage.tsx", import.meta.url);
let source = readFileSync(signUpUrl, "utf8");
let changed = false;

const replaceOptional = (before, after, label) => {
  if (!source.includes(before)) return;
  source = source.replace(before, after);
  changed = true;
  console.log(`[signup timing] ${label}`);
};

// Preserve timing measurements in internal console logs, but never expose them in the signup UI.
replaceOptional(
  '  const [signupTiming, setSignupTiming] = useState<{ accountMs: number; emailMs: number; totalMs: number } | null>(null);\n',
  "",
  "removed visible timing state",
);

replaceOptional(
  '        setSignupTiming({ accountMs: accountDurationMs, emailMs: emailDurationMs, totalMs: totalDurationMs });\n',
  "",
  "removed visible timing state update",
);

const visibleTimingBlock = `
                {signupTiming && (
                  <div className="mb-4 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-center text-[10.5px] leading-relaxed text-white/35">
                    Diagnóstico: conta {(signupTiming.accountMs / 1000).toFixed(1)}s · envio {(signupTiming.emailMs / 1000).toFixed(1)}s · total {(signupTiming.totalMs / 1000).toFixed(1)}s
                  </div>
                )}`;

replaceOptional(
  visibleTimingBlock,
  "",
  "removed visible timing panel",
);

if (changed) {
  writeFileSync(signUpUrl, source);
  console.log("Visible signup timing diagnostics removed; internal timing logs preserved.");
} else {
  console.log("No visible signup timing diagnostics found; nothing changed.");
}
