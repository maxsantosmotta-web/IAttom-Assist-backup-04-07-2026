import { Link } from "wouter";
import { Logo } from "@/components/ui/Logo";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200">
      <header className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <span className="cursor-pointer">
              <Logo size={32} showWordmark={false} />
            </span>
          </Link>
          <Link href="/terms">
            <span className="text-sm text-[#C9A84C] hover:text-[#E8C96A] transition-colors cursor-pointer">
              Termos de Uso
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-widest text-[#C9A84C] uppercase mb-3">
            Institucional
          </p>
          <h1 className="text-4xl font-bold text-white mb-4">
            Sobre o IAttom Assist
          </h1>
          <p className="text-zinc-400 text-sm">
            Plataforma de inteligência artificial para negócios digitais
          </p>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              O que é o IAttom Assist
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              O IAttom Assist é uma plataforma SaaS de inteligência artificial desenvolvida para empreendedores e empresas que operam no ambiente digital. Combinamos modelos de linguagem avançados com automações estratégicas para acelerar decisões de negócio, criação de conteúdo e crescimento de vendas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              Funcionalidades principais
            </h2>
            <ul className="space-y-3 text-zinc-400 leading-relaxed">
              <li className="flex gap-3">
                <span className="text-[#C9A84C] mt-0.5 shrink-0">—</span>
                <span><strong className="text-zinc-200">Descoberta de Produtos</strong> — Identificação de oportunidades de mercado com análise competitiva assistida por IA.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#C9A84C] mt-0.5 shrink-0">—</span>
                <span><strong className="text-zinc-200">Validação de Produtos</strong> — Avaliação de viabilidade, demanda e posicionamento antes do lançamento.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#C9A84C] mt-0.5 shrink-0">—</span>
                <span><strong className="text-zinc-200">Criação de Campanhas</strong> — Geração de campanhas completas com copy, segmentação e estratégia integrada.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#C9A84C] mt-0.5 shrink-0">—</span>
                <span><strong className="text-zinc-200">Criação de Conteúdo</strong> — Posts, textos de vendas, e-mails e materiais de marketing gerados com contexto de marca.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#C9A84C] mt-0.5 shrink-0">—</span>
                <span><strong className="text-zinc-200">Scripts de Vídeo</strong> — Roteiros otimizados para TikTok, Instagram Reels, YouTube e anúncios em vídeo.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#C9A84C] mt-0.5 shrink-0">—</span>
                <span><strong className="text-zinc-200">Criar Imagem e Vídeo</strong> — Criação de imagens e vídeos com IA para campanhas, anúncios e redes sociais.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              Integrações de plataforma
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              O IAttom Assist oferece módulos de integração com as principais plataformas de comércio digital e redes sociais, permitindo que o usuário gerencie e crie conteúdo dentro de seu ecossistema de vendas:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {["TikTok", "Instagram", "Facebook", "WhatsApp", "Shopee", "Mercado Livre", "Hotmart", "Kiwify"].map((p) => (
                <div key={p} className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2 text-center text-sm text-zinc-400">
                  {p}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              Segurança e privacidade
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Todos os dados dos usuários são armazenados com segurança em infraestrutura dedicada. Não compartilhamos informações pessoais com terceiros sem consentimento explícito. Consulte nossa{" "}
              <Link href="/privacy">
                <span className="text-[#C9A84C] hover:text-[#E8C96A] transition-colors cursor-pointer">
                  Política de Privacidade
                </span>
              </Link>{" "}
              e nossos{" "}
              <Link href="/terms">
                <span className="text-[#C9A84C] hover:text-[#E8C96A] transition-colors cursor-pointer">
                  Termos de Uso
                </span>
              </Link>{" "}
              para detalhes completos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              Contato
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Para dúvidas institucionais, parcerias ou questões relacionadas ao produto, utilize nosso canal de suporte disponível em{" "}
              <Link href="/help">
                <span className="text-[#C9A84C] hover:text-[#E8C96A] transition-colors cursor-pointer">
                  Ajuda
                </span>
              </Link>.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/20">
            &copy; {new Date().getFullYear()} IAttom Assist. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4 text-[10px] text-white/20">
            <Link href="/about"><span className="hover:text-white/50 transition-colors cursor-pointer">Sobre</span></Link>
            <Link href="/terms"><span className="hover:text-white/50 transition-colors cursor-pointer">Termos</span></Link>
            <Link href="/privacy"><span className="hover:text-white/50 transition-colors cursor-pointer">Privacidade</span></Link>
            <Link href="/help"><span className="hover:text-white/50 transition-colors cursor-pointer">Ajuda</span></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
