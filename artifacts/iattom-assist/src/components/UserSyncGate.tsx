import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSyncUser,
  getGetMeQueryKey,
  getGetCreditsBalanceQueryKey,
} from "@workspace/api-client-react";

type State = "pending" | "syncing" | "done" | "error";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = [1000, 2000, 3000];

export function UserSyncGate({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const qc = useQueryClient();

  const [state, setState] = useState<State>("pending");
  const retryCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncUser = useSyncUser({
    mutation: {
      onSuccess: () => {
        setState("done");
        void qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });
      },
      onError: () => {
        if (retryCount.current < MAX_RETRIES - 1) {
          retryCount.current += 1;
          const delay = RETRY_DELAY_MS[retryCount.current] ?? 2000;
          timerRef.current = setTimeout(() => attemptSync(), delay);
        } else {
          setState("error");
        }
      },
    },
  });

  const attemptSync = () => {
    if (!user) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) { setState("done"); return; }
    setState("syncing");
    syncUser.mutate({
      data: { email, name: user.fullName ?? user.firstName ?? undefined },
    });
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (state !== "pending") return;
    attemptSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user?.id]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Not signed in — outer routing handles redirect, pass through
  if (!isLoaded || !isSignedIn) return <>{children}</>;

  // Sync confirmed
  if (state === "done") return <>{children}</>;

  // Permanent failure — show controlled error, DO NOT pass through
  if (state === "error") {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-[#0a0a0a] px-4">
        <div className="flex flex-col items-center gap-5 text-center max-w-xs">
          <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-500/20 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Erro ao configurar sua conta</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Não foi possível registrar sua sessão. Verifique sua conexão e tente novamente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              retryCount.current = 0;
              setState("pending");
            }}
            className="px-4 py-2 text-xs font-medium rounded-md bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Syncing / pending — spinner
  return (
    <div className="flex items-center justify-center min-h-[100dvh] bg-[#0a0a0a]">
      <div className="w-7 h-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
