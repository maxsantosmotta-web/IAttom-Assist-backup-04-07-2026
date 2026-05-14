import { Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IntegrationFutureAutomationsProps {
  items: string[];
  title?: string;
}

export function IntegrationFutureAutomations({
  items,
  title = "Automações — Em breve",
}: IntegrationFutureAutomationsProps) {
  return (
    <Card className="bg-white/3 border-white/8">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-zinc-500 flex items-center gap-2">
          <Layers className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 bg-white/2 border border-white/5 rounded-lg px-3 py-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary/30 shrink-0" />
              <span className="text-xs text-zinc-600">{item}</span>
              <Badge className="ml-auto bg-zinc-800 text-zinc-600 border-zinc-700 text-[9px]">
                Futuro
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
