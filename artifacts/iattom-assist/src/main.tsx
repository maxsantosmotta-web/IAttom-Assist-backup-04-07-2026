import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const currentHost = window.location.hostname;
const canonicalHost = "www.iattomassist.com.br";
const mustUseCanonicalHost =
  import.meta.env.PROD &&
  (currentHost.endsWith(".up.railway.app") || currentHost === "iattomassist.com.br");

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  const requestUrl = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "";
  const contentType = response.headers.get("content-type") ?? "";

  if (!requestUrl.includes("credits") || !contentType.includes("application/json")) {
    return response;
  }

  try {
    const payload = await response.clone().json();

    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const normalized = {
        ...payload,
        balance: Number(payload.balance ?? 0),
        percentage: Number(payload.percentage ?? 0),
        planLimit: Number(payload.planLimit ?? 0),
        creativeBalance: Number(payload.creativeBalance ?? 0),
        creativePercentage: Number(payload.creativePercentage ?? 0),
        creativePlanLimit: Number(payload.creativePlanLimit ?? 0),
      };

      return new Response(JSON.stringify(normalized), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
  } catch (error) {
    console.error("[IAttom] Failed to normalize credits response", error);
  }

  return response;
};

if (mustUseCanonicalHost) {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.protocol = "https:";
  canonicalUrl.host = canonicalHost;
  window.location.replace(canonicalUrl.toString());
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
