import { Link } from "wouter";
import { LogoMark } from "@/components/ui/Logo";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#080808] px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-5%,_rgba(201,168,76,0.07)_0%,_transparent_60%)] pointer-events-none" />

      <div className="relative flex flex-col items-center text-center max-w-md">
        <LogoMark size={48} className="mb-8 opacity-60" />

        <div className="flex items-center gap-3 mb-4">
          <SearchX className="w-8 h-8 text-white/20" />
          <span className="text-7xl font-bold text-white/10 tabular-nums">404</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <Link href="/">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-medium hover:bg-primary/15 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </button>
        </Link>
      </div>
    </div>
  );
}
