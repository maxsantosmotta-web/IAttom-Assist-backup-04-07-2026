import { Webhook, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface IntegrationWebhookCardProps {
  webhookUrl: string;
  title?: string;
  instructions: React.ReactNode;
  eventBadges?: Array<{ key: string; label: string; color: string }>;
}

export function IntegrationWebhookCard({
  webhookUrl,
  title = "Endpoint do Webhook",
  instructions,
  eventBadges,
}: IntegrationWebhookCardProps) {
  const copy = () => void navigator.clipboard.writeText(webhookUrl);

  return (
    <Card className="bg-white/3 border-white/8">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Webhook className="w-4 h-4 text-primary/70" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-black/30 border border-white/8 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono break-all">
            {webhookUrl}
          </code>
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 h-8 w-8 text-zinc-500 hover:text-white"
            onClick={copy}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
          {instructions}
        </div>

        {eventBadges && eventBadges.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {eventBadges.map((ev) => (
              <div
                key={ev.key}
                className="flex items-center gap-1.5 bg-white/2 border border-white/5 rounded-lg px-2.5 py-1.5"
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 bg-${ev.color}-400/60`} />
                <span className="text-[10px] text-zinc-500">{ev.label}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
