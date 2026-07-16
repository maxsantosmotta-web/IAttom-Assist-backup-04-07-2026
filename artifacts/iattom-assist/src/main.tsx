import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const currentHost = window.location.hostname;
const canonicalHost = "www.iattomassist.com.br";
const mustUseCanonicalHost =
  import.meta.env.PROD &&
  (currentHost.endsWith(".up.railway.app") || currentHost === "iattomassist.com.br");

if (mustUseCanonicalHost) {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.protocol = "https:";
  canonicalUrl.host = canonicalHost;
  window.location.replace(canonicalUrl.toString());
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
