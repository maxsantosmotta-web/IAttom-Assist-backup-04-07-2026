import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSyncUser,
  getGetMeQueryKey,
  getGetCreditsBalanceQueryKey,
} from "@workspace/api-client-react";

export function UserSyncGate({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const qc = useQueryClient();

  const hasFired = useRef(false);
  const [ready, setReady] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const retryCount = useRef(0);

  const syncUser = useSyncUser({
    mutation: {
      onSuccess: () => {
        setReady(true);
        void qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() });
      },
      onError: () => {
        hasFired.current = false;
        if (retryCount.current < 2) {
          retryCount.current += 1;
          const delay = retryCount.current * 1000;
          setTimeout(() => setRetryTick((t) => t + 1), delay);
        } else {
          setReady(true);
        }
      },
    },
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (hasFired.current || syncUser.isPending) return;

    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) {
      setReady(true);
      return;
    }

    hasFired.current = true;
    syncUser.mutate({
      data: {
        email,
        name: user.fullName ?? user.firstName ?? undefined,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, retryTick]);

  if (!isLoaded || !isSignedIn) return <>{children}</>;

  if (ready) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-[100dvh] bg-[#0a0a0a]">
      <div className="w-7 h-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
