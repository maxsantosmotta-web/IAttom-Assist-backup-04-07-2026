import { WandSparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export type PromptHandoffSource =
  | "create_content"
  | "find_products"
  | "validate_product"
  | "create_campaign";

interface PromptHandoffButtonProps {
  source: PromptHandoffSource;
  title: string;
  summary: string;
  payload?: Record<string, unknown>;
  className?: string;
}

const PROMPT_HANDOFF_KEY = "iattom_prompt_handoff_v1";

export function PromptHandoffButton({
  source,
  title,
  summary,
  payload = {},
  className = "",
}: PromptHandoffButtonProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const preparePrompt = async () => {
    const cleanSummary = summary.trim();
    if (!cleanSummary) {
      toast({
        description: "Não há conteúdo suficiente para preparar o prompt.",
        variant: "destructive",
      });
      return;
    }

    const transfer = {
      version: 1,
      source,
      title: title.trim() || "Resultado preparado",
      summary: cleanSummary,
      payload,
      createdAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem(PROMPT_HANDOFF_KEY, JSON.stringify(transfer));
    } catch {
      toast({
        description: "Não foi possível preparar o conteúdo. Tente novamente.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(cleanSummary);
    } catch {
      // O pacote salvo no sessionStorage é a fonte da transferência.
    }

    if (source === "create_content" || source === "find_products") {
      setLocation("/dashboard/prompts");
      return;
    }

    toast({ description: "Conteúdo preparado para Criar Prompt." });
  };

  return (
    <Button
      type="button"
      onClick={() => void preparePrompt()}
      className={`min-h-11 px-4 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-[0_0_20px_rgba(201,168,76,0.14)] whitespace-normal leading-tight ${className}`}
      title="Prepara um resumo deste resultado para o módulo Criar Prompt"
    >
      <WandSparkles className="w-4 h-4 mr-2 shrink-0" />
      <span className="text-center">Criar Prompt com este resultado</span>
    </Button>
  );
}
