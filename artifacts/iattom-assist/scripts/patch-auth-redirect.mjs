import { readFileSync, writeFileSync } from "node:fs";

const appUrl = new URL("../src/App.tsx", import.meta.url);
let appSource = readFileSync(appUrl, "utf8");

const appBefore = `function SignInCallbackPage() {
  const [location] = useLocation();
  return location.includes("/sso-callback") ? <AuthenticateWithRedirectCallback /> : <SignInPage />;
}`;

const appAfter = `function SignInCallbackPage() {
  const [location] = useLocation();
  if (location.includes("/sso-callback")) return <AuthenticateWithRedirectCallback />;
  return <>
    <Show when="signed-in"><Redirect to="/dashboard" /></Show>
    <Show when="signed-out"><SignInPage /></Show>
  </>;
}`;

if (appSource.includes(appAfter)) {
  console.log("Authenticated sign-in redirect already applied.");
} else if (appSource.includes(appBefore)) {
  appSource = appSource.replace(appBefore, appAfter);
  writeFileSync(appUrl, appSource);
  console.log("Authenticated sign-in redirect applied.");
} else {
  throw new Error("Sign-in redirect marker was not found");
}

const signInUrl = new URL("../src/pages/SignInPage.tsx", import.meta.url);
let signInSource = readFileSync(signInUrl, "utf8");

const relativeConstants = `const dashboardPath = \`${"${basePath}"}/dashboard\` || "/dashboard";
const googleCallbackPath = \`${"${basePath}"}/sign-in/sso-callback\` || "/sign-in/sso-callback";`;

const rootAbsoluteConstants = `const dashboardPath = \`${"${basePath}"}/dashboard\` || "/dashboard";
const canonicalOrigin = window.location.hostname === "www.iattomassist.com.br"
  ? "https://iattomassist.com.br"
  : window.location.origin;
const googleCallbackUrl = \`${"${canonicalOrigin}${basePath}"}/sign-in/sso-callback\`;
const googleRedirectUrl = \`${"${canonicalOrigin}${dashboardPath}"}\`;`;

const wwwAbsoluteConstants = `const dashboardPath = \`${"${basePath}"}/dashboard\` || "/dashboard";
const canonicalOrigin = "https://www.iattomassist.com.br";
const googleCallbackUrl = \`${"${canonicalOrigin}${basePath}"}/sign-in/sso-callback\`;
const googleRedirectUrl = \`${"${canonicalOrigin}${dashboardPath}"}\`;`;

const relativeRedirects = `redirectCallbackUrl: googleCallbackPath,
        redirectUrl: dashboardPath,`;

const absoluteRedirects = `redirectCallbackUrl: googleCallbackUrl,
        redirectUrl: googleRedirectUrl,`;

let signInChanged = false;

if (signInSource.includes(relativeConstants)) {
  signInSource = signInSource.replace(relativeConstants, wwwAbsoluteConstants);
  signInChanged = true;
} else if (signInSource.includes(rootAbsoluteConstants)) {
  signInSource = signInSource.replace(rootAbsoluteConstants, wwwAbsoluteConstants);
  signInChanged = true;
}

if (signInSource.includes(relativeRedirects)) {
  signInSource = signInSource.replace(relativeRedirects, absoluteRedirects);
  signInChanged = true;
}

if (signInChanged) {
  writeFileSync(signInUrl, signInSource);
  console.log("Google OAuth redirects pinned to www.iattomassist.com.br.");
} else if (signInSource.includes(wwwAbsoluteConstants) && signInSource.includes(absoluteRedirects)) {
  console.log("Google OAuth redirects already use www.iattomassist.com.br.");
} else {
  throw new Error("Google OAuth redirect markers were not found");
}
