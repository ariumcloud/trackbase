import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, FileText, AlertTriangle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Serviço · Trackbase",
  description:
    "Termos e condições de uso da plataforma Trackbase de rastreamento e atribuição de tráfego direto.",
};

export default function TermosPage() {
  return (
    <main className="landing-page" style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* Header */}
      <nav className="landing-nav" style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0" }}>
        <Link href="/" className="brand">
          <Image
            src="/Logo Roxa SVG - 1024x1024.svg"
            alt="Trackbase Logo"
            width={32}
            height={32}
            className="brand-logo-img"
          />
          Trackbase
          <span className="brand-dot" />
        </Link>
        <div className="landing-nav-links">
          <Link href="/" className="button small ghost" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <ArrowLeft size={14} /> Voltar ao Início
          </Link>
          <Link href="/login" className="button small primary">
            Entrar no Painel
          </Link>
        </div>
      </nav>

      {/* Conteúdo Principal */}
      <div style={{ maxWidth: "860px", margin: "2.5rem auto", padding: "0 1.5rem 4rem 1.5rem" }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.25rem 0.75rem", borderRadius: "20px", background: "rgba(91, 52, 234, 0.08)", color: "#5B34EA", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            <FileText size={16} /> Contrato de Uso
          </div>
          <h1 style={{ fontSize: "2.2rem", color: "#17152F", margin: "0 0 0.5rem 0", fontWeight: 700, letterSpacing: "-0.5px" }}>
            Termos de Serviço
          </h1>
          <p style={{ color: "#64748B", fontSize: "0.95rem" }}>
            Última atualização: <strong>06 de setembro de 2026</strong> · Domínio oficial: <strong>trackbase.com.br</strong>
          </p>
        </div>

        <div style={{ background: "#FFFFFF", borderRadius: "14px", border: "1px solid #E2E8F0", padding: "2.25rem", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", color: "#334155", lineHeight: "1.7", fontSize: "0.98rem" }}>
          
          <div style={{ padding: "1rem 1.25rem", borderRadius: "8px", background: "rgba(91, 52, 234, 0.04)", border: "1px solid rgba(91, 52, 234, 0.15)", marginBottom: "2rem" }}>
            <strong style={{ color: "#5B34EA", display: "block", marginBottom: "0.25rem" }}>Visão Geral</strong>
            Estes Termos de Serviço (&quot;Termos&quot;) regem o acesso e a utilização dos serviços, softwares e websites fornecidos pela <strong>Trackbase</strong> (<a href="https://trackbase.com.br" style={{ color: "#5B34EA", textDecoration: "underline" }}>https://trackbase.com.br</a>). Ao criar uma conta ou utilizar qualquer funcionalidade da plataforma, você declara ter lido, compreendido e aceito integralmente estas condições.
          </div>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "1.75rem", marginBottom: "0.75rem" }}>
            1. Objeto e Serviços Oferecidos
          </h2>
          <p>
            A Trackbase fornece ferramentas de inteligência operacional para marketing de resposta direta, compreendendo:
          </p>
          <ul style={{ paddingLeft: "1.4rem", marginBottom: "1rem" }}>
            <li>Rastreamento e geração de parâmetros UTM dinâmicos para campanhas de publicidade;</li>
            <li>Conexão de APIs de conversão server-side (Meta Conversions API e Google Ads API) com deduplicação de eventos;</li>
            <li>Recepção e normalização de webhooks de plataformas de checkout (Hotmart, Kiwify, Cakto, Kirvano, Eduzz, Monetizze, Wiapy, entre outras);</li>
            <li>Auditoria técnica e diagnóstico de gargalos de conversão em páginas de venda;</li>
            <li>Ferramenta de clonagem e extração de blocos para modelagem de funis de venda autorizados;</li>
            <li>Assistente com inteligência artificial para consulta analítica de métricas financeiras.</li>
          </ul>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            2. Cadastro e Responsabilidade pela Conta
          </h2>
          <p>
            Para usufruir dos serviços, o usuário deve possuir capacidade civil plena e fornecer informações cadastrais verídicas e atualizadas. A segurança da senha e o sigilo das chaves de API são de responsabilidade exclusiva do titular da conta. Notifique imediatamente a Trackbase caso suspeite de qualquer uso não autorizado do seu workspace.
          </p>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            3. Uso Ético e Responsabilidade sobre o Clonador de Funil
          </h2>
          <div style={{ padding: "1rem 1.15rem", borderRadius: "8px", background: "rgba(239, 51, 64, 0.05)", border: "1px solid rgba(239, 51, 64, 0.2)", margin: "1rem 0" }}>
            <strong style={{ color: "#EF3340", display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.35rem" }}>
              <AlertTriangle size={18} /> Cláusula de Responsabilidade e Propriedade Intelectual
            </strong>
            <p style={{ margin: 0, fontSize: "0.92rem", color: "#7F1D1D", lineHeight: "1.5" }}>
              O usuário declara expressamente que possui os devidos direitos autorais, licença de afiliado ou autorização comercial do titular da oferta para analisar, clonar ou veicular quaisquer páginas importadas através do Clonador de Funil do Trackbase.
            </p>
          </div>
          <p>
            É terminantemente proibido utilizar o Trackbase para:
          </p>
          <ul style={{ paddingLeft: "1.4rem", marginBottom: "1rem" }}>
            <li>Praticar pirataria, plágio não autorizado de marcas registradas ou veiculação de cópias enganosas de produtos de terceiros;</li>
            <li>Promover produtos ou serviços ilegais, fraudulentos, esquemas de pirâmide, phishing ou qualquer prática vedada pelo Código de Defesa do Consumidor brasileiro;</li>
            <li>Disseminar códigos maliciosos, exploits ou tentar contornar as barreiras de segurança do sistema;</li>
            <li>Violar as políticas de publicidade do Google Ads, Meta Ads ou das plataformas de pagamento conectadas.</li>
          </ul>
          <p>
            A Trackbase reserva-se o direito de suspender ou banir sumariamente workspaces que violem estas diretrizes, sem direito a reembolso das mensalidades pagas.
          </p>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            4. Integrações com Plataformas Externas
          </h2>
          <p>
            O Trackbase integra-se com serviços de terceiros (Meta, Google, gateways de pagamento). O usuário reconhece que:
          </p>
          <ul style={{ paddingLeft: "1.4rem", marginBottom: "1rem" }}>
            <li>A disponibilidade e o funcionamento contínuo das APIs externas dependem exclusivamente das respectivas empresas provedoras;</li>
            <li>A Trackbase não possui ingerência sobre políticas de bloqueio, banimento ou suspensão de contas de anúncios impostas pela Meta ou pelo Google;</li>
            <li>As taxas de transação informadas no painel são calculadas com base nas informações reportadas pelos webhooks dos processadores de pagamento.</li>
          </ul>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            5. Planos, Preços e Pagamentos
          </h2>
          <ul style={{ paddingLeft: "1.4rem", marginBottom: "1rem" }}>
            <li>
              <strong>Assinatura SaaS (Plano Básico - R$ 79/mês):</strong> Cobrança recorrente mensal. O usuário pode cancelar a qualquer momento diretamente pelo painel, mantendo o acesso até o término do ciclo mensal vigente.
            </li>
            <li>
              <strong>Serviço de Implementação Técnica (Setup Completo - R$ 497):</strong> Serviço de consultoria e configuração técnica personalizada realizado sob demanda.
            </li>
            <li>
              <strong>Licença de Código-Fonte (R$ 297 e R$ 397):</strong> Concede ao adquirente uma licença de uso perpétua e não exclusiva para rodar o sistema em sua própria infraestrutura na nuvem (Supabase / Vercel). É expressamente vedada a revenda, sublicenciamento público ou redistribuição desautorizada do código-fonte como produto próprio.
            </li>
          </ul>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            6. Disponibilidade do Sistema (SLA)
          </h2>
          <p>
            Empregamos esforços comercialmente razoáveis para assegurar que a plataforma permaneça disponível 24 horas por dia, 7 dias por semana. No entanto, interrupções temporárias podem ocorrer para manutenções programadas, atualizações de segurança ou eventos de força maior alheios ao nosso controle.
          </p>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            7. Limitação de Responsabilidade
          </h2>
          <p>
            Na extensão máxima permitida pela legislação aplicável, a Trackbase não se responsabiliza por lucros cessantes, perdas financeiras decorrentes de oscilações de mercado, decisões comerciais tomadas com base nas métricas exibidas ou instabilidades temporárias de plataformas terceiras.
          </p>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            8. Alterações dos Termos
          </h2>
          <p>
            A Trackbase poderá atualizar estes Termos de Serviço a qualquer tempo. Alterações significativas serão notificadas através do site ou por e-mail aos usuários ativos com antecedência mínima de 15 dias antes da entrada em vigor.
          </p>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            9. Legislação Aplicável e Foro
          </h2>
          <p>
            Estes Termos são regidos e interpretados em conformidade com as Leis da República Federativa do Brasil. Fica eleito o Foro da Comarca de São Paulo, Estado de São Paulo, para dirimir quaisquer controvérsias decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
          </p>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            10. Contato e Suporte
          </h2>
          <p>
            Para esclarecimentos sobre estes Termos de Serviço ou solicitação de suporte técnico, entre em contato através do e-mail: <strong>suporte@trackbase.com.br</strong>.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="landing-footer" style={{ borderTop: "1px solid #E2E8F0", background: "#FFFFFF" }}>
        <Link href="/" className="brand">
          <Image
            src="/Logo Roxa SVG - 1024x1024.svg"
            alt="Trackbase Logo"
            width={28}
            height={28}
            className="brand-logo-img"
          />
          Trackbase
          <span className="brand-dot" />
        </Link>
        <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.85rem" }}>
          <Link href="/termos" style={{ color: "#5B34EA", fontWeight: 600 }}>
            Termos de Serviço
          </Link>
          <Link href="/privacidade" style={{ color: "#64748B" }}>
            Política de Privacidade
          </Link>
        </div>
        <Link href="/login" className="footer-login-link">
          Entrar no painel →
        </Link>
      </footer>
    </main>
  );
}
