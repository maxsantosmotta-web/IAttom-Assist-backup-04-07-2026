import { motion } from "framer-motion";
import { Settings as SettingsIcon, User, Bell, Shield, CreditCard, Zap, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useUser, useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { PLAN_CREDITS, PLAN_PRICES } from "@/lib/credits";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function Settings() {
  const { toast } = useToast();
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const plan = (me?.plan ?? "free") as keyof typeof PLAN_CREDITS;
  const planInfo = PLAN_PRICES[plan];
  const planCredits = PLAN_CREDITS[plan];

  const openClerkProfile = () => {
    openUserProfile();
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs text-primary uppercase tracking-widest font-medium mb-1">Configuration</p>
        <h2 className="text-2xl font-bold text-white mb-1">Settings</h2>
        <p className="text-muted-foreground text-sm">Manage your account, notifications, and workspace preferences.</p>
      </motion.div>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-5">
        {/* Profile */}
        <motion.div variants={itemVariants}>
          <Card className="bg-[#111111] border-white/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isLoaded ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-9 bg-white/5 rounded-md" />
                    <Skeleton className="h-9 bg-white/5 rounded-md" />
                  </div>
                  <Skeleton className="h-9 bg-white/5 rounded-md" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">First Name</Label>
                      <Input
                        readOnly
                        value={firstName}
                        className="bg-[#0a0a0a] border-white/10 text-white cursor-default focus-visible:ring-0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Last Name</Label>
                      <Input
                        readOnly
                        value={lastName}
                        className="bg-[#0a0a0a] border-white/10 text-white cursor-default focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Email Address</Label>
                    <Input
                      readOnly
                      value={email}
                      type="email"
                      className="bg-[#0a0a0a] border-white/10 text-white cursor-default focus-visible:ring-0"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/5 p-3">
                    <p className="text-xs text-muted-foreground">Name, email, and avatar are managed through your Clerk account.</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={openClerkProfile}
                      className="text-primary hover:text-primary/80 text-xs shrink-0 ml-3"
                    >
                      <ExternalLink className="w-3 h-3 mr-1.5" /> Manage Profile
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications */}
        <motion.div variants={itemVariants}>
          <Card className="bg-[#111111] border-white/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: "email-notif", label: "Email Notifications", desc: "Receive updates and results via email", defaultChecked: true },
                { id: "project-notif", label: "Project Completions", desc: "Notify when AI tasks are completed", defaultChecked: true },
                { id: "weekly-report", label: "Weekly Report", desc: "Summary of activity and insights", defaultChecked: false },
                { id: "marketing-notif", label: "Product Updates", desc: "New features and platform updates", defaultChecked: false },
              ].map((item, i, arr) => (
                <div key={item.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <Switch
                      defaultChecked={item.defaultChecked}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                  {i < arr.length - 1 && <Separator className="mt-4 bg-white/5" />}
                </div>
              ))}
              <Button
                onClick={() => toast({ description: "Notification preferences saved" })}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security */}
        <motion.div variants={itemVariants}>
          <Card className="bg-[#111111] border-white/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-white/5 border border-white/5 p-4 space-y-3">
                <p className="text-sm text-white font-medium">Password & 2FA</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Password changes, two-factor authentication, and connected accounts are managed securely through your Clerk account portal.
                </p>
                <Button
                  variant="outline"
                  onClick={openClerkProfile}
                  className="border-white/10 text-white hover:bg-white/5 text-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-2" /> Open Security Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Plan */}
        <motion.div variants={itemVariants}>
          <Card className="bg-[#111111] border-primary/20">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" /> Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!me ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-32 bg-white/5 rounded" />
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-16 bg-white/5 rounded-lg" />
                    <Skeleton className="h-16 bg-white/5 rounded-lg" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-lg font-bold text-white capitalize">{planInfo?.label ?? plan} Plan</p>
                        <Badge className="bg-primary/20 text-primary border-primary/30">Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {planInfo?.monthly === 0 ? "Free tier" : `$${planInfo?.monthly} / month — billed monthly`}
                      </p>
                    </div>
                    <Zap className="w-8 h-8 text-primary/40" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white/5 border border-white/5 rounded-lg p-3 text-center">
                      <p className="text-sm font-semibold text-white">{me.credits.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Credits Remaining</p>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-lg p-3 text-center">
                      <p className="text-sm font-semibold text-white">{planCredits.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Credits / Month</p>
                    </div>
                  </div>
                  {plan !== "agency" && (
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
                      Upgrade Plan
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
