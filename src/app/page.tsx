import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Bot,
  Radio,
} from "lucide-react";
import { FaqAccordion } from "@/components/faq-accordion";

const plans = [
  {
    name: "Plano Free",
    price: "Grátis",
    suffix: "",
    description: "Para conhecer a plataforma e organizar seus primeiros links de rastreamento.",
    cta: "Criar conta grátis",
    href: "/login",
    featured: false,
    items: [
      "1 workspace e 1 oferta",
      "Até 10 links com UTMs rastreadas",
      "Até 50 vendas registradas",
      "Painel em tempo real (BRL, USD, EUR)",
      "Webhooks de checkouts integrados",
      "Demo pública com dados de teste",
      "*(Shield, Diagnóstico e Radar bloqueados)*",
    ],
  },
  {
    name: "Plano Básico",
    price: "R$ 79",
    suffix: "/mês",
    description: "Para anunciantes e afiliados que querem parar de queimar dinheiro e escalar com lucro real.",
    cta: "Começar a lucrar agora",
    href: "https://buy.stripe.com/aFa5kF3Wu8AZaQZ0S79IQ03",
    featured: true,
    items: [
      "Meta Ads + 7 plataformas de checkout",
      "Até 1.000 vendas por mês",
      "Recupere até 35% das vendas que o Facebook não marca",
      "Radar de Leads: mapa de calor de rolagem e visitantes ao vivo",
      "Diagnóstico de gargalos com cálculo de perda em R$",
      "Assistente Trackbase IA para análise de ROAS e CPA",
      "Alertas com som de caixa registradora e Web Push no celular",
      "Suporte multi-moeda: Dólar ($), Euro (€) e Real (R$)",
      "Upsell, downsell e order bump separados",
    ],
  },
  {
    name: "Plano Premium",
    price: "R$ 197",
    suffix: "/mês",
    description: "Para operações de alta escala, agências, co-produções e múltiplos produtos.",
    cta: "Assinar Premium",
    href: "https://buy.stripe.com/4gMeVfeB86sRbV3cAP9IQ04",
    featured: false,
    items: [
      "Tudo do Plano Básico incluso",
      "Shield Anti-Bloqueio & Cloaker Profissional (White/Black/Gray page)",
      "Apontamento de domínio próprio CNAME (Cloudflare/Hostinger)",
      "Bloqueio de robôs espiões do AdHeart e concorrentes",
      "Até 5.000 vendas por mês",
      "Até 25 workspaces e múltiplos acessos de equipe",
      "Exportação completa de vendas e campanhas em CSV",
      "Suporte VIP prioritário no WhatsApp e onboarding assistido",
    ],
  },
];

const faqs = [
  {
    question: "Como o Trackbase me ajuda a lucrar mais com tráfego pago?",
    answer:
      "O Facebook mente no gerenciador de anúncios e costuma perder até 35% das vendas por causa do iOS 14+ e navegadores bloqueadores. O Trackbase conecta direto no seu checkout e envia as compras aprovadas de volta para a Meta de forma instantânea e segura. Seu pixel aprende quem compra de verdade, seu custo por venda (CPA) despenca e você sabe no centavo qual anúncio está botando dinheiro no seu bolso para escalar sem medo.",
  },
  {
    question: "O que é o Radar de Leads e como ele salva vendas perdidas?",
    answer:
      "O Radar de Leads monitora os visitantes da sua página ao vivo. Você vê exatamente até qual dobra eles rolaram a página (topo, apresentação do produto, oferta ou checkout). Isso permite identificar onde as pessoas desistem da sua oferta e criar campanhas de remarketing cirúrgicas para quem quase comprou.",
  },
  {
    question: "O que é o Shield Anti-Bloqueio & Cloaker e por que ele é essencial?",
    answer:
      "O Shield é a ferramenta que protege suas páginas milionárias contra dois grandes vilões: bloqueios repentinos da Meta e concorrentes que copiam sua página no AdHeart. Ele entrega uma White Page educativa para analistas/robôs e entrega a sua página de vendas apenas para o lead humano real que clicou no seu anúncio, tudo no seu próprio domínio CNAME.",
  },
  {
    question: "Minhas contas de anúncio estão em Dólar ou Euro. O Trackbase funciona?",
    answer:
      "Sim! O Trackbase possui suporte nativo multi-moeda. Você pode alternar a exibição das suas métricas e campanhas entre Real (BRL), Dólar (USD) e Euro (EUR) com um clique, visualizando seus gastos e lucros na moeda exata da sua operação.",
  },
  {
    question: "Quais plataformas de checkout são integradas em 1 clique?",
    answer:
      "O Trackbase integra nativamente com todas as principais plataformas: Hotmart, Kiwify, Cakto, Kirvano, Eduzz, Monetizze, Wiapy, além de validação estrita para Braip e Ticto. Suas vendas são processadas automaticamente via webhooks com separação inteligente de produto principal, order bump e upsell.",
  },
  {
    question: "O que é o Diagnóstico de Gargalos e Auditoria Financeira?",
    answer:
      "O Diagnóstico analisa todo o funil (Cliques Meta → Visitas na Página → Cliques no Botão → Checkouts → Compras) e calcula na hora: 'Você perdeu R$ 1.840 este mês com lentidão de página ou desistência no checkout'. Ele aponta a solução prática imediata para você estancar o sangramento do tráfego e lucrar muito mais com a mesma verba.",
  },
];

function MockDashboard() {
  return (
    <div className="landing-mock" aria-label="Prévia do dashboard Trackbase">
      <div className="mock-sidebar">
        <div className="mock-logo-wrap">
          <Image
            src="/Logo Roxa SVG - 1024x1024.svg"
            alt="Trackbase Logo"
            width={34}
            height={34}
            className="mock-logo-img"
          />
        </div>
        <span className="mock-line wide" />
        <span className="mock-line active" />
        <span className="mock-line" />
        <span className="mock-line" />
        <span className="mock-line" />
        <span className="mock-line" />
      </div>
      <div className="mock-content">
        <div className="mock-top">
          <span>Visão geral · Trackbase</span>
          <span className="mock-live">● Rastreamento em tempo real</span>
        </div>
        <div className="mock-heading">
          <div>
            <span className="mock-kicker">CONTROLE NA MÃO</span>
            <strong>Sua operação, sem achismo.</strong>
          </div>
          <span className="mock-button">+ Criar link UTM</span>
        </div>
        <div className="mock-cards">
          <div>
            <small>Investimento</small>
            <b>R$ 1.450,00</b>
            <em>Meta Ads Oficial</em>
          </div>
          <div>
            <small>Receita Líquida</small>
            <b>R$ 4.820,00</b>
            <em>34 compras aprovadas</em>
          </div>
          <div className="positive">
            <small>Lucro Operacional</small>
            <b className="text-positive">+ R$ 3.370,00</b>
            <em className="indicator-pos">
              <TrendingUp size={11} /> ROAS 3.32x (69.9%)
            </em>
          </div>
        </div>
        <div className="mock-panel">
          <div className="mock-panel-title">
            Funil da operação <span>Últimos 7 dias</span>
          </div>
          <div className="mock-funnel">
            <i style={{ width: "94%" }} className="funnel-bar-1" />
            <i style={{ width: "58%" }} className="funnel-bar-2" />
            <i style={{ width: "26%" }} className="funnel-bar-3" />
            <i style={{ width: "12%" }} className="funnel-bar-4" />
          </div>
          <div className="mock-labels">
            <span>
              Visitas <b>2.840</b>
            </span>
            <span>
              Cliques <b>648</b>
            </span>
            <span>
              Checkouts <b>112</b>
            </span>
            <span>
              Compras <b>34</b>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <Link href="/" className="brand">
          <Image
            src="/Logo Roxa SVG - 1024x1024.svg"
            alt="Trackbase Logo"
            width={34}
            height={34}
            className="brand-logo-img"
          />
          <span className="brand-title-text">Trackbase</span>
          <span className="brand-dot" />
        </Link>
        <div className="landing-nav-links">
          <a href="#como-funciona">Como funciona</a>
          <a href="#diagnostico">Diagnóstico</a>
          <a href="#assistente">Assistente IA</a>
          <a href="#comparativo">Comparativo</a>
          <a href="#planos">Planos</a>
          <a href="#faq">FAQ</a>
          <Link href="/login" className="button small primary">
            Entrar
          </Link>
        </div>
        <div className="landing-nav-mobile-action" style={{ display: "none" }}>
          <Link href="/login" className="button small primary">
            Entrar no Painel
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">
            A PLATAFORMA QUE OS MAIORES PLAYERS DE DIRECT RESPONSE USAM
          </span>
          <h1>
            Pare de Queimar Dinheiro no Escuro
            <br />
            <em>e escale com lucro real na mão.</em>
          </h1>
          <p>
            O Facebook mente no gerenciador e esconde suas vendas. O Trackbase recupera até 35% das vendas invisíveis direto do servidor, blinda suas páginas contra bloqueios da Meta e te mostra exatamente qual criativo bota lucro no seu bolso por apenas <strong>R$ 79/mês</strong>.
          </p>
          <div className="landing-actions">
            <a href="#planos" className="button primary large">
              Começar a lucrar agora <ArrowRight size={17} />
            </a>
            <a href="#como-funciona" className="button ghost large">
              Ver como funciona
            </a>
          </div>
          <div className="landing-trust">
            <ShieldCheck size={16} /> Mais de R$ 4.8M rastreados · Multi-moeda (BRL, USD, EUR) · Setup em 3 minutos
          </div>
        </div>
        <div className="landing-visual">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <MockDashboard />
        </div>
      </section>

      {/* Proof Strip */}
      <section className="proof-strip">
        <span>
          <strong>+35% Vendas Recuperadas</strong> compras que o Facebook não enxerga
        </span>
        <span>
          <strong>Zero Bloqueios</strong> com Shield Cloaker e proteção de domínio
        </span>
        <span>
          <strong>Hotmart, Kiwify &amp; Cakto</strong> webhooks integrados em 1 clique
        </span>
        <span>
          <strong>Multi-Moeda</strong> opere em Real (R$), Dólar ($) e Euro (€)
        </span>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="landing-section">
        <div className="section-intro">
          <span className="eyebrow">DO CLIQUE AO LUCRO REAL</span>
          <h2>A visão cirúrgica para dobrar o seu ROI de tráfego.</h2>
          <p>
            Chega de abrir cinco abas diferentes para descobrir que o anúncio gastou, a landing não carregou ou as taxas comeram todo o seu lucro.
          </p>
        </div>
        <div className="feature-grid">
          <article>
            <span className="feature-icon">
              <MousePointer2 />
            </span>
            <h3>Atribuição no Centavo (Descubra o Criativo Campeão)</h3>
            <p>
              Saiba na hora qual anúncio está gerando compras com ROAS alto. Pause imediatamente os criativos que só comem o seu caixa e escale os vencedores com total segurança.
            </p>
          </article>
          <article>
            <span className="feature-icon">
              <Radio />
            </span>
            <h3>Radar de Leads &amp; Mapa de Rolagem ao Vivo</h3>
            <p>
              Veja os visitantes navegando na sua página em tempo real. Saiba exatamente até qual dobra eles rolam (topo, vídeo ou oferta) e salve vendas antes do abandono.
            </p>
          </article>
          <article>
            <span className="feature-icon">
              <ShieldCheck />
            </span>
            <h3>Blindagem Shield Anti-Bloqueio &amp; Anti-Espião</h3>
            <p>
              Cloaker profissional que entrega página segura para robôs da Meta e bloqueia concorrentes que usam AdHeart para copiar sua oferta. Seus anúncios rodam livres de surpresas.
            </p>
          </article>
        </div>
      </section>

      {/* Diagnóstico de Funil Section */}
      <section id="diagnostico" className="landing-section">
        <div className="section-intro">
          <span className="eyebrow">AUDITORIA DE PERFORMANCE</span>
          <h2>Diagnóstico de Gargalos &amp; Auditoria Financeira</h2>
          <p>
            Descubra em qual etapa do funil seu tráfego está vazando e quanto dinheiro isso está custando para o seu bolso todo mês.
          </p>
        </div>

        <div style={{ maxWidth: "850px", margin: "0 auto", background: "#17152F", borderRadius: "16px", padding: "2rem", color: "#FFFFFF", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#A78BFA", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>AUDITORIA EM TEMPO REAL</span>
              <h3 style={{ fontSize: "1.4rem", margin: "0.3rem 0 0" }}>Pontuação Geral: 68/100 (Nota C)</h3>
            </div>
            <div style={{ padding: "0.5rem 1rem", borderRadius: "8px", background: "rgba(239, 51, 64, 0.2)", border: "1px solid #EF3340", color: "#FCA5A5", fontWeight: 600, fontSize: "0.9rem" }}>
              Perda Estimada: ~R$ 1.840,00/mês
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            <div style={{ background: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "8px" }}>
              <small style={{ color: "#94A3B8" }}>1. Retenção de Tráfego</small>
              <strong style={{ display: "block", fontSize: "1.2rem", color: "#EF3340", margin: "0.25rem 0" }}>58.2%</strong>
              <span style={{ fontSize: "0.75rem", color: "#CBD5E1" }}>41% dos cliques não abrem a página</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "8px" }}>
              <small style={{ color: "#94A3B8" }}>2. Conversão em CTA</small>
              <strong style={{ display: "block", fontSize: "1.2rem", color: "#10B981", margin: "0.25rem 0" }}>22.4%</strong>
              <span style={{ fontSize: "0.75rem", color: "#CBD5E1" }}>Bom engajamento com a VSL</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "8px" }}>
              <small style={{ color: "#94A3B8" }}>3. Conversão de Checkout</small>
              <strong style={{ display: "block", fontSize: "1.2rem", color: "#F59E0B", margin: "0.25rem 0" }}>14.1%</strong>
              <span style={{ fontSize: "0.75rem", color: "#CBD5E1" }}>Abandono de carrinho acentuado</span>
            </div>
          </div>
        </div>
      </section>

      {/* Assistente IA Section */}
      <section id="assistente" className="landing-section" style={{ background: "#F8FAFC", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0" }}>
        <div className="section-intro">
          <span className="eyebrow">COPILOTO INTELIGENTE</span>
          <h2>Assistente Trackbase IA</h2>
          <p>
            Uma inteligência artificial que conhece os números do seu tráfego e responde perguntas operacionais e estratégicas na hora.
          </p>
        </div>

        <div style={{ maxWidth: "800px", margin: "0 auto", background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "1.5rem", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#5B34EA", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bot size={18} />
            </div>
            <div style={{ background: "#F1F5F9", padding: "0.85rem 1rem", borderRadius: "4px 14px 14px 14px", fontSize: "0.9rem", color: "#0F172A", lineHeight: "1.5" }}>
              <strong>Pergunta:</strong> &quot;Qual meu ROAS hoje e quais anúncios devo pausar?&quot;
              <div style={{ marginTop: "0.5rem", color: "#334155" }}>
                <strong>Assistente Trackbase:</strong> Seu ROAS consolidado hoje está em <strong>2.84x</strong> com R$ 1.420 em vendas. A campanha <em>[Escala] - Criativo 04</em> atingiu CPA de R$ 94,00 (acima do seu teto de R$ 55,00) sem conversões nas últimas 12 horas. Recomendação: <strong>pausar o conjunto 04</strong> e remanejar o orçamento para o <em>Criativo 02</em> que está com ROAS 4.1x.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparativo de Mercado */}
      <section id="comparativo" className="landing-section">
        <div className="section-intro">
          <span className="eyebrow">TRANSPARÊNCIA TOTAL</span>
          <h2>Trackbase vs. Ferramentas Tradicionais</h2>
          <p>Veja por que os maiores operadores de direct response estão migrando para o Trackbase.</p>
        </div>

        <div style={{ maxWidth: "900px", margin: "0 auto", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#FFFFFF", borderRadius: "12px", overflow: "hidden", border: "1px solid #E2E8F0" }}>
            <thead>
              <tr style={{ background: "#17152F", color: "#FFFFFF", textAlign: "left" }}>
                <th style={{ padding: "1rem 1.25rem" }}>Recurso / Benefício</th>
                <th style={{ padding: "1rem 1.25rem", color: "#A78BFA" }}>Trackbase</th>
                <th style={{ padding: "1rem 1.25rem", color: "#94A3B8" }}>Outras Ferramentas</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: "0.92rem" }}>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                <td style={{ padding: "0.9rem 1.25rem", fontWeight: 600 }}>Mensalidade Acessível</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#10B981", fontWeight: 600 }}>R$ 79 / mês</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#EF3340" }}>R$ 197 a R$ 497 / mês</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                <td style={{ padding: "0.9rem 1.25rem", fontWeight: 600 }}>Radar de Leads &amp; Heatmap de Rolagem</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#10B981", fontWeight: 600 }}>✅ Incluso</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#EF3340" }}>❌ Não possui ou cobra à parte</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                <td style={{ padding: "0.9rem 1.25rem", fontWeight: 600 }}>Shield Anti-Bloqueio &amp; Cloaker</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#10B981", fontWeight: 600 }}>✅ Incluso no Premium</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#EF3340" }}>❌ Ferramenta externa (R$ 297/mês)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                <td style={{ padding: "0.9rem 1.25rem", fontWeight: 600 }}>Painel Multi-Moeda (Real, Dólar, Euro)</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#10B981", fontWeight: 600 }}>✅ 1-Clique (BRL, USD, EUR)</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#94A3B8" }}>❌ Travado em BRL</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                <td style={{ padding: "0.9rem 1.25rem", fontWeight: 600 }}>Diagnóstico de Gargalos &amp; Perda em R$</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#10B981" }}>✅ Algoritmo Nativo</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#94A3B8" }}>❌ Apenas métricas brutas</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                <td style={{ padding: "0.9rem 1.25rem", fontWeight: 600 }}>Assistente Trackbase IA Integrado</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#10B981" }}>✅ Incluso</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#94A3B8" }}>❌ Não possui</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                <td style={{ padding: "0.9rem 1.25rem", fontWeight: 600 }}>Cobrança por Volume de Eventos</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#10B981", fontWeight: 600 }}>R$ 0 (sem surpresa na fatura)</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#EF3340" }}>Cobra por clique/evento extra</td>
              </tr>
              <tr>
                <td style={{ padding: "0.9rem 1.25rem", fontWeight: 600 }}>Opção de Código-Fonte Próprio</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#10B981" }}>✅ R$ 297 / R$ 397 vitalício</td>
                <td style={{ padding: "0.9rem 1.25rem", color: "#94A3B8" }}>❌ Preso à mensalidade</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Planos Section */}
      <section id="planos" className="landing-section plans-section">
        <div className="section-intro">
          <span className="eyebrow">DIRETO AO PONTO</span>
          <h2>Preço justo para quem quer resultado.</h2>
          <p>Escolha o modelo ideal para o momento da sua operação.</p>
        </div>
        <div className="plans-grid">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`plan-card ${plan.featured ? "featured" : ""}`}
            >
              {plan.featured && (
                <span className="plan-badge">MAIS ESCOLHIDO</span>
              )}
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="plan-price">
                {plan.price}
                <small>{plan.suffix}</small>
              </div>
              <ul>
                {plan.items.map((item) => (
                  <li key={item}>
                    <Check size={15} />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`button ${plan.featured ? "primary" : "ghost"}`}
              >
                {plan.cta} <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Serviços Comerciais */}
      <section id="mais-opcoes" className="landing-section" style={{ display: "none" }}>
        <div className="section-intro">
          <span className="eyebrow">ÁREA COMERCIAL</span>
          <h2>Serviços Técnicos e Código-Fonte</h2>
          <p>
            Serviços adicionais de consultoria, implementação técnica e
            código-fonte — separados da assinatura SaaS.
          </p>
        </div>
        <div className="feature-grid">
          <article>
            <span className="chip" style={{ marginBottom: "10px" }}>SERVIÇO TÉCNICO</span>
            <h3>Setup completo — R$ 497</h3>
            <p>
              Nossa equipe configura toda a sua operação: Meta Ads, pixels,
              envio de conversões via servidor, parâmetros UTM e integração completa
              com Hotmart, Kiwify, Cakto, Kirvano, Eduzz, Monetizze e Wiapy.
            </p>
            <Link href="/login" className="button primary" style={{ marginTop: "14px" }}>
              Contratar setup <ArrowRight size={15} />
            </Link>
          </article>
          <article>
            <span className="chip" style={{ marginBottom: "10px" }}>AUTONOMIA TOTAL</span>
            <h3>Código-fonte — R$ 297</h3>
            <p>
              Receba o repositório completo com documentação detalhada passo a passo para hospedar na sua própria Vercel e Supabase sem pagar mensalidades.
            </p>
            <Link href="/login" className="button ghost" style={{ marginTop: "14px" }}>
              Comprar código <ArrowRight size={15} />
            </Link>
          </article>
          <article>
            <span className="chip" style={{ marginBottom: "10px" }}>CHAVE NA MÃO</span>
            <h3>Código + Instalação — R$ 397</h3>
            <p>
              O código-fonte completo com instalação assistida diretamente na sua infraestrutura pela nossa equipe técnica, pronto para rodar.
            </p>
            <Link href="/login" className="button ghost" style={{ marginTop: "14px" }}>
              Comprar com instalação <ArrowRight size={15} />
            </Link>
          </article>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="landing-section" style={{ background: "#F8FAFC", borderTop: "1px solid #E2E8F0" }}>
        <div className="section-intro">
          <span className="eyebrow">DÚVIDAS FREQUENTES</span>
          <h2>Tudo o que você precisa saber sobre o Trackbase</h2>
          <p>Perguntas comuns sobre rastreamento, envio de vendas, proteção de ofertas e lucros.</p>
        </div>
        <FaqAccordion items={faqs} />
      </section>

      {/* CTA Final */}
      <section id="contato" className="landing-cta">
        <div>
          <Sparkles size={24} />
          <div>
            <h2>Menos custo. Mais clareza. Paz no bolso.</h2>
            <p>
              Crie sua conta em 2 minutos e tenha controle absoluto da sua operação com rastreamento server-side e anti-bloqueio.
            </p>
          </div>
        </div>
        <Link href="/login" className="button primary large">
          Criar minha conta grátis <ArrowRight size={17} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
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
        <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.85rem", alignItems: "center" }}>
          <Link href="/termos" style={{ color: "#64748B" }}>
            Termos de Serviço
          </Link>
          <span style={{ color: "#CBD5E1" }}>·</span>
          <Link href="/privacidade" style={{ color: "#64748B" }}>
            Política de Privacidade
          </Link>
        </div>
        <Link href="/login" className="footer-login-link">
          Entrar no painel <ArrowRight size={13} />
        </Link>
      </footer>
    </main>
  );
}
