import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useClerk } from "@clerk/react";
import { LogoMark } from "@/components/ui/Logo";
import { RefreshCw, LogOut } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
  retryCount: number;
}

function ErrorScreen({ diagnostic }: { diagnostic: string }) {
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: "/sign-in" });
    } catch (error) {
      console.error("[ErrorBoundary] Clerk sign out failed", error);
      window.location.assign("/sign-in");
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        <LogoMark size={40} className="mx-auto mb-8 opacity-50" />
        <h1 className="text-xl font-bold text-white mb-2">Erro ao abrir o painel</h1>
        <p className="text-sm text-zinc-500 mb-4 leading-relaxed">
          O diagnóstico técnico abaixo mostra o componente exato que interrompeu a entrada.
        </p>
        {diagnostic && (
          <pre className="max-h-[46vh] overflow-auto text-left text-[11px] leading-relaxed text-zinc-400 mb-6 font-mono bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-3 whitespace-pre-wrap break-words">
            {diagnostic}
          </pre>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar página
          </button>
          <button
            onClick={() => void handleSignOut()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.10] text-zinc-300 text-sm font-medium hover:bg-white/[0.08] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: "", retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null, componentStack: "", retryCount: 0 });
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const componentStack = info.componentStack ?? "";
    this.setState({ componentStack });
    console.error("[ErrorBoundary]", {
      message: error.message,
      stack: error.stack,
      componentStack,
      pathname: window.location.pathname,
      href: window.location.href,
    });

    if (this.state.retryCount === 0) {
      this.retryTimer = setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          componentStack: "",
          retryCount: 1,
        });
      }, 500);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.retryCount === 0) return null;
      if (this.props.fallback) return this.props.fallback;

      const diagnostic = [
        this.state.error?.message,
        this.state.error?.stack,
        this.state.componentStack,
      ]
        .filter(Boolean)
        .join("\n\n");

      return <ErrorScreen diagnostic={diagnostic} />;
    }

    return this.props.children;
  }
}
