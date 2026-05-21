import { Link } from "wouter";
import { Logo } from "@/components/ui/Logo";

export function TermsPage() {
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
              Política de Privacidade
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-widest text-[#C9A84C] uppercase mb-3">
            Documento Legal
          </p>
          <h1 className="text-4xl font-bold text-white mb-4">
            Termos de Uso
          </h1>
          <p className="text-zinc-400 text-sm">
            Última atualização: maio de 2025
          </p>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              1. Aceitação dos Termos
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Ao acessar ou utilizar a plataforma IAttom Assist, você concorda integralmente com estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não utilize a plataforma. O uso continuado após alterações nos termos constitui aceitação das modificações.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              2. Descrição da Plataforma
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              O IAttom Assist é uma plataforma SaaS de assistência empresarial com inteligência artificial, voltada para criação de campanhas, validação de produtos, geração de conteúdo, scripts de vídeo e automação de marketing digital.
            </p>
            <p className="text-zinc-400 leading-relaxed">
              A plataforma é oferecida como serviço ("as-is") e pode ser atualizada, modificada ou descontinuada a qualquer momento, com ou sem aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              3. Responsabilidades do Usuário
            </h2>
            <div className="space-y-3">
              {[
                "Fornecer informações verdadeiras, completas e atualizadas no momento do cadastro.",
                "Manter a confidencialidade de suas credenciais de acesso e ser responsável por todas as atividades realizadas em sua conta.",
                "Notificar imediatamente a equipe do IAttom Assist em caso de uso não autorizado de sua conta.",
                "Utilizar a plataforma apenas para finalidades lícitas e em conformidade com a legislação brasileira vigente.",
                "Não compartilhar, revender, sublicenciar ou redistribuir o acesso à plataforma sem autorização expressa.",
                "Ser o único responsável pelo conteúdo que gera, publica ou utiliza por meio da plataforma.",
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] mt-2 shrink-0" />
                  <p className="text-zinc-400 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              4. Regras de Uso da Plataforma
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              É expressamente proibido utilizar o IAttom Assist para:
            </p>
            <div className="space-y-3">
              {[
                "Gerar, distribuir ou armazenar conteúdo ilegal, difamatório, obsceno, discriminatório ou que viole direitos de terceiros.",
                "Realizar ataques cibernéticos, engenharia reversa ou qualquer tentativa de comprometer a segurança da plataforma.",
                "Usar scripts automatizados, bots ou ferramentas para acesso não autorizado em massa.",
                "Violar direitos de propriedade intelectual de terceiros.",
                "Praticar spam, phishing ou qualquer forma de comunicação enganosa.",
                "Tentar burlar sistemas de cobrança, créditos ou planos de assinatura.",
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/60 mt-2 shrink-0" />
                  <p className="text-zinc-400 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              5. Conteúdo Gerado por Inteligência Artificial
            </h2>
            <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-xl p-6">
              <p className="text-zinc-300 leading-relaxed mb-4">
                Os recursos de inteligência artificial do IAttom Assist geram conteúdo de forma automatizada com base nos dados fornecidos pelo usuário. É fundamental compreender:
              </p>
              <div className="space-y-3">
                {[
                  "O conteúdo gerado por IA pode conter imprecisões, erros ou inconsistências. O usuário é responsável por revisar e validar qualquer saída antes de utilizá-la.",
                  "O IAttom Assist não garante a precisão, completude ou adequação do conteúdo gerado para finalidades específicas.",
                  "O conteúdo gerado não representa a opinião, posicionamento ou recomendação oficial do IAttom Assist.",
                  "O usuário assume total responsabilidade pelo uso, publicação e consequências do conteúdo gerado pela plataforma.",
                  "Direitos sobre o conteúdo gerado pertencem ao usuário, respeitados os limites impostos pelos provedores de IA utilizados.",
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]/60 mt-2 shrink-0" />
                    <p className="text-zinc-400 leading-relaxed text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              6. Planos, Créditos e Pagamentos
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              O IAttom Assist opera com sistema de planos e créditos. Cada funcionalidade consome uma quantidade determinada de créditos. Ao contratar um plano pago, você concorda com os valores e condições apresentados no momento da assinatura.
            </p>
            <p className="text-zinc-400 leading-relaxed">
              Reembolsos, cancelamentos e alterações de plano seguem a política comercial vigente. O não pagamento pode resultar em suspensão ou cancelamento do acesso.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              7. Limitação de Responsabilidade
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Na máxima extensão permitida pela lei, o IAttom Assist não se responsabiliza por danos diretos, indiretos, incidentais, especiais ou consequentes decorrentes do uso ou incapacidade de uso da plataforma, incluindo perda de dados, receita ou oportunidades de negócio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              8. Propriedade Intelectual
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Todos os elementos da plataforma — incluindo interface, logotipo, marca, código-fonte, algoritmos e documentação — são propriedade exclusiva do IAttom Assist e protegidos pelas leis de propriedade intelectual. É proibida qualquer reprodução, modificação ou uso sem autorização expressa por escrito.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              9. Modificações dos Termos
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Reservamo-nos o direito de modificar estes Termos a qualquer momento. Alterações relevantes serão comunicadas por e-mail ou por notificação na plataforma. O uso continuado após a publicação das alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              10. Lei Aplicável e Foro
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias decorrentes deste instrumento, com renúncia expressa a qualquer outro.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              11. Contato
            </h2>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
              <p className="text-zinc-400 leading-relaxed mb-4">
                Em caso de dúvidas sobre estes Termos de Uso, entre em contato:
              </p>
              <div className="space-y-2">
                <p className="text-zinc-300 text-sm">
                  <span className="text-zinc-500 mr-2">E-mail:</span>
                  <a href="mailto:contato@iattomassist.com.br" className="text-[#C9A84C] hover:text-[#E8C96A] transition-colors">
                    contato@iattomassist.com.br
                  </a>
                </p>
                <p className="text-zinc-300 text-sm">
                  <span className="text-zinc-500 mr-2">Site:</span>
                  <a href="https://iattomassist.com.br" className="text-[#C9A84C] hover:text-[#E8C96A] transition-colors">
                    iattomassist.com.br
                  </a>
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-600 text-sm">
            &copy; {new Date().getFullYear()} IAttom Assist. Todos os direitos reservados.
          </p>
          <div className="flex gap-6">
            <Link href="/privacy">
              <span className="text-sm text-zinc-500 hover:text-[#C9A84C] transition-colors cursor-pointer">
                Política de Privacidade
              </span>
            </Link>
            <Link href="/">
              <span className="text-sm text-zinc-500 hover:text-[#C9A84C] transition-colors cursor-pointer">
                Voltar ao Inicio
              </span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
