import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type RequestLog = {
  id: number;
  route: string;
  endpoint: string;
  method: string;
  startedAt: number;
  durationMs: number | null;
  status: number | null;
  state: "pending" | "success" | "error";
  error?: string;
};

const MAX_LOGS = 80;
const SLOW_MS = 3000;
const IGNORED_ENDPOINTS = ["/api/__clerk", "/api/auth/"];

function normalizeEndpoint(input: RequestInfo | URL): string {
  const rawUrl = input instanceof Request ? input.url : String(input);
  try {
    const url = new URL(rawUrl, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return rawUrl;
  }
}

function shouldTrack(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET") return false;

  const endpoint = normalizeEndpoint(input);
  if (!endpoint.startsWith("/api/")) return false;
  return !IGNORED_ENDPOINTS.some((ignored) => endpoint.startsWith(ignored));
}

export function RouteRequestIsolation() {
  const [location] = useLocation();
  const routeRef = useRef(location);
  const nextIdRef = useRef(1);
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  routeRef.current = location;

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const diagnosticFetch: typeof window.fetch = async (input, init) => {
      if (!shouldTrack(input, init)) return originalFetch(input, init);

      const id = nextIdRef.current++;
      const startedAt = Date.now();
      const route = routeRef.current;
      const endpoint = normalizeEndpoint(input);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

      setLogs((current) => [
        { id, route, endpoint, method, startedAt, durationMs: null, status: null, state: "pending" },
        ...current,
      ].slice(0, MAX_LOGS));

      try {
        const response = await originalFetch(input, init);
        const durationMs = Date.now() - startedAt;
        setLogs((current) => current.map((log) => log.id === id
          ? { ...log, durationMs, status: response.status, state: response.ok ? "success" : "error" }
          : log));
        return response;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        setLogs((current) => current.map((log) => log.id === id
          ? { ...log, durationMs, status: null, state: "error", error: message }
          : log));
        throw error;
      }
    };

    window.fetch = diagnosticFetch;
    return () => {
      if (window.fetch === diagnosticFetch) window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLogs((current) => current.map((log) => log.state === "pending"
        ? { ...log, durationMs: Date.now() - log.startedAt }
        : log));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const pending = logs.filter((log) => log.state === "pending");
    const slow = logs.filter((log) => (log.durationMs ?? 0) >= SLOW_MS);
    const repeated = new Map<string, number>();
    for (const log of logs) repeated.set(log.endpoint, (repeated.get(log.endpoint) ?? 0) + 1);
    return {
      pending: pending.length,
      slow: slow.length,
      repeated: [...repeated.entries()].filter(([, count]) => count >= 3).length,
    };
  }, [logs]);

  const visibleLogs = logs.filter((log) =>
    log.state === "pending" ||
    log.state === "error" ||
    (log.durationMs ?? 0) >= SLOW_MS,
  ).slice(0, 20);

  return (
    <div className="fixed bottom-3 right-3 z-[10000] font-sans">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg border border-amber-500/40 bg-black/95 px-3 py-2 text-xs font-semibold text-amber-300 shadow-xl"
      >
        Diagnóstico · abertas {summary.pending} · lentas {summary.slow}
      </button>

      {open && (
        <div className="mt-2 w-[min(92vw,520px)] max-h-[62vh] overflow-auto rounded-xl border border-white/10 bg-[#0a0a0a]/[0.98] p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Chamadas da navegação</p>
              <p className="text-[11px] text-zinc-400">Pendentes: {summary.pending} · Lentas: {summary.slow} · Repetidas: {summary.repeated}</p>
            </div>
            <button type="button" onClick={() => setLogs([])} className="text-xs text-zinc-400 underline">Limpar</button>
          </div>

          {visibleLogs.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-500">Nenhuma chamada lenta, pendente ou com erro.</p>
          ) : (
            <div className="space-y-2">
              {visibleLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className={log.state === "error" ? "text-red-400" : log.state === "pending" ? "text-amber-300" : "text-zinc-300"}>
                      {log.state === "pending" ? "ABERTA" : log.state === "error" ? "ERRO" : "LENTA"}
                    </span>
                    <span className="text-zinc-500">{log.durationMs ?? 0} ms · {log.status ?? "—"}</span>
                  </div>
                  <p className="mt-1 break-all text-xs text-white">{log.endpoint}</p>
                  <p className="mt-1 break-all text-[10px] text-zinc-500">{log.route}</p>
                  {log.error && <p className="mt-1 break-all text-[10px] text-red-400">{log.error}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
