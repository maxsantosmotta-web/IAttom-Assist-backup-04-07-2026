import { readFileSync, writeFileSync } from "node:fs";

const signUpUrl = new URL("../src/pages/SignUpPage.tsx", import.meta.url);
let source = readFileSync(signUpUrl, "utf8");
let changed = false;

const replaceOptional = (before, after, label) => {
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    console.warn(`[signup timing] ${label} marker not found; skipped`);
    return;
  }
  source = source.replace(before, after);
  changed = true;
};

replaceOptional(
  '  const [progressText, setProgressText] = useState("");',
  '  const [progressText, setProgressText] = useState("");\n  const [signupTiming, setSignupTiming] = useState<{ accountMs: number; emailMs: number; totalMs: number } | null>(null);',
  "timing state",
);

replaceOptional(
  '      console.info("[SignUp Timing] account creation", Math.round(performance.now() - signupStartedAt), "ms");',
  '      const accountDurationMs = Math.round(performance.now() - signupStartedAt);\n      console.info("[SignUp Timing] account creation", accountDurationMs, "ms");',
  "account duration",
);

replaceOptional(
  '        console.info("[SignUp Timing] email code", Math.round(performance.now() - codeStartedAt), "ms", "total", Math.round(performance.now() - signupStartedAt), "ms");',
  '        const emailDurationMs = Math.round(performance.now() - codeStartedAt);\n        const totalDurationMs = Math.round(performance.now() - signupStartedAt);\n        console.info("[SignUp Timing] email code", emailDurationMs, "ms", "total", totalDurationMs, "ms");\n        setSignupTiming({ accountMs: accountDurationMs, emailMs: emailDurationMs, totalMs: totalDurationMs });',
  "email and total duration",
);

const otpHeader = `                <div className="text-center mb-7">
                  <h1 className="text-[21px] font-bold text-white tracking-tight">Confirmar e-mail</h1>
                  <p className="text-[12.5px] text-white/38 mt-1.5 leading-snug px-2">
                    Código enviado para<br />
                    <span className="text-white/65">{email}</span>
                  </p>
                </div>`;

const otpHeaderWithTiming = `${otpHeader}

                {signupTiming && (
                  <div className="mb-4 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-center text-[10.5px] leading-relaxed text-white/35">
                    Diagnóstico: conta {(signupTiming.accountMs / 1000).toFixed(1)}s · envio {(signupTiming.emailMs / 1000).toFixed(1)}s · total {(signupTiming.totalMs / 1000).toFixed(1)}s
                  </div>
                )}`;

replaceOptional(otpHeader, otpHeaderWithTiming, "OTP timing display");

if (changed) {
  writeFileSync(signUpUrl, source);
  console.log("Visible signup timing diagnostics applied.");
} else {
  console.log("Visible signup timing diagnostics already applied or safely skipped.");
}
