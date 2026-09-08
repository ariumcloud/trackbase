import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade · Trackbase",
  description:
    "Política de privacidade e proteção de dados da plataforma Trackbase em conformidade com a LGPD e diretrizes de APIs do Google e Meta.",
};

export default function PrivacidadePage() {
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
            <ShieldCheck size={16} /> LGPD &amp; Proteção de Dados
          </div>
          <h1 style={{ fontSize: "2.2rem", color: "#17152F", margin: "0 0 0.5rem 0", fontWeight: 700, letterSpacing: "-0.5px" }}>
            Política de Privacidade
          </h1>
          <p style={{ color: "#64748B", fontSize: "0.95rem" }}>
            Última atualização: <strong>06 de setembro de 2026</strong> · Domínio oficial: <strong>trackbase.com.br</strong>
          </p>
        </div>

        <div style={{ background: "#FFFFFF", borderRadius: "14px", border: "1px solid #E2E8F0", padding: "2.25rem", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", color: "#334155", lineHeight: "1.7", fontSize: "0.98rem" }}>
          
          <div style={{ padding: "1rem 1.25rem", borderRadius: "8px", background: "rgba(91, 52, 234, 0.04)", border: "1px solid rgba(91, 52, 234, 0.15)", marginBottom: "2rem" }}>
            <strong style={{ color: "#5B34EA", display: "block", marginBottom: "0.25rem" }}>Compromisso Trackbase</strong>
            A <strong>Trackbase</strong> valoriza a segurança, a transparência e a privacidade dos seus usuários e dos compradores finais das operações integradas. Tratamos dados de acordo com a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018) e com as políticas de dados de usuários das APIs da Meta e do Google.
          </div>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "1.75rem", marginBottom: "0.75rem" }}>
            1. Quem somos e informações de contato
          </h2>
          <p>
            A <strong>Trackbase</strong> (acessível pelo domínio principal <a href="https://trackbase.com.br" style={{ color: "#5B34EA", textDecoration: "underline" }}>https://trackbase.com.br</a>) é uma plataforma de software como serviço (SaaS) especializada em inteligência de tráfego, atribuição de vendas, rastreamento de conversões com APIs server-side (Meta CAPI e Google Ads API), clonagem e otimização de funis para produtores e afiliados.
          </p>
          <p>
            Para qualquer dúvida sobre privacidade ou para solicitar o exercício de direitos previstos na LGPD, entre em contato com nosso Encarregado de Proteção de Dados (DPO) através do e-mail: <strong>privacidade@trackbase.com.br</strong>.
          </p>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            2. Dados que coletamos
          </h2>
          <p>A Trackbase coleta estritamente os dados necessários para o fornecimento dos seus serviços analíticos e de rastreamento:</p>
          <ul style={{ paddingLeft: "1.4rem", marginBottom: "1rem" }}>
            <li>
              <strong>Dados cadastrais do cliente/usuário:</strong> Nome completo, endereço de e-mail e credenciais de acesso para autenticação no painel.
            </li>
            <li>
              <strong>Parâmetros de rastreamento de tráfego e marketing:</strong> Parâmetros de URL (como <code>utm_source</code>, <code>utm_medium</code>, <code>utm_campaign</code>, <code>utm_content</code>, <code>utm_term</code>), identificadores de clique (<code>fbclid</code>, <code>gclid</code>, <code>ttclid</code>), cookies de sessão primários (<code>_fbp</code>, <code>_fbc</code>, <code>trackbase_sid</code>), endereço IP e User-Agent do navegador.
            </li>
            <li>
              <strong>Dados de transações comerciais (Webhooks):</strong> Quando você conecta seus gateways de pagamento (Hotmart, Kiwify, Cakto, Kirvano, Eduzz, Monetizze, Wiapy, Lowfy, etc.), a Trackbase recebe notificações criptografadas contendo o identificador da transação, valor bruto, taxas, moeda, status da transação e informações do comprador (nome e e-mail).
            </li>
            <li>
              <strong>Dados de contas de anúncios (Google Ads e Meta Ads):</strong> Métricas de desempenho de campanhas, conjuntos de anúncios e criativos (gastos, cliques, impressões) obtidos via conexão OAuth autorizada expressamente pelo usuário.
            </li>
          </ul>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            3. Finalidade e tratamento das informações
          </h2>
          <p>Os dados tratados pela Trackbase destinam-se exclusivamente às seguintes finalidades:</p>
          <ul style={{ paddingLeft: "1.4rem", marginBottom: "1rem" }}>
            <li>Calcular métricas reais de retorno sobre investimento (ROAS), custo por aquisição (CPA) e lucro operacional líquido;</li>
            <li>Identificar em qual criativo, conjunto e anúncio cada venda foi gerada (atribuição multitoque e de último clique);</li>
            <li>Transmitir eventos de conversão de forma deduplicada e criptografada para as APIs da Meta (Conversions API) e do Google Ads (Enhanced Conversions);</li>
            <li>Detectar gargalos de velocidade, abandono de página e falhas de checkout nas páginas do usuário.</li>
          </ul>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            4. Hashing irreversível e segurança das informações
          </h2>
          <p>
            Adotamos medidas técnicas de segurança da informação de padrão bancário:
          </p>
          <ul style={{ paddingLeft: "1.4rem", marginBottom: "1rem" }}>
            <li>
              <strong>Hashing SHA-256 obrigatório:</strong> Dados pessoais de identificação (como e-mail e telefone de compradores) são submetidos a um algoritmo de hashing SHA-256 irreversível antes de qualquer comunicação externa, garantindo que nenhum dado sensível em texto claro trafegue desprotegido.
            </li>
            <li>
              <strong>Criptografia AES-256-GCM:</strong> Tokens de acesso de APIs (Meta Graph API, Google Ads API) e segredos de webhooks são armazenados no banco de dados com criptografia de ponta a ponta.
            </li>
            <li>
              <strong>Isolamento Multi-tenant (RLS):</strong> Cada usuário e workspace possui isolamento rigoroso no banco de dados via Row Level Security (RLS), impedindo categoricamente qualquer vazamento ou cruzamento de dados entre contas distintas.
            </li>
          </ul>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            5. Não comercialização de dados
          </h2>
          <p>
            <strong>A Trackbase NÃO vende, não aluga, não comercializa e não compartilha dados pessoais ou dados de compradores com terceiros para fins de marketing ou publicidade própria.</strong> Todos os dados processados pertencem exclusivamente ao usuário que contratou a plataforma.
          </p>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            6. Conformidade com as Políticas de Dados de Usuário das APIs do Google
          </h2>
          <p>
            O uso das informações recebidas pelas APIs do Google pelo aplicativo da Trackbase obedece estritamente à <strong>Política de Dados de Usuário dos Serviços de API do Google</strong>, incluindo os requisitos de uso limitado:
          </p>
          <ul style={{ paddingLeft: "1.4rem", marginBottom: "1rem" }}>
            <li>Os dados do Google Ads são utilizados unicamente para fornecer visualizações analíticas de gastos e enviar eventos de conversão solicitados pelo próprio usuário;</li>
            <li>Nenhum dado obtido das APIs do Google é transferido a terceiros ou utilizado para veicular anúncios não autorizados;</li>
            <li>Não utilizamos dados das APIs do Google para treinar modelos de inteligência artificial ou aprendizado de máquina generalistas sem o consentimento do titular.</li>
          </ul>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            7. Direitos dos titulares de dados (LGPD)
          </h2>
          <p>Conforme o Artigo 18 da LGPD, você possui o direito de solicitar a qualquer momento:</p>
          <ul style={{ paddingLeft: "1.4rem", marginBottom: "1rem" }}>
            <li>Confirmação da existência de tratamento de dados;</li>
            <li>Acesso aos seus dados pessoais armazenados;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
            <li>Exclusão definitiva de sua conta e de todos os dados associados aos seus workspaces.</li>
          </ul>
          <p>
            Para exercer esses direitos, basta enviar uma solicitação para <strong>privacidade@trackbase.com.br</strong> ou utilizar a opção de exclusão e limpeza de dados diretamente no painel de configurações.
          </p>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            8. Retenção e exclusão de dados
          </h2>
          <p>
            Os dados de métricas e sessões são retidos enquanto a conta do usuário estiver ativa ou conforme necessário para cumprir obrigações legais e fiscais. Mediante o encerramento do plano ou solicitação de exclusão, todos os registros identificáveis são purgados dos nossos servidores em até 30 dias.
          </p>

          <h2 style={{ fontSize: "1.3rem", color: "#17152F", marginTop: "2rem", marginBottom: "0.75rem" }}>
            9. Atualizações desta Política
          </h2>
          <p>
            Podemos atualizar esta Política de Privacidade periodicamente para refletir melhorias em nossos serviços, atualizações legais ou novas integrações de plataformas. Notificaremos os usuários cadastrados sobre alterações materiais por e-mail ou por aviso destacado no painel.
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
          <Link href="/termos" style={{ color: "#64748B" }}>
            Termos de Serviço
          </Link>
          <Link href="/privacidade" style={{ color: "#5B34EA", fontWeight: 600 }}>
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
