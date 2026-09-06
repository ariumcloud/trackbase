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
} from "lucide-react";

const plans = [
  {
    name: "Plano Devedor",
    price: "Grátis",
    suffix: "",
    description: "Para conhecer o fluxo e organizar sua primeira operação.",
    cta: "Criar workspace",
    href: "/login",
    featured: false,
    items: [
      "1 workspace",
      "1 oferta e até 10 links UTM",
      "Dashboard básico em tempo real",
      "Demo pública com dados fictícios",
    ],
  },
  {
    name: "Plano Liso",
    price: "R$ 50",
    suffix: "/mês",
    description: "Para operar suas próprias campanhas com clareza e controle.",
    cta: "Começar agora",
    href: "/login",
    featured: true,
    items: [
      "Meta Ads e 7 plataformas de checkout",
      "Pixel e CAPI server-side deduplicados",
      "Dashboard financeiro com métricas reais",
      "Upsell, downsell e order bump separados",
      "Alertas de gargalo e monitoramento",
    ],
  },
  {
    name: "Plano Vorcaro",
    price: "R$ 197",
    suffix: "/mês",
    description: "Para operadores avançados, alta escala e agências.",
    cta: "Acessar Vorcaro",
    href: "/login",
    featured: false,
    items: [
      "Tudo do Plano Liso",
      "Até 25 workspaces e múltiplos acessos",
      "Clonador de funil e mineração de ofertas",
      "Detector avançado de gargalos e Jeen AI",
      "Relatórios operacionais e auditoria completa",
    ],
  },
];

function MockDashboard() {
  return (
    <div className="landing-mock" aria-label="Prévia do dashboard Kirofy">
      <div className="mock-sidebar">
        <div className="mock-logo-wrap">
          <Image
            src="/logo.png"
            alt="Kirofy Logo"
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
          <span>Visão geral</span>
          <span className="mock-live">● Dados fictícios</span>
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
            <em>Meta Ads</em>
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
              <TrendingUp size={11} /> Margem 69.9%
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
            src="/logo.png"
            alt="Kirofy Logo"
            width={34}
            height={34}
            className="brand-logo-img"
          />
          Kirofy
          <span className="brand-dot" />
        </Link>
        <div className="landing-nav-links">
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <Link href="/demo" className="nav-demo">
            Ver demo <Play size={13} fill="currentColor" />
          </Link>
          <Link href="/login" className="button small primary">
            Entrar
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">
            RASTREAMENTO PROFISSIONAL PARA QUEM QUER LUCRO REAL
          </span>
          <h1>
            A plataforma pra você
            <br />
            <em>deixar de ser liso.</em>
          </h1>
          <p>
            Kirofy conecta seus anúncios da Meta, páginas, checkouts e vendas em
            uma operação cristalina — sem surpresas no fim do mês e sem pagar
            fortunas por software.
          </p>
          <div className="landing-actions">
            <Link href="/demo" className="button primary large">
              Testar a demo grátis <ArrowRight size={17} />
            </Link>
            <a href="#planos" className="button ghost large">
              Ver planos
            </a>
          </div>
          <div className="landing-trust">
            <ShieldCheck size={16} /> Seus dados ficam protegidos no seu
            workspace
          </div>
        </div>
        <div className="landing-visual">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <MockDashboard />
        </div>
      </section>

      <section className="proof-strip">
        <span>
          <strong>Meta Ads</strong> gasto real e campanhas
        </span>
        <span>
          <strong>Hotmart & Cakto</strong> vendas e order bumps
        </span>
        <span>
          <strong>Meta CAPI</strong> eventos server-side deduplicados
        </span>
        <span>
          <strong>UTM Segura</strong> atribuição precisa por criativo
        </span>
      </section>

      <section id="como-funciona" className="landing-section">
        <div className="section-intro">
          <span className="eyebrow">DO CLIQUE AO LUCRO REAL</span>
          <h2>Uma visão que faz sentido.</h2>
          <p>
            Chega de abrir cinco plataformas para descobrir que o anúncio
            gastou, a landing não converteu ou as taxas comeram todo o seu
            lucro.
          </p>
        </div>
        <div className="feature-grid">
          <article>
            <span className="feature-icon">
              <MousePointer2 />
            </span>
            <h3>Rastreie cada criativo</h3>
            <p>
              Gere links com parâmetros dinâmicos da Meta e decore o checkout
              automaticamente preservando a sessão do comprador.
            </p>
          </article>
          <article>
            <span className="feature-icon alert-icon">
              <TrendingDown />
            </span>
            <h3>Identifique gargalos e quedas</h3>
            <p>
              Veja exatamente onde o lead abandona a jornada: no carregamento da
              página, no clique do botão ou na etapa de pagamento.
            </p>
          </article>
          <article>
            <span className="feature-icon">
              <Wallet />
            </span>
            <h3>Lucro líquido de verdade</h3>
            <p>
              Deduza investimento de mídia e taxas de processamento
              automaticamente. Veja seu lucro líquido real e margem percentual.
            </p>
          </article>
        </div>
      </section>

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

      <section id="mais-opcoes" className="landing-section">
        <div className="section-intro">
          <span className="eyebrow">ÁREA COMERCIAL</span>
          <h2>Mais opções</h2>
          <p>
            Serviços adicionais de consultoria, implementação técnica e
            código-fonte — separados da assinatura SaaS.
          </p>
        </div>
        <div className="feature-grid">
          <article>
            <span className="chip" style={{ marginBottom: "10px" }}>PRODUTO PRINCIPAL</span>
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
            <h3>Treinamento e Aulas</h3>
            <p>
              Aulas práticas e metodologia passo a passo para você ou sua equipe
              criarem a própria estrutura de tracking à prova de falhas, sem
              depender de ninguém.
            </p>
            <Link href="/login" className="button ghost" style={{ marginTop: "14px" }}>
              Saber mais <ArrowRight size={15} />
            </Link>
          </article>
          <article>
            <h3>Código-fonte Kirofy</h3>
            <p>
              Instale no seu próprio Supabase e Vercel sem mensalidade.
              R$ 297 (código com documentação) ou R$ 397 (código com instalação
              assistida inclusa).
            </p>
            <Link href="/login" className="button ghost" style={{ marginTop: "14px" }}>
              Quero o código <ArrowRight size={15} />
            </Link>
          </article>
        </div>
      </section>
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

      <footer className="landing-footer">
        <Link href="/" className="brand">
          <Image
            src="/logo.png"
            alt="Kirofy Logo"
            width={28}
            height={28}
            className="brand-logo-img"
          />
          Kirofy
          <span className="brand-dot" />
        </Link>
        <span>O rastreamento profissional para quem quer lucro real.</span>
        <Link href="/login" className="footer-login-link">
          Entrar no painel <ArrowRight size={13} />
        </Link>
      </footer>
    </main>
  );
}
