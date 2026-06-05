import { Link } from "wouter";
import { Logo } from "@/components/ui/Logo";

export function HelpPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200">
      <header className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <span className="cursor-pointer">
              <Logo size={32} showWordmark />
            </span>
          </Link>
          <Link href="/privacy">
            <span className="text-sm text-[#C9A84C] hover:text-[#E8C96A] transition-colors cursor-pointer">
              Privacidade
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-widest text-[#C9A84C] uppercase mb-3">
            Suporte
          </p>
          <h1 className="text-4xl font-bold text-white mb-4">
            Centro de Suporte &amp; FAQ
          </h1>
          <p className="text-zinc-400 text-sm">
            Central oficial de ajuda, perguntas frequentes e informações institucionais do IAttom Assist.
          </p>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              Primeiros passos
            </h2>
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Como criar uma conta?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Acesse a página inicial do IAttom Assist e clique em "Criar Conta". Você pode se cadastrar com e-mail e senha ou utilizar sua conta Google.
                </p>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">O que são créditos?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Créditos são a unidade de uso da plataforma. Cada funcionalidade de IA consome uma quantidade específica de créditos. Usuários do plano gratuito recebem créditos mensais renováveis. Planos pagos oferecem créditos ampliados e recursos adicionais.
                </p>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Como ganhar créditos adicionais?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Você pode ganhar créditos extras indicando novos usuários pelo programa de referência disponível em seu painel. Cada indicação aprovada gera créditos para você e para o indicado.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              Créditos e planos
            </h2>
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Como funcionam os créditos?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Cada recurso da plataforma consome uma quantidade de créditos: descoberta de produtos (5 cr), validação (5 cr), campanha (10 cr), conteúdo (8 cr), criativo (15 cr) e script de vídeo (10 cr). Os créditos renovam automaticamente todo mês.
                </p>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">O que acontece quando os créditos acabam?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Quando os créditos se esgotam, as funcionalidades ficam pausadas até a renovação mensal. Você pode fazer upgrade a qualquer momento para obter mais créditos imediatamente.
                </p>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Os créditos acumulam entre os meses?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Não. Os créditos reiniciam no primeiro dia de cada ciclo de cobrança. Créditos bônus de indicação, no entanto, são permanentes e não expiram.
                </p>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Qual plano é recomendado para quem está começando?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  O plano COMPLETO oferece o melhor custo-benefício — 500 créditos/mês, acesso completo a todos os módulos e suporte prioritário. É a escolha de 8 em cada 10 usuários ativos.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              Integrações de plataforma
            </h2>
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Como funciona a integração com o TikTok?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  O módulo TikTok do IAttom Assist permite criar scripts de vídeo otimizados para a plataforma, gerenciar campanhas e acompanhar métricas de desempenho. O acesso utiliza o modelo de autorização oficial do TikTok Developers.
                </p>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Quais plataformas são suportadas?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Atualmente o IAttom Assist oferece módulos para: TikTok, Instagram, Facebook, WhatsApp, Shopee, Mercado Livre, Hotmart e Kiwify.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              Assinatura e cancelamento
            </h2>
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Posso cancelar a qualquer momento?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Sim. O cancelamento pode ser feito a qualquer momento pelo portal de faturamento. Você mantém acesso ao plano até o fim do período já pago — nenhuma cobrança adicional é feita.
                </p>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Como funciona o sistema de indicações?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Ao indicar um amigo que se cadastrar, você ganha 50 créditos bônus. O amigo indicado recebe 25 créditos de boas-vindas. Não há limite de indicações.
                </p>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Meus dados são excluídos ao cancelar?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Não. Seus projetos e histórico permanecem disponíveis após o cancelamento. Consulte nossa{" "}
                  <Link href="/privacy">
                    <span className="text-[#C9A84C] hover:text-[#E8C96A] transition-colors cursor-pointer">
                      Política de Privacidade
                    </span>
                  </Link>{" "}
                  para informações completas sobre retenção de dados.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              Contato e suporte direto
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Não encontrou o que precisava? Entre em contato com nossa equipe de suporte. Respondemos em até 48 horas úteis.
            </p>
            <a
              href="mailto:suporte@iattom.com.br"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-black transition-all duration-200 hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #E8C84A 0%, #C9A030 38%, #A07820 68%, #C9A030 100%)",
                boxShadow: "0 4px 20px -6px rgba(201,160,48,0.5)",
              }}
            >
              suporte@iattom.com.br
            </a>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              Documentos legais
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/terms">
                <span className="flex items-center gap-2 px-4 py-3 rounded-lg border border-white/10 text-sm text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-all cursor-pointer">
                  Termos de Uso
                </span>
              </Link>
              <Link href="/privacy">
                <span className="flex items-center gap-2 px-4 py-3 rounded-lg border border-white/10 text-sm text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-all cursor-pointer">
                  Política de Privacidade
                </span>
              </Link>
              <Link href="/about">
                <span className="flex items-center gap-2 px-4 py-3 rounded-lg border border-white/10 text-sm text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-all cursor-pointer">
                  Sobre o IAttom
                </span>
              </Link>
            </div>
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
