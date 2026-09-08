import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  MousePointer2,
  Play,
  ShieldCheck,
  Sparkles,
  Wallet,
  TrendingUp,
  TrendingDown,
  Bot,
} from "lucide-react";
import { FaqAccordion } from "@/components/faq-accordion";

const plans = [
  {
    name: "Plano Free",
    price: "Grátis",
    suffix: "",
    description: "Para conhecer o fluxo e organizar sua primeira operação.",
    cta: "Criar workspace",
    href: "/login",
    featured: false,
    items: [
      "1 workspace",
      "1 oferta e até 10 links UTM",
      "Até 50 vendas",
      "Dashboard básico em tempo real",
      "Demo pública com dados fictícios",
    ],
  },
  {
    name: "Plano Básico",
    price: "R$ 79",
    suffix: "/mês",
    description: "Para operar suas próprias campanhas com clareza, controle e escala.",
    cta: "Começar agora",
    href: "https://buy.stripe.com/aFa5kF3Wu8AZaQZ0S79IQ03",
    featured: true,
    items: [
      "Meta Ads e 7 plataformas de checkout",
      "Até 1.000 vendas",
      "Pixel e CAPI server-side deduplicados",
      "Diagnóstico de gargalos com cálculo de perda financeira",
      "Assistente Trackbase IA para análise de ROAS e CPA",
      "Upsell, downsell e order bump separados",
      "Alertas inteligentes e exportação CSV",
    ],
  },
  {
    name: "Plano Premium",
    price: "R$ 197",
    suffix: "/mês",
    description: "Para operadores avançados, alta escala, agências e múltiplos produtos.",
    cta: "Assinar Premium",
    href: "https://buy.stripe.com/4gMeVfeB86sRbV3cAP9IQ04",
    featured: false,
    items: [
      "Tudo do Plano Básico",
      "Até 5.000 vendas",
      "Até 25 workspaces e múltiplos acessos",
      "Relatórios consolidados para múltiplos sócios",
      "Suporte prioritário e onboarding assistido",
    ],
  },
];

const faqs = [
  {
    question: "Como o Trackbase evita eventos duplicados na Meta CAPI?",
    answer:
      "O Trackbase utiliza o mesmo event_id rigorosamente compartilhado entre o script do navegador e o servidor server-side. A Meta recebe os dois sinais e, por conterem o mesmo identificador único, aproveita os parâmetros enriquecidos descartando a duplicação. Além disso, aplicamos hash SHA-256 apenas em dados pessoais (e-mail e telefone) preservando cookies brutos fbp, fbc, IP e User-Agent para nota máxima no Event Quality Match (EMQ).",
  },
  {
    question: "Quais plataformas de checkout são suportadas?",
    answer:
      "O Trackbase suporta nativamente todas as principais plataformas de direct response do Brasil: Hotmart, Kiwify, Cakto, Kirvano, Eduzz, Monetizze, Wiapy, além de validação estrita de domínios para Braip, Ticto, Perfect Pay e Greenn. Suas vendas são processadas via webhooks criptografados com separação de produto principal, order bump e upsell.",
  },
  {
    question: "O que é o Diagnóstico de Gargalos e Auditoria Financeira?",
    answer:
      "O Diagnóstico analisa cada etapa da jornada: Cliques na Meta → PageViews carregados → Cliques no botão CTA → Checkouts iniciados → Vendas aprovadas. Se sua página perde 40% das visitas antes de abrir, o Trackbase calcula exatamente quantos Reais (R$) você perdeu no período e aponta recomendações práticas para estancar o sangramento.",
  },
  {
    question: "O que o Assistente Trackbase IA consegue fazer?",
    answer:
      "O Assistente IA tem acesso contextual aos dados consolidados do seu workspace: receita, investimento em mídia, lucro, ROAS, CPA e gargalos. Ele responde perguntas analíticas como 'Qual meu ROAS real hoje?', 'Qual campanha devo pausar?', 'Onde está meu maior gargalo?' e também fornece orientações táticas sobre esteiras de produto e contingência.",
  },
  {
    question: "Posso adquirir o código-fonte para rodar na minha própria nuvem?",
    answer:
      "Sim! Oferecemos a opção de compra do código-fonte completo: R$ 297 (código com documentação para auto-instalação) ou R$ 397 (código com instalação assistida pela nossa equipe). Você roda tudo no seu próprio Supabase e Vercel com zero mensalidade.",
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
          <Link href="/demo" className="nav-demo">
            Ver demo <Play size={13} fill="currentColor" />
          </Link>
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
            A PLATAFORMA DEFINITIVA DE DIRECT RESPONSE
          </span>
          <h1>
            Rastreamento &amp; Lucro Real
            <br />
            <em>sem pagar fortunas.</em>
          </h1>
          <p>
            Trackbase une Meta Ads, CAPI server-side deduplicada, diagnóstico de gargalos com cálculo de perda financeira e assistente IA em uma única central por <strong>R$ 79/mês</strong>.
          </p>
          <div className="landing-actions">
            <Link href="/demo" className="button primary large">
              Testar a demo grátis <ArrowRight size={17} />
            </Link>
            <a href="#planos" className="button ghost large">
              Ver planos &amp; preços
            </a>
          </div>
          <div className="landing-trust">
            <ShieldCheck size={16} /> Isolamento total por workspace e tokens criptografados com AES-256
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
          <strong>Meta Ads &amp; CAPI</strong> eventos server-side deduplicados
        </span>
        <span>
          <strong>Hotmart, Kiwify &amp; Cakto</strong> webhooks ponta a ponta
        </span>
        <span>
          <strong>Kirvano, Eduzz &amp; Monetizze</strong> order bumps e taxas líquidas
        </span>
        <span>
          <strong>Wiapy, Braip &amp; Ticto</strong> checkouts seguros e integrados
        </span>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="landing-section">
        <div className="section-intro">
          <span className="eyebrow">DO CLIQUE AO LUCRO REAL</span>
          <h2>A visão completa da sua operação de tráfego.</h2>
          <p>
            Chega de abrir cinco abas diferentes para descobrir que o anúncio gastou, a landing não carregou ou as taxas comeram todo o seu lucro.
          </p>
        </div>
        <div className="feature-grid">
          <article>
            <span className="feature-icon">
              <MousePointer2 />
            </span>
            <h3>Atribuição precisa por criativo</h3>
            <p>
              Gere links com parâmetros dinâmicos da Meta e decore o checkout automaticamente preservando a sessão do comprador com cookies fbp e fbc.
            </p>
          </article>
          <article>
            <span className="feature-icon alert-icon">
              <TrendingDown />
            </span>
            <h3>Identifique gargalos e quedas</h3>
            <p>
              Veja exatamente onde o lead abandona a jornada: no carregamento lento da página, no clique do botão ou na etapa de pagamento do checkout.
            </p>
          </article>
          <article>
            <span className="feature-icon">
              <Wallet />
            </span>
            <h3>Lucro líquido de verdade</h3>
            <p>
              Deduza investimento de mídia e taxas de processamento automaticamente. Veja seu lucro operacional e margem percentual em tempo real.
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
              CAPI server-side, webhooks, parâmetros UTM e integração completa
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
          <p>Perguntas comuns sobre rastreamento, CAPI, clonagem e segurança.</p>
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
              Acesse a demonstração interativa e descubra em 2 minutos como ter
              controle absoluto da sua operação.
            </p>
          </div>
        </div>
        <Link href="/demo" className="button primary large">
          Abrir a demo agora <ArrowRight size={17} />
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
