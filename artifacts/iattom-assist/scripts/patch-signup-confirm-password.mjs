import { readFileSync, writeFileSync } from "node:fs";

const signUpUrl = new URL("../src/pages/SignUpPage.tsx", import.meta.url);
let source = readFileSync(signUpUrl, "utf8");

const stateBefore = `  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);`;
const stateAfter = `  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);`;

if (!source.includes("const [confirmPassword, setConfirmPassword]")) {
  if (!source.includes(stateBefore)) throw new Error("Signup password state marker was not found");
  source = source.replace(stateBefore, stateAfter);
}

const validationVariants = [
  {
    before: `    if (!signUp || emailLoading) return;

    setEmailLoading(true);
    setError("");`,
    after: `    if (!signUp || emailLoading) return;
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setEmailLoading(true);
    setError("");`,
  },
  {
    before: `    if (!signUp || loading) return;

    setLoading(true);
    setError("");`,
    after: `    if (!signUp || loading) return;
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setError("");`,
  },
];

if (!source.includes('setError("As senhas não coincidem.")')) {
  const validation = validationVariants.find(({ before }) => source.includes(before));
  if (!validation) throw new Error("Signup submit validation marker was not found");
  source = source.replace(validation.before, validation.after);
}

const errorMarker = `                  {error && (`;
const confirmField = `                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11.5px] text-white/45 tracking-wide">Confirmar senha</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Digite a senha novamente"
                        required
                        autoComplete="new-password"
                        className="w-full h-[43px] px-3.5 pr-11 rounded-lg text-[13.5px] text-white placeholder:text-white/22 outline-none transition-colors"
                        style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.09)" }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.5)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/28 hover:text-white/55 transition-colors"
                        aria-label={showPassword ? "Ocultar senhas" : "Mostrar senhas"}
                      >
                        {showPassword ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
                      </button>
                    </div>
                  </div>

`;

if (!source.includes(">Confirmar senha</label>")) {
  const markerIndex = source.indexOf(errorMarker);
  if (markerIndex < 0) throw new Error("Signup error block marker was not found");
  source = source.slice(0, markerIndex) + confirmField + source.slice(markerIndex);
}

writeFileSync(signUpUrl, source);
console.log("Signup password confirmation is present.");
