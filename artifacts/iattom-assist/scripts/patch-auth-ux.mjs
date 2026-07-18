import { readFileSync, writeFileSync } from "node:fs";

function patchFile(relativePath, replacements) {
  const path = new URL(relativePath, import.meta.url);
  let source = readFileSync(path, "utf8");
  for (const [before, after, required = false] of replacements) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) {
      if (required) throw new Error(`Auth UX marker not found in ${relativePath}: ${before.slice(0, 80)}`);
      console.warn(`Optional auth UX marker already absent in ${relativePath}`);
      continue;
    }
    source = source.replace(before, after);
  }
  writeFileSync(path, source);
}

patchFile("../src/App.tsx", [
  ['import { SignInPage } from "@/pages/SignInPage";', 'import { SignInPage } from "@/pages/SignInPage";\nimport { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";', true],
  ['        <Route path="/sign-in/*?" component={SignInCallbackPage} />', '        <Route path="/forgot-password" component={ForgotPasswordPage} />\n        <Route path="/sign-in/*?" component={SignInCallbackPage} />', true],
]);

const sameOriginNavigation = [
  "        const url = decorateUrl(dashboardPath);",
  "        const target = new URL(url, window.location.origin);",
  "        if (target.origin === window.location.origin) {",
  "          setLocation(`${target.pathname}${target.search}${target.hash}`);",
  "        } else {",
  "          window.location.assign(target.href);",
  "        }",
].join("\n");

patchFile("../src/pages/SignInPage.tsx", [
  ["  const [loading, setLoading] = useState(false);", "  const [emailLoading, setEmailLoading] = useState(false);\n  const [googleLoading, setGoogleLoading] = useState(false);"],
  ["        const url = decorateUrl(dashboardPath);\n        if (url.startsWith(\"http\")) window.location.assign(url);\n        else setLocation(url);", sameOriginNavigation],
  ["if (!signIn || loading) return;", "if (!signIn || emailLoading || googleLoading) return;"],
  ["    setLoading(true);\n    setError(\"\");\n\n    try {\n      const { error: clerkError } = await signIn.password", "    setEmailLoading(true);\n    setError(\"\");\n\n    try {\n      const { error: clerkError } = await signIn.password"],
  ["    } finally {\n      setLoading(false);\n    }\n  };\n\n  const handleVerifyDevice", "    } finally {\n      setEmailLoading(false);\n    }\n  };\n\n  const handleVerifyDevice"],
  ["if (!signIn || loading || verificationCode.length !== 6) return;", "if (!signIn || emailLoading || verificationCode.length !== 6) return;"],
  ["    setLoading(true);\n    setError(\"\");\n\n    try {\n      const { error: clerkError } = await signIn.mfa.verifyEmailCode", "    setEmailLoading(true);\n    setError(\"\");\n\n    try {\n      const { error: clerkError } = await signIn.mfa.verifyEmailCode"],
  ["    } finally {\n      setLoading(false);\n    }\n  };\n\n  const handleGoogle", "    } finally {\n      setEmailLoading(false);\n    }\n  };\n\n  const handleGoogle"],
  ["if (!signIn || loading) return;\n\n    setLoading(true);", "if (!signIn || emailLoading || googleLoading) return;\n\n    setGoogleLoading(true);"],
  ["      setLoading(false);\n      setError(\"O Google não abriu. Atualize a página e tente novamente.\");", "      setGoogleLoading(false);\n      setError(\"O Google não abriu. Atualize a página e tente novamente.\");"],
  ["        setLoading(false);", "        setGoogleLoading(false);"],
  ["      setLoading(false);\n    }\n  };\n\n  const resetVerification", "      setGoogleLoading(false);\n    }\n  };\n\n  const resetVerification"],
  ["disabled={loading}\n                   className=\"w-full h-[44px] flex items-center", "disabled={emailLoading || googleLoading}\n                   className=\"w-full h-[44px] flex items-center"],
  ["{loading ? \"Abrindo Google...\" : \"Continuar com Google\"}", "{googleLoading ? \"Abrindo Google...\" : \"Continuar com Google\"}"],
  ["disabled={loading || verificationCode.length !== 6}", "disabled={emailLoading || verificationCode.length !== 6}"],
  ["style={{ background: loading ? \"#8a6820\"", "style={{ background: emailLoading ? \"#8a6820\""],
  ["{loading ? \"Aguarde...\" : \"Verificar\"}", "{emailLoading ? \"Aguarde...\" : \"Verificar\"}"],
  ["disabled={loading}\n                   className=\"w-full h-[44px] rounded-lg", "disabled={emailLoading || googleLoading}\n                   className=\"w-full h-[44px] rounded-lg"],
  ["{loading ? \"Aguarde...\" : \"Entrar\"}", "{emailLoading ? \"Aguarde...\" : \"Entrar\"}"],
  ["                  </div>\n                </div>\n\n                {error && (", "                  </div>\n                  <button type=\"button\" onClick={() => setLocation(\"/forgot-password\")} className=\"self-end text-[11.5px] transition-colors\" style={{ color: \"#C9A84C\" }}>Esqueci minha senha</button>\n                </div>\n\n                {error && ("],
]);

patchFile("../src/pages/SignUpPage.tsx", [
  ["  const [password, setPassword] = useState(\"\");\n  const [showPassword, setShowPassword] = useState(false);", "  const [password, setPassword] = useState(\"\");\n  const [confirmPassword, setConfirmPassword] = useState(\"\");\n  const [showPassword, setShowPassword] = useState(false);\n  const [showConfirmPassword, setShowConfirmPassword] = useState(false);"],
  ["        const url = decorateUrl(billingPath);\n        if (url.startsWith(\"http\")) window.location.assign(url);\n        else setLocation(url);", sameOriginNavigation.replace("dashboardPath", "billingPath")],
  ["    setEmailLoading(true);\n    setError(\"\");\n\n    try {", "    if (password !== confirmPassword) {\n      setError(\"As senhas não coincidem.\");\n      return;\n    }\n\n    setEmailLoading(true);\n    setError(\"\");\n\n    try {"],
  ["                  </div>\n\n                  {error && (", "                  </div>\n\n                  <div className=\"flex flex-col gap-1.5\">\n                    <label className=\"text-[11.5px] text-white/45 tracking-wide\">Confirmar senha</label>\n                    <div className=\"relative\">\n                      <input type={showConfirmPassword ? \"text\" : \"password\"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder=\"Digite a senha novamente\" required minLength={8} autoComplete=\"new-password\" className=\"w-full h-[43px] px-3.5 pr-11 rounded-lg text-[13.5px] text-white placeholder:text-white/22 outline-none transition-colors\" style={{ background: \"#080808\", border: \"1px solid rgba(255,255,255,0.09)\" }} />\n                      <button type=\"button\" tabIndex={-1} onClick={() => setShowConfirmPassword((v) => !v)} className=\"absolute right-3 top-1/2 -translate-y-1/2 text-white/28 hover:text-white/55 transition-colors\">{showConfirmPassword ? <EyeOff className=\"w-[15px] h-[15px]\" /> : <Eye className=\"w-[15px] h-[15px]\" />}</button>\n                    </div>\n                  </div>\n\n                  {error && ("],
  ["disabled={emailLoading || googleLoading}\n                     className=\"w-full h-[44px] rounded-lg", "disabled={emailLoading || googleLoading || password !== confirmPassword}\n                     className=\"w-full h-[44px] rounded-lg"],
]);

patchFile("../src/components/layout/SidebarLayout.tsx", [
  ["import { motion, AnimatePresence } from \"framer-motion\";", "import { AnimatePresence } from \"framer-motion\";"],
  ["              {isActive && (\n                <motion.div\n                  layoutId=\"nav-active-pill\"\n                  className=\"absolute inset-0 rounded-xl bg-primary/[0.10]\"\n                  transition={{ type: \"spring\", stiffness: 420, damping: 38 }}\n                />\n              )}\n              <motion.div\n                className=\"absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full bg-primary origin-center\"\n                initial={false}\n                animate={{ height: isActive ? 20 : 0, opacity: isActive ? 1 : 0 }}\n                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}\n              />", "              {isActive && <div className=\"absolute inset-0 rounded-xl bg-primary/[0.10]\" />}\n              {isActive && <div className=\"absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary\" />}"],
  ["            {helpOpen && (\n              <motion.div\n                layoutId=\"nav-active-pill\"\n                className=\"absolute inset-0 rounded-xl bg-primary/[0.10]\"\n                transition={{ type: \"spring\", stiffness: 420, damping: 38 }}\n              />\n            )}", "            {helpOpen && <div className=\"absolute inset-0 rounded-xl bg-primary/[0.10]\" />}"],
  ["              {location.startsWith(\"/admin\") && (\n                <motion.div\n                  layoutId=\"nav-active-pill\"\n                  className=\"absolute inset-0 rounded-xl bg-primary/[0.10]\"\n                  transition={{ type: \"spring\", stiffness: 420, damping: 38 }}\n                />\n              )}", "              {location.startsWith(\"/admin\") && <div className=\"absolute inset-0 rounded-xl bg-primary/[0.10]\" />}"],
]);

console.log("Auth recovery, password confirmation, same-origin navigation and stable sidebar applied.");
