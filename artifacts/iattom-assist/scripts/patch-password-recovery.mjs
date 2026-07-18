import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`${label} marker was not found`);
  return source.replace(before, after);
}

const appUrl = new URL("../src/App.tsx", import.meta.url);
let app = readFileSync(appUrl, "utf8");

app = replaceRequired(
  app,
  `import { SignInPage } from "@/pages/SignInPage";`,
  `import { SignInPage } from "@/pages/SignInPage";\nimport { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";`,
  "Forgot password import",
);

app = replaceRequired(
  app,
  `        <Route path="/sign-up/*?" component={SignUpCallbackPage} />`,
  `        <Route path="/sign-up/*?" component={SignUpCallbackPage} />\n        <Route path="/forgot-password" component={ForgotPasswordPage} />`,
  "Forgot password route",
);

writeFileSync(appUrl, app);

const signInUrl = new URL("../src/pages/SignInPage.tsx", import.meta.url);
let signIn = readFileSync(signInUrl, "utf8");

signIn = replaceRequired(
  signIn,
  `                <button\n                  type="submit"\n                  disabled={loading}`,
  `                <div className="flex justify-end -mt-1">\n                  <button\n                    type="button"\n                    onClick={() => setLocation("/forgot-password")}\n                    className="text-[11.5px] transition-colors"\n                    style={{ color: "#C9A84C" }}\n                  >\n                    Esqueci minha senha\n                  </button>\n                </div>\n\n                <button\n                  type="submit"\n                  disabled={loading}`,
  "Forgot password login link",
);

writeFileSync(signInUrl, signIn);
console.log("Password recovery route and login link ready.");
