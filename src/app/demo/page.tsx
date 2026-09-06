"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  LayoutDashboard,
  Link2,
  Menu,
  MousePointer2,
  Sparkles,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  X,
  AlertTriangle,
  Copy,
  Activity,
} from "lucide-react";
import { useState } from "react";

const periods = {
  "7 dias": {
    spend: "R$ 420,80",
    grossRevenue: "R$ 1.680,00",
    fees: "R$ 168,00",
    netRevenue: "R$ 1.512,00",
    profit: "+ R$ 1.091,20",
    margin: "64.9%",
    roas: "3.99x",
    purchases: "16",
    uniqueBuyers: "14",
    views: "1.480",
    checkouts: "54",
  },
  "30 dias": {
    spend: "R$ 1.850,00",
    grossRevenue: "R$ 7.420,00",
    fees: "R$ 742,00",
    netRevenue: "R$ 6.678,00",
    profit: "+ R$ 4.828,00",
    margin: "65.1%",
    roas: "4.01x",
    purchases: "72",
    uniqueBuyers: "61",
    views: "6.240",
    checkouts: "248",
  },
};

export default function DemoPage() {
  const [period, setPeriod] = useState<keyof typeof periods>("7 dias");
  const [tab, setTab] = useState("Visão geral");
  const [menu, setMenu] = useState(false);
  const data = periods[period];
  const tabs = [
    "Visão geral",
    "Minhas ofertas",
    "Links e UTMs",
    "Campanhas",
    "Clonador de Funil",
    "Diagnóstico de Funil",
    "Integrações e Pixels",
    "Alertas",
  ];

  return (
    <main className="demo-page">
      <header className="demo-top">
        <Link href="/" className="brand">
          <Image
            src="/logo.png"
            alt="Kirofy Logo"
            width={32}
            height={32}
            className="brand-logo-img"
          />
          Kirofy
          <span className="brand-dot" />
        </Link>
        <span className="demo-label">
          <span className="demo-live-dot" /> AMBIENTE DE DEMONSTRAÇÃO COM DADOS FICTÍCIOS
        </span>
        <div className="demo-top-actions">
          <Link href="/login" className="button small primary">
            Criar meu workspace <ArrowRight size={14} />
          </Link>
          <button
            className="mobile-demo-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Abrir menu"
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <div className="demo-shell">
        <aside className={`demo-sidebar ${menu ? "open" : ""}`}>
          <div className="demo-side-title">SUA OPERAÇÃO</div>
          {tabs.map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => {
                setTab(item);
                setMenu(false);
              }}
            >
              {item === "Visão geral" ? (
                <LayoutDashboard />
              ) : item === "Minhas ofertas" ? (
                <ShoppingBag />
              ) : item === "Links e UTMs" ? (
                <Link2 />
              ) : item === "Campanhas" ? (
                <BarChart3 />
              ) : item === "Clonador de Funil" ? (
                <Copy />
              ) : item === "Diagnóstico de Funil" ? (
                <Activity />
              ) : item === "Integrações e Pixels" ? (
                <CircleDollarSign />
              ) : (
                <AlertTriangle />
              )}
              {item}
              {item === "Alertas" && (
                <span className="nav-count alert-count">1</span>
              )}
            </button>
          ))}
          <div className="demo-side-bottom">
            <strong>Gostou do que viu?</strong>
            <span>Conecte suas contas reais em menos de 3 minutos.</span>
            <Link href="/login" className="button primary">
              Começar agora <ArrowRight size={14} />
            </Link>
          </div>
        </aside>

        <section className="demo-content">
          <div className="demo-breadcrumb">
            Demo <span>/</span> <strong>{tab}</strong>
          </div>

          <div className="demo-heading">
            <div>
              <span className="eyebrow">CONTROLE NA MÃO. PAZ NO BOLSO.</span>
              <h1>
                {tab === "Visão geral"
                  ? "Sua operação, sem achismo."
                  : tab}
              </h1>
              <p>
                {tab === "Visão geral"
                  ? "Do clique à venda. Tudo o que importa em um só lugar."
                  : "Esta é uma prévia do que você poderá acompanhar no seu workspace real."}
              </p>
            </div>
            <Link href="/login" className="button primary">
              Criar link UTM <ArrowRight size={15} />
            </Link>
          </div>

          {tab === "Visão geral" ? (
            <>
              <div className="demo-toolbar">
                <div className="demo-selects">
                  <button
                    className={`demo-select ${period === "7 dias" ? "chosen" : ""}`}
                    onClick={() => setPeriod("7 dias")}
                  >
                    7 dias <ChevronDown size={15} />
                  </button>
                  <button
                    className={`demo-select ${period === "30 dias" ? "chosen" : ""}`}
                    onClick={() => setPeriod("30 dias")}
                  >
                    30 dias <ChevronDown size={15} />
                  </button>
                  <button className="demo-select">
                    Todas as ofertas <ChevronDown size={15} />
                  </button>
                </div>
                <span className="demo-currency">BRL · America/Sao_Paulo</span>
              </div>

              <div className="demo-metrics">
                <Metric
                  title="Investimento"
                  value={data.spend}
                  detail="Meta Ads no período"
                  tone="neutral"
                />
                <Metric
                  title="Receita Bruta"
                  value={data.grossRevenue}
                  detail={`${data.purchases} compras aprovadas`}
                  tone="neutral"
                />
                <Metric
                  title="Lucro Operacional"
                  value={data.profit}
                  detail={`Margem líquida de ${data.margin}`}
                  tone="positive"
                  indicator="up"
                />
                <Metric
                  title="ROAS Real"
                  value={data.roas}
                  detail="Retorno sobre investimento"
                  tone="positive"
                  indicator="up"
                />
              </div>

              <div className="demo-lower">
                <section className="demo-panel">
                  <div className="demo-panel-head">
                    <div>
                      <h2>Funil da operação</h2>
                      <p>Rastreamento ponta a ponta sem perda de dados.</p>
                    </div>
                    <span className="chip">Taxa de conversão saudável</span>
                  </div>
                  <div className="demo-funnel-row">
                    <span>1. Visitas (Landing)</span>
                    <b>{data.views}</b>
                    <i style={{ width: "100%" }} className="purple" />
                  </div>
                  <div className="demo-funnel-row">
                    <span>2. Cliques em CTA</span>
                    <b>342</b>
                    <i style={{ width: "42%" }} className="lavender" />
                  </div>
                  <div className="demo-funnel-row">
                    <span>3. Checkouts Iniciados</span>
                    <b>{data.checkouts}</b>
                    <i style={{ width: "22%" }} className="cyan" />
                  </div>
                  <div className="demo-funnel-row">
                    <span>4. Compras Aprovadas</span>
                    <b>{data.purchases}</b>
                    <i style={{ width: "11%" }} className="positive" />
                  </div>
                </section>

                <section className="demo-panel">
                  <div className="demo-panel-head">
                    <div>
                      <h2>Evolução diária</h2>
                      <p>Receita líquida (verde) vs Gasto Meta (roxo/cinza).</p>
                    </div>
                    <BarChart3 size={18} />
                  </div>
                  <div className="demo-chart">
                    <span className="chart-value">+ R$ 240,00</span>
                    {[28, 45, 38, 65, 52, 85, 62, 98, 70, 90, 78, 100].map(
                      (height, index) => (
                        <i key={index} style={{ height: `${height}%` }} />
                      ),
                    )}
                  </div>
                  <div className="chart-axis">
                    <span>Início do período</span>
                    <span>Hoje</span>
                  </div>
                </section>
              </div>

              <div className="demo-callout">
                <MousePointer2 size={18} />
                <div>
                  <strong>Quer enxergar seus números reais agora mesmo?</strong>
                  <p>
                    Conecte a Meta Ads e Hotmart/Cakto em menos de 3 minutos.
                  </p>
                </div>
                <Link href="/login">
                  Criar workspace <ArrowRight size={15} />
                </Link>
              </div>
            </>
          ) : (
            <div className="demo-placeholder">
              <Sparkles size={28} />
              <h2>{tab} no seu workspace</h2>
              <p>
                Na conta real, esta área mostra os dados, gráficos, integrações e
                ações reais da sua operação.
              </p>
              <Link href="/login" className="button primary">
                Criar workspace gratuito <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({
  title,
  value,
  detail,
  tone,
  indicator,
}: {
  title: string;
  value: string;
  detail: string;
  tone: "neutral" | "positive" | "negative";
  indicator?: "up" | "down";
}) {
  return (
    <article className={`demo-metric ${tone}`}>
      <div className="metric-header-row">
        <span>{title}</span>
        {indicator === "up" && <TrendingUp size={15} className="text-positive" />}
        {indicator === "down" && <TrendingDown size={15} className="text-negative" />}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
