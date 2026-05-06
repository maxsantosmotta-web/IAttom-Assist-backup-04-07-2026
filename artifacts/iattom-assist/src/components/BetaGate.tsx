import { motion } from "framer-motion";
import { Clock, Mail, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/Logo";
import { useUser, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

interface BetaGateProps {
  children: React.ReactNode;
}

const BETA_MODE = import.meta.env.VITE_BETA_MODE === "true";

export function BetaGate({ children }: BetaGateProps) {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const { data: me, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      enabled: !!isSignedIn,
      staleTime: 30_000,
    },
  });

  if (!BETA_MODE) return <>{children}</>;
  if (isLoading || !me) return <>{children}</>;

  const isAdmin = me.role === "admin";
  const hasBetaAccess = me.betaAccess === true;

  if (isAdmin || hasBetaAccess) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Logo size={40} showWordmark />
        </div>

        <Card className="bg-[#111111] border-white/[0.06]">
          <CardContent className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <Clock className="w-7 h-7 text-primary" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">
              You're on the waitlist
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              IAttom Assist is currently in private beta. Your account is registered and pending approval. We'll grant access in batches — you'll be notified at{" "}
              <span className="text-primary font-medium">{me.email}</span>.
            </p>

            <div className="space-y-2.5 mb-6 text-left">
              {[
                "Access to all 6 AI business modules",
                "Private workspace for your projects",
                "Full credits system with monthly resets",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs text-zinc-400">{item}</span>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3 mb-6 text-left">
              <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
              <p className="text-xs text-zinc-500">
                No action required. Access is granted manually by our team.
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="text-zinc-600 hover:text-zinc-400 text-xs"
            >
              Sign out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
