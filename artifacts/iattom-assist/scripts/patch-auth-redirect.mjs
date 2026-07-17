import { readFileSync, writeFileSync } from "node:fs";

const appUrl = new URL("../src/App.tsx", import.meta.url);
let source = readFileSync(appUrl, "utf8");

const before = `function SignInCallbackPage() {
  const [location] = useLocation();
  return location.includes("/sso-callback") ? <AuthenticateWithRedirectCallback /> : <SignInPage />;
}`;

const after = `function SignInCallbackPage() {
  const [location] = useLocation();
  if (location.includes("/sso-callback")) return <AuthenticateWithRedirectCallback />;
  return <>
    <Show when="signed-in"><Redirect to="/dashboard" /></Show>
    <Show when="signed-out"><SignInPage /></Show>
  </>;
}`;

if (source.includes(after)) {
  console.log("Authenticated sign-in redirect already applied.");
} else if (source.includes(before)) {
  source = source.replace(before, after);
  writeFileSync(appUrl, source);
  console.log("Authenticated sign-in redirect applied.");
} else {
  throw new Error("Sign-in redirect marker was not found");
}
