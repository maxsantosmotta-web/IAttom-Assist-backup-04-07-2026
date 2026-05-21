import { Link } from "wouter";
import { Logo } from "@/components/ui/Logo";

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200">
      <header className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <span className="cursor-pointer">
              <Logo size={32} showWordmark />
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
            Documento Legal
          </p>
          <h1 className="text-4xl font-bold text-white mb-4">
            Política de Privacidade
          </h1>
          <p className="text-zinc-400 text-sm">
            Última atualização: maio de 2025
          </p>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              1. Introdução
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              O IAttom Assist respeita e protege a privacidade dos seus usuários. Esta Política descreve como coletamos, utilizamos, armazenamos e protegemos suas informações pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei n.º 13.709/2018) e demais legislações aplicáveis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              2. Dados Coletados
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Coletamos apenas os dados necessários para o funcionamento e melhoria da plataforma:
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  title: "Dados de Cadastro",
                  items: ["Nome completo", "Endereço de e-mail", "Foto de perfil (opcional)", "Data de criação da conta"],
                },
                {
                  title: "Dados de Uso",
                  items: ["Histórico de funcionalidades utilizadas", "Projetos e conteúdos criados", "Quantidade de créditos consumidos", "Logs de atividade na plataforma"],
                },
                {
                  title: "Dados Financeiros",
                  items: ["Plano de assinatura ativo", "Histórico de pagamentos", "Dados de faturamento (processados pela Stripe)"],
                },
                {
                  title: "Dados Técnicos",
                  items: ["Endereço IP", "Tipo e versão do navegador", "Sistema operacional", "Páginas acessadas e duração da sessão"],
                },
              ].map((group) => (
                <div key={group.title} className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">{group.title}</h3>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => (
                      <li key={item} className="flex gap-2 items-start">
                        <div className="w-1 h-1 rounded-full bg-[#C9A84C]/60 mt-2 shrink-0" />
                        <span className="text-zinc-400 text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              3. Finalidade do Tratamento de Dados
            </h2>
            <div className="space-y-3">
              {[
                "Criar e gerenciar sua conta na plataforma.",
                "Processar pagamentos e gerenciar assinaturas.",
                "Fornecer, personalizar e melhorar os serviços da plataforma.",
                "Enviar comunicações transacionais (confirmações, alertas de conta, notificações de sistema).",
                "Prevenir fraudes, abusos e garantir a segurança da plataforma.",
                "Cumprir obrigações legais e regulatórias.",
                "Gerar estatísticas agregadas e anônimas para melhoria contínua do produto.",
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
              4. Cookies e Tecnologias de Rastreamento
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Utilizamos cookies e tecnologias similares para garantir o funcionamento adequado da plataforma e melhorar a experiência do usuário:
            </p>
            <div className="space-y-4">
              {[
                {
                  type: "Cookies Essenciais",
                  desc: "Necessários para o funcionamento básico da plataforma, incluindo autenticação de sessão e segurança. Não podem ser desativados.",
                  color: "bg-emerald-500/60",
                },
                {
                  type: "Cookies de Desempenho",
                  desc: "Coletam dados anônimos sobre como os usuários interagem com a plataforma, permitindo melhorias contínuas na experiência.",
                  color: "bg-blue-500/60",
                },
                {
                  type: "Cookies de Preferência",
                  desc: "Armazenam configurações do usuário, como preferências de interface e estado de sessão entre visitas.",
                  color: "bg-[#C9A84C]/60",
                },
              ].map((cookie) => (
                <div key={cookie.type} className="flex gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <div className={`w-2 h-2 rounded-full ${cookie.color} mt-1.5 shrink-0`} />
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">{cookie.type}</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">{cookie.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              5. Autenticação e Login
            </h2>
            <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-xl p-6">
              <p className="text-zinc-300 leading-relaxed mb-4">
                O IAttom Assist utiliza o serviço Clerk para gerenciamento seguro de autenticação. Ao fazer login, os seguintes aspectos se aplicam:
              </p>
              <div className="space-y-3">
                {[
                  "Suas senhas nunca são armazenadas diretamente pelo IAttom Assist — o processamento é realizado com segurança pelo Clerk.",
                  "O login via Google OAuth redireciona para os servidores do Google para autenticação. Apenas informações básicas do perfil são recebidas.",
                  "Tokens de sessão são armazenados localmente no navegador e expiram automaticamente por inatividade.",
                  "Não compartilhamos suas credenciais de acesso com terceiros.",
                  "Você pode encerrar sua sessão a qualquer momento pelas configurações da conta.",
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
              6. Compartilhamento de Dados
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              Não vendemos, alugamos ou comercializamos seus dados pessoais. Podemos compartilhá-los apenas com:
            </p>
            <div className="space-y-3">
              {[
                { title: "Provedores de Serviço", desc: "Parceiros técnicos (Clerk, Stripe, Replit, OpenAI) que processam dados em nosso nome e estão vinculados por acordos de confidencialidade." },
                { title: "Obrigação Legal", desc: "Quando exigido por lei, ordem judicial ou autoridade competente." },
                { title: "Proteção de Direitos", desc: "Para proteger os direitos, propriedade ou segurança do IAttom Assist, usuários ou terceiros." },
              ].map((item) => (
                <div key={item.title} className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              7. Proteção dos Dados do Usuário
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração, divulgação ou destruição:
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: "Criptografia TLS", desc: "Todas as comunicações entre seu navegador e nossos servidores são criptografadas via HTTPS/TLS." },
                { title: "Acesso Restrito", desc: "Apenas membros autorizados da equipe têm acesso a dados sensíveis, com controles de acesso rigorosos." },
                { title: "Banco de Dados Seguro", desc: "Dados armazenados em infraestrutura com controles de segurança, backups regulares e isolamento por usuário." },
                { title: "Monitoramento", desc: "Sistemas de detecção de anomalias e logs de auditoria para identificar e responder a incidentes de segurança." },
              ].map((item) => (
                <div key={item.title} className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              8. Seus Direitos (LGPD)
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              Nos termos da LGPD, você tem os seguintes direitos em relação aos seus dados pessoais:
            </p>
            <div className="space-y-3">
              {[
                "Confirmar a existência do tratamento de seus dados.",
                "Acessar os dados que mantemos sobre você.",
                "Corrigir dados incompletos, inexatos ou desatualizados.",
                "Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários.",
                "Solicitar a portabilidade dos seus dados para outro fornecedor.",
                "Revogar consentimento a qualquer momento, quando o tratamento for baseado nele.",
                "Solicitar a exclusão completa de sua conta e dados associados.",
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
              9. Retenção de Dados
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Mantemos seus dados pelo tempo necessário para a prestação dos serviços e cumprimento de obrigações legais. Após o encerramento da conta, os dados pessoais são eliminados em até 90 dias, salvo obrigação legal que exija retenção por prazo maior.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              10. Alterações nesta Política
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              Esta Política pode ser atualizada periodicamente. Alterações relevantes serão comunicadas por e-mail ou notificação na plataforma com antecedência mínima de 15 dias. O uso continuado da plataforma após o prazo constitui aceite das novas condições.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-white/5">
              11. Contato e DPO
            </h2>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
              <p className="text-zinc-400 leading-relaxed mb-4">
                Para exercer seus direitos, tirar dúvidas ou reportar incidentes relacionados à privacidade, entre em contato com nosso Encarregado de Dados (DPO):
              </p>
              <div className="space-y-2">
                <p className="text-zinc-300 text-sm">
                  <span className="text-zinc-500 mr-2">E-mail:</span>
                  <a href="mailto:privacidade@iattomassist.com.br" className="text-[#C9A84C] hover:text-[#E8C96A] transition-colors">
                    privacidade@iattomassist.com.br
                  </a>
                </p>
                <p className="text-zinc-300 text-sm">
                  <span className="text-zinc-500 mr-2">Suporte:</span>
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
            <Link href="/terms">
              <span className="text-sm text-zinc-500 hover:text-[#C9A84C] transition-colors cursor-pointer">
                Termos de Uso
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
