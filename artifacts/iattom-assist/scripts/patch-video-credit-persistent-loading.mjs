import { readFileSync, writeFileSync } from "node:fs";

const creditsUrl = new URL("../src/pages/dashboard/Credits.tsx", import.meta.url);
let source = readFileSync(creditsUrl, "utf8");

source = source.replace(
  'import { Zap, TrendingUp, RefreshCw, Image, Video } from "lucide-react";',
  'import { Zap, TrendingUp, RefreshCw, Image, Video, Loader2 } from "lucide-react";',
);

const oldState = `  const [videoBalance, setVideoBalance] = useState<number | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const videoRetryRef = useRef<number | null>(null);
  const videoRequestInFlightRef = useRef(false);
  const videoMountedRef = useRef(true);`;
const newState = `  const [videoBalance, setVideoBalance] = useState<number | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoRetrying, setVideoRetrying] = useState(false);
  const videoRetryRef = useRef<number | null>(null);
  const videoRequestInFlightRef = useRef(false);
  const videoMountedRef = useRef(true);
  const videoRetryAttemptRef = useRef(0);`;
if (source.includes(oldState)) source = source.replace(oldState, newState);

const oldLoader = `  const loadVideoBalance = async (signal?: AbortSignal): Promise<boolean> => {
    if (videoRequestInFlightRef.current) return false;
    videoRequestInFlightRef.current = true;
    if (videoMountedRef.current) setVideoLoading(true);

    try {
      const response = await fetch("/api/videos/balance", {
        credentials: "include",
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error("video balance request failed");
      const video = await response.json() as { videoBalance?: number };
      if (!videoMountedRef.current || signal?.aborted) return false;
      setVideoBalance(Number(video.videoBalance ?? 0));
      setVideoLoading(false);
      if (videoRetryRef.current !== null) {
        window.clearTimeout(videoRetryRef.current);
        videoRetryRef.current = null;
      }
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      if (videoMountedRef.current && videoRetryRef.current === null) {
        videoRetryRef.current = window.setTimeout(() => {
          videoRetryRef.current = null;
          void loadVideoBalance();
        }, 3000);
      }
      return false;
    } finally {
      videoRequestInFlightRef.current = false;
    }
  };`;

const newLoader = `  const loadVideoBalance = async (signal?: AbortSignal): Promise<boolean> => {
    if (videoRequestInFlightRef.current) return false;
    videoRequestInFlightRef.current = true;
    if (videoMountedRef.current) {
      setVideoLoading(true);
      setVideoRetrying(videoRetryAttemptRef.current > 0);
    }

    let succeeded = false;
    try {
      const response = await fetch("/api/videos/balance", {
        credentials: "include",
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error(\`video balance request failed: \${response.status}\`);
      const video = await response.json() as { videoBalance?: number };
      if (!videoMountedRef.current || signal?.aborted) return false;
      setVideoBalance(Number(video.videoBalance ?? 0));
      setVideoLoading(false);
      setVideoRetrying(false);
      videoRetryAttemptRef.current = 0;
      if (videoRetryRef.current !== null) {
        window.clearTimeout(videoRetryRef.current);
        videoRetryRef.current = null;
      }
      succeeded = true;
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      if (videoMountedRef.current) {
        setVideoLoading(true);
        setVideoRetrying(true);
      }
      return false;
    } finally {
      videoRequestInFlightRef.current = false;
      if (!succeeded && videoMountedRef.current && !signal?.aborted && videoRetryRef.current === null) {
        const delay = Math.min(2500 + videoRetryAttemptRef.current * 1500, 10000);
        videoRetryAttemptRef.current += 1;
        videoRetryRef.current = window.setTimeout(() => {
          videoRetryRef.current = null;
          void loadVideoBalance();
        }, delay);
      }
    }
  };`;

if (source.includes(oldLoader)) source = source.replace(oldLoader, newLoader);

source = source.replace(
  `    const controller = new AbortController();
    void loadVideoBalance(controller.signal);`,
  `    videoRetryAttemptRef.current = 0;
    const controller = new AbortController();
    void loadVideoBalance(controller.signal);`,
);

source = source.replace(
  `          {videoBalance === null ? <Skeleton className="h-9 w-16 bg-white/5" /> : <p className="text-3xl font-bold text-white tabular-nums">{videoBalance.toLocaleString("pt-BR")}</p>}
          <p className="text-xs text-muted-foreground mt-1">{videoLoading && videoBalance !== null ? "Atualizando..." : "Saldo disponível"}</p>`,
  `          {videoBalance === null ? (
            <div className="flex items-center gap-2 min-h-9">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              <span className="text-sm text-zinc-400">Carregando saldo...</span>
            </div>
          ) : (
            <p className="text-3xl font-bold text-white tabular-nums">{videoBalance.toLocaleString("pt-BR")}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{videoRetrying ? "Reconectando automaticamente..." : videoLoading ? "Atualizando saldo..." : "Saldo disponível"}</p>`,
);

for (const marker of [
  "videoRetryAttemptRef",
  "Reconectando automaticamente...",
  "Carregando saldo...",
  "Math.min(2500 + videoRetryAttemptRef.current * 1500, 10000)",
]) {
  if (!source.includes(marker)) throw new Error(`Video credit persistence marker missing: ${marker}`);
}

writeFileSync(creditsUrl, source, "utf8");
console.log("Video credit card now stays visibly loading and retries automatically until the balance returns.");
