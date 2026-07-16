import { useEffect } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldX, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useGetMe,
  getGetMeQueryKey,
  useSyncUser,
  useBootstrapAdmin,
} from "@workspace/api-client-react";

interface AdminGuardProps {
  children: React.ReactNode;
}

const OWNER_ADMIN_EMAIL = "maxsantosmotta@gmail.com";

export function AdminGuard({ children }: AdminGuardProps) {
  const { user: clerkUser, isSignedIn, isLoaded: clerkLoaded } = useUser();
  const queryClient = useQueryClient();

  const {
    data: me,
    isLoading: meLoading,
    error: meError,
    refetch: refetchMe,
  } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, enabled: !!isSignedIn },
  });

  const syncUser = useSyncUser();
  const bootstrapAdmin = useBootstrapAdmin();

  const signedInEmail = clerkUser?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? "";
  const isOwnerAdmin = signedInEmail === OWNER_ADMIN_EMAIL;
  const isAdmin = isOwnerAdmin || me?.role === "admin";
  const isLoading = !clerkLoaded || (!isOwnerAdmin && (meLoading || syncUser.isPending));

  const handleSetupAdmin = async () => {
    if (!clerkUser) return;
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
    const name = clerkUser.fullName ?? clerkUser.firstName ?? undefined;

    try {
      await syncUser.mutateAsync({ data: { email, name } });
    } catch {
      // may already be synced — ignore
    }

    await bootstrapAdmin.mutateAsync(undefined as unknown as void);
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    await refetchMe();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080808]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return <>{children}</>;
  }

  const needsBootstrap = meError || !me;
  const bootstrapFailed = bootstrapAdmin.error;
  const bootstrapConflict =
    bootstrapFailed instanceof Error && bootstrapFailed.message?.includes("409");

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#080808]">
      <div className="bg-[#111111] border border-white/10 rounded-xl p-10 max-w-md w-full text-center shadow-2xl">
        {needsBootstrap && !bootstrapConflict ? (
          <>
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">First Admin Setup</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              No administrator has been configured yet. Click below to claim admin access for your account.
            </p>
            <Button
              onClick={handleSetupAdmin}
              disabled={syncUser.isPending || bootstrapAdmin.isPending}
              className="bg-primary text-black hover:bg-primary/90 font-semibold w-full"
            >
              {(syncUser.isPending || bootstrapAdmin.isPending) ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Setting up...</>
              ) : (
                "Claim Admin Access"
              )}
            </Button>
            {bootstrapAdmin.isError && !bootstrapConflict && (
              <p className="text-xs text-red-400 mt-3">
                Setup failed. An admin account may already exist.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
              <ShieldX className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Your account does not have administrator privileges. Contact an existing admin to grant you access.
            </p>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="border-white/10 text-muted-foreground hover:bg-white/5 w-full"
            >
              Go Back
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
