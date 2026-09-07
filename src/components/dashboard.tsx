"use client";
import { plans, normalizePlan } from "@/lib/plans";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  LayoutDashboard,
  Link2,
  Layers,
  Plug,
  Plus,
  Copy,
  Check,
  Activity,
  Wallet,
  MousePointer2,
  ShoppingBag,
  BarChart3,
  Menu,
  X,
  LogOut,
  RefreshCw,
  Globe,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  Bell,
  AlertTriangle,
  Trash2,
  Tag,
  Percent,
  TrendingUp,
  TrendingDown,
  Download,
  Bot,
} from "lucide-react";
import { ActionForm, OfferForm, WorkspaceForm } from "./forms";
import {
  saveLink,
  toggleLink,
  savePaymentIntegration,
  cleanupTests,
  logout,
  savePixel,
  deletePixel,
  markAlertRead,
} from "@/app/actions";
import { buildLink, metaDefaults } from "@/lib/utm";
import { calculate, dayInZone } from "@/lib/metrics";
import type { AlertItem } from "@/lib/alerts";
import type {
  Workspace,
  Offer,
  LinkRow,
  Integration,
  SaleRow,
  InsightRow,
  Entity,
  WebhookLog,
  DashboardSummary,
  PixelRow,
  FunnelRow,
  DiagnosticRow,
} from "@/lib/types";
import { ClonadorView } from "./clonador";
import { DiagnosticoView } from "./diagnostico";
import { GraficoDiario } from "./grafico-diario";
import { OnboardingChecklist } from "./onboarding";
import { AssistenteTrackbase } from "./assistente";
import { BottomBar } from "./bottom-bar";
import { SalesNotifier } from "./sales-notifier";
import { exportSalesCsv, exportCampaignsCsv, exportLinksCsv } from "@/lib/export-csv";
type Props = {
  setup?: boolean;
  workspaces: Workspace[];
  workspace: Workspace | null;
  offers: Offer[];
  links: LinkRow[];
  integrations: Integration[];
  sales: SaleRow[];
  insights: InsightRow[];
  entities: Entity[];
  logs: WebhookLog[];
  pixels: PixelRow[];
  funnels?: FunnelRow[];
  diagnostics?: DiagnosticRow[];
  alerts: AlertItem[];
  summary?: DashboardSummary | null;
  initialTab?: string;
  appUrl: string;
  error?: string;
};
const tabs = [
  { id: "visao", name: "Visão geral", icon: LayoutDashboard },
  { id: "ofertas", name: "Minhas ofertas", icon: Layers },
  { id: "links", name: "Links e UTMs", icon: Link2 },
  { id: "campanhas", name: "Campanhas", icon: BarChart3 },
  { id: "clonador", name: "Clonador de Funil", icon: Copy },
  { id: "diagnostico", name: "Diagnóstico de Funil", icon: Activity },
  { id: "integracoes", name: "Integrações e Pixels", icon: Plug },
  { id: "assistente", name: "Assistente IA", icon: Bot },
  { id: "alertas", name: "Alertas", icon: Bell },
];
const titles: Record<string, [string, string]> = {
  visao: [
    "Sua operação, sem achismo.",
    "Do clique à venda. Tudo o que importa, em um só lugar.",
  ],
  ofertas: [
    "Cada oferta no seu lugar.",
    "Organize seus produtos e acompanhe cada operação.",
  ],
  links: [
    "O próximo clique tem endereço.",
    "Crie, organize e copie seus links de rastreamento.",
  ],
  campanhas: [
    "Encontre o que traz resultado.",
    "Campanhas, conjuntos e anúncios da sua conta Meta.",
  ],
  clonador: [
    "Clonador de Funil.",
    "Analise páginas autorizadas, edite blocos visuais e injete tracking com UTMs.",
  ],
  diagnostico: [
    "Diagnóstico de Funil.",
    "Identifique gargalos, perdas de tráfego e impacto financeiro nas suas ofertas.",
  ],
  integracoes: [
    "Conecte os pontos.",
    "Suas fontes de tráfego, vendas e Pixels/CAPI na mesma operação.",
  ],
  assistente: [
    "Assistente Trackbase IA.",
    "Seu copiloto de tráfego direto, métricas em tempo real e CRO.",
  ],
  alertas: [
    "Alertas inteligentes.",
    "Monitore gargalos de conversão, custos anormais e falhas de integração.",
  ],
};
function Clipboard({
  value,
  label = "Copiar",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState(false);
  return (
    <button
      type="button"
      className="button small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setError(true);
        }
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
      {error ? "Selecione e copie" : copied ? "Copiado" : label}
    </button>
  );
}
function Empty({
  icon: Icon = Activity,
  title,
  description,
  action,
}: {
  icon?: typeof Activity;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Dashboard(p: Props) {
  const router = useRouter(),
    [tab, setTab] = useState(
      tabs.some((t) => t.id === p.initialTab) ? p.initialTab! : "visao",
    ),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [period, setPeriod] = useState("7"),
    [currency, setCurrency] = useState("BRL"),
    [offer, setOffer] = useState("all"),
    [provider, setProvider] = useState("all"),
    [notice, setNotice] = useState(""),
    [showExportMenu, setShowExportMenu] = useState(false),
    [pending, start] = useTransition();
  const workspace = p.workspace?.id ?? "",
    timezone = p.workspace?.timezone ?? "America/Sao_Paulo";
  const today = dayInZone(new Date(), timezone),
    begin = new Date(`${today}T12:00:00Z`);
  begin.setUTCDate(begin.getUTCDate() - Number(period) + 1);
  const since = begin.toISOString().slice(0, 10);
  const sales = p.sales.filter(
    (s) =>
      !s.is_test &&
      dayInZone(new Date(s.occurred_at), timezone) >= since &&
      (offer === "all" || s.offer_id === offer) &&
      (provider === "all" || s.provider === provider),
  );
  const insights =
    offer === "all" && provider === "all"
      ? p.insights.filter((i) => i.day >= since)
      : [];

  const s = p.summary;
  const useSummary = Boolean(s && provider === "all");
  const fallback = calculate(sales, insights, currency);

  const grossRevenue = useSummary ? Number(s!.gross_revenue) : fallback.revenue;
  const platformFees = useSummary ? Number(s!.platform_fees || 0) : 0;
  const netRevenue = useSummary
    ? Number(s!.net_revenue || s!.gross_revenue)
    : fallback.revenue;
  const purchases = useSummary ? Number(s!.sales_count) : fallback.purchases;
  const uniqueBuyers = useSummary
    ? Number(s!.unique_buyers || s!.sales_count)
    : fallback.purchases;
  const spend = useSummary
    ? s!.meta_spend !== null
      ? Number(s!.meta_spend)
      : null
    : fallback.spend;
  const clicks = useSummary ? Number(s!.meta_clicks) : fallback.clicks;
  const impressions = useSummary
    ? Number(s!.meta_impressions)
    : fallback.impressions;
  const pageviews = useSummary ? Number(s!.pageviews) : 0;
  const ctas = useSummary ? Number(s!.ctas) : 0;
  const checkouts = useSummary ? Number(s!.checkouts) : 0;

  const operatingProfit = spend === null ? null : netRevenue - spend;
  const netMargin =
    operatingProfit !== null && grossRevenue > 0
      ? (operatingProfit / grossRevenue) * 100
      : null;
  const roas = spend && spend > 0 ? grossRevenue / spend : null;
  const roi = spend && spend > 0 ? ((netRevenue - spend) / spend) * 100 : null;
  const cpa = spend !== null && uniqueBuyers > 0 ? spend / uniqueBuyers : null;
  const averageTicket = purchases > 0 ? grossRevenue / purchases : null;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cpc = clicks > 0 && spend !== null ? spend / clicks : null;

  const refundedCount = useSummary
    ? Number(s!.refunded_count)
    : sales.filter((x) => ["refunded", "chargeback"].includes(x.status)).length;
  const refundedAmount = useSummary ? Number(s!.refunded_amount) : 0;
  const totalOrders = purchases + refundedCount;
  const refundRate =
    totalOrders > 0 ? (refundedCount / totalOrders) * 100 : null;

  const byProduct = s?.by_product_type || {};
  const byCountry = s?.by_country || {};

  const metrics = {
    revenue: grossRevenue,
    grossRevenue,
    platformFees,
    netRevenue,
    operatingProfit,
    netMargin,
    purchases,
    uniqueBuyers,
    spend,
    profit: operatingProfit,
    roas,
    roi,
    cpa,
    averageTicket,
    refundedCount,
    refundedAmount,
    refundRate,
    ctr,
    cpc,
    clicks,
    impressions,
    pageviews,
    ctas,
    checkouts,
    byProduct,
    byCountry,
  };

  const hasPayments = p.integrations.some(
    (i) => i.provider !== "meta" && i.status === "connected",
  );
  const money = (v: number | null) =>
    v === null
      ? "—"
      : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
          v,
        );

  const changePeriod = (val: string) => {
    setPeriod(val);
    router.replace(
      `/painel?${new URLSearchParams({
        ...(workspace ? { workspace } : {}),
        tab,
        period: val,
        currency,
        ...(offer !== "all" ? { offer } : {}),
      })}`,
      { scroll: false },
    );
  };

  const changeCurrency = (val: string) => {
    setCurrency(val);
    router.replace(
      `/painel?${new URLSearchParams({
        ...(workspace ? { workspace } : {}),
        tab,
        period,
        currency: val,
        ...(offer !== "all" ? { offer } : {}),
      })}`,
      { scroll: false },
    );
  };

  const changeOffer = (val: string) => {
    setOffer(val);
    router.replace(
      `/painel?${new URLSearchParams({
        ...(workspace ? { workspace } : {}),
        tab,
        period,
        currency,
        ...(val !== "all" ? { offer: val } : {}),
      })}`,
      { scroll: false },
    );
  };
  const selectTab = (value: string) => {
    setTab(value);
    setMobile(false);
    router.replace(
      `/painel?${new URLSearchParams({ ...(workspace ? { workspace } : {}), tab: value })}`,
      { scroll: false },
    );
  };
  const create = (type: string) => {
    if (p.setup) {
      setNotice("Conecte o ambiente ao Supabase para salvar dados.");
      return;
    }
    setModal(workspace ? type : "workspace");
  };
  const request = async (path: string, data: unknown) => {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const r = await response.json();
    if (!response.ok) throw new Error(r.error || "Não foi possível concluir.");
    return r;
  };
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        await fn();
        setNotice("Operação concluída.");
        router.refresh();
      } catch (e) {
        setNotice(
          e instanceof Error ? e.message : "Não foi possível concluir.",
        );
      }
    });
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Link href="/painel" className="brand">
          <Image
            src="/logo.png"
            alt="Trackbase Logo"
            width={32}
            height={32}
            className="brand-logo-img"
          />
          Trackbase
          <span className="brand-dot" />
        </Link>
        <button
          className="workspace-picker"
          onClick={() => create("workspace")}
        >
          <span className="workspace-avatar">
            {p.workspace?.name.slice(0, 1).toUpperCase() || "U"}
          </span>
          <span>
            <strong>{p.workspace?.name || "Sua operação"}</strong>
            <small>{workspace ? "Workspace" : "Comece por aqui"}</small>
          </span>
          <Plus size={16} />
        </button>
        {p.workspaces.length > 1 && (
          <select
            aria-label="Trocar workspace"
            value={workspace}
            onChange={(e) =>
              router.push(`/painel?workspace=${e.target.value}&tab=${tab}`)
            }
          >
            {p.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        <div className="nav-label">OPERAÇÃO</div>
        <nav>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => selectTab(t.id)}
            >
              <t.icon size={19} />
              {t.name}
              {t.id === "links" && p.links.length > 0 && (
                <span className="nav-count">{p.links.length}</span>
              )}
              {t.id === "alertas" &&
                p.alerts.filter((a) => !a.read).length > 0 && (
                  <span className="nav-count alert-count">
                    {p.alerts.filter((a) => !a.read).length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-box">
            <span className="plan-spark">✦</span>
            <strong>
              Menos custo.
              <br />
              Mais clareza.
            </strong>
            <p>Seu primeiro passo para uma operação que dá resultado.</p>
            <span className="tag">
              {plans[normalizePlan(p.workspace?.plan ?? "devedor")].name}
            </span>
          </div>
          <div className="sidebar-user">
            <span className="user-avatar">
              {p.workspace?.name.slice(0, 1) || "U"}
            </span>
            <span>
              <strong>{p.workspace?.name || "Bem-vindo"}</strong>
              <small>Powered by Trackbase</small>
            </span>
            {!p.setup && (
              <button
                className="icon-button"
                aria-label="Sair"
                onClick={() => logout()}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            onClick={() => setMobile(!mobile)}
            aria-label="Abrir menu"
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>{tabs.find((t) => t.id === tab)?.name}</strong>
          </div>
          <div className="topbar-right">
            <SalesNotifier workspaceId={workspace} />
            <span className="live-dot" />
            <span>
              {p.setup ? "Ambiente em configuração" : "Dados do seu workspace"}
            </span>
            <span className="top-avatar">U</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">CONTROLE NA MÃO. PAZ NO BOLSO.</div>
              <h1>{titles[tab][0]}</h1>
              <p>{titles[tab][1]}</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
                >
                  <Download size={15} /> Exportar CSV
                </button>
                {showExportMenu && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: "4px",
                      background: "#FFFFFF",
                      border: "1px solid var(--line, #E2E8F0)",
                      borderRadius: "8px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                      zIndex: 50,
                      minWidth: "180px",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        exportSalesCsv(p.sales);
                        setShowExportMenu(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "0.6rem 0.9rem",
                        background: "none",
                        border: "none",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        borderBottom: "1px solid #F1F5F9",
                      }}
                    >
                      📄 Vendas ({p.sales.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportCampaignsCsv(p.insights, p.entities);
                        setShowExportMenu(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "0.6rem 0.9rem",
                        background: "none",
                        border: "none",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        borderBottom: "1px solid #F1F5F9",
                      }}
                    >
                      📊 Campanhas Meta
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportLinksCsv(p.links, p.appUrl);
                        setShowExportMenu(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "0.6rem 0.9rem",
                        background: "none",
                        border: "none",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      🔗 Links UTM ({p.links.length})
                    </button>
                  </div>
                )}
              </div>
              <button
                className="button primary"
                onClick={() => create(tab === "ofertas" ? "offer" : "link")}
              >
                <Plus size={17} />
                {tab === "ofertas" ? "Nova oferta" : "Criar link UTM"}
              </button>
            </div>
          </div>
          {(notice || p.error) && (
            <div className="notice" role="status">
              {notice || p.error}
              <button
                aria-label="Fechar aviso"
                onClick={() => setNotice("")}
                className="icon-button"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {p.setup && (
            <div className="setup-banner">
              <ShieldCheck size={18} />
              <span>
                <strong>Seu painel está pronto para receber dados.</strong>{" "}
                Conecte o Supabase para criar sua conta e começar.
              </span>
              <Link href="/login">
                Configuração <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
          {!workspace && !p.setup && (
            <section className="panel onboarding">
              <div>
                <span className="tag">PRIMEIRO PASSO</span>
                <h2>Dê um nome à sua operação.</h2>
                <p>
                  Seu workspace reúne ofertas, links e integrações em um espaço
                  privado.
                </p>
              </div>
              <WorkspaceForm />
            </section>
          )}
          {tab === "visao" && (
            <>
              <OnboardingChecklist
                offersCount={p.offers.length}
                hasPaymentGateway={hasPayments}
                hasTrackerActivity={metrics.pageviews > 0 || ((p.funnels?.length ?? 0) > 0)}
                linksCount={p.links.length}
                hasMetaConnected={p.integrations.some((i) => i.provider === "meta" && i.status === "connected")}
                salesCount={p.sales.length}
                onNavigateTab={selectTab}
                onOpenCreateOffer={() => create("offer")}
              />
              <div className="filterbar">
                <div className="filter-group">
                  <SlidersHorizontal size={16} />
                  <select
                    aria-label="Período"
                    value={period}
                    onChange={(e) => changePeriod(e.target.value)}
                  >
                    <option value="1">Hoje</option>
                    <option value="7">Últimos 7 dias</option>
                    <option value="30">Últimos 30 dias</option>
                  </select>
                  <select
                    aria-label="Oferta"
                    value={offer}
                    onChange={(e) => changeOffer(e.target.value)}
                  >
                    <option value="all">Todas as ofertas</option>
                    {p.offers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Plataforma"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                  >
                    <option value="all">Todas as plataformas</option>
                    <option value="hotmart">Hotmart</option>
                    <option value="cakto">Cakto</option>
                  </select>
                </div>
                <div className="filter-group">
                  <Globe size={15} />
                  <select
                    aria-label="Moeda"
                    value={currency}
                    onChange={(e) => changeCurrency(e.target.value)}
                  >
                    {[
                      ...new Set([
                        "BRL",
                        "USD",
                        "EUR",
                        ...p.sales
                          .map((s) => s.currency)
                          .filter((s): s is string => !!s),
                        ...p.insights.map((s) => s.currency),
                      ]),
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <span className="timezone">{timezone}</span>
                </div>
              </div>

              <div className="metrics-grid">
                {[
                  {
                    name: "Investimento",
                    value:
                      offer !== "all" ? "Não atribuível" : money(metrics.spend),
                    hint:
                      offer !== "all"
                        ? "Gasto da conta Meta é global da operação"
                        : "Gasto na Meta Ads",
                    icon: Wallet,
                    tone: "neutral",
                  },
                  {
                    name: "Receita Bruta",
                    value: hasPayments ? money(metrics.grossRevenue) : "—",
                    hint: `${metrics.purchases} compras aprovadas · sem testes`,
                    icon: ShoppingBag,
                    tone: "neutral",
                  },
                  {
                    name: "Taxas da Plataforma",
                    value: hasPayments ? money(metrics.platformFees) : "—",
                    hint: "Taxas de processamento da Hotmart/Cakto",
                    icon: Tag,
                    tone: "neutral",
                  },
                  {
                    name: "Receita Líquida",
                    value: hasPayments ? money(metrics.netRevenue) : "—",
                    hint: "Receita após dedução de taxas da plataforma",
                    icon: Activity,
                    tone: "neutral",
                  },
                  {
                    name: "Lucro Operacional",
                    value:
                      hasPayments &&
                      offer === "all" &&
                      metrics.operatingProfit !== null
                        ? money(metrics.operatingProfit)
                        : "—",
                    hint:
                      offer !== "all"
                        ? "Mídia não isolada por oferta"
                        : "Receita líquida menos investimento em mídia",
                    icon: Wallet,
                    tone:
                      metrics.operatingProfit !== null
                        ? metrics.operatingProfit > 0
                          ? "positive"
                          : metrics.operatingProfit < 0
                            ? "negative"
                            : "neutral"
                        : "neutral",
                    indicator:
                      metrics.operatingProfit !== null &&
                      metrics.operatingProfit !== 0
                        ? metrics.operatingProfit > 0
                          ? "up"
                          : "down"
                        : undefined,
                  },
                  {
                    name: "Margem Líquida",
                    value:
                      hasPayments &&
                      offer === "all" &&
                      metrics.netMargin !== null
                        ? `${metrics.netMargin.toFixed(1)}%`
                        : "—",
                    hint: "Lucro operacional sobre receita bruta",
                    icon: Percent,
                    tone:
                      metrics.netMargin !== null
                        ? metrics.netMargin > 0
                          ? "positive"
                          : metrics.netMargin < 0
                            ? "negative"
                            : "neutral"
                        : "neutral",
                    indicator:
                      metrics.netMargin !== null && metrics.netMargin !== 0
                        ? metrics.netMargin > 0
                          ? "up"
                          : "down"
                        : undefined,
                  },
                  {
                    name: "ROAS / ROI",
                    value:
                      hasPayments && offer === "all" && metrics.roas !== null
                        ? `${metrics.roas.toFixed(2)}x · ${metrics.roi !== null ? metrics.roi.toFixed(0) + "%" : ""}`
                        : "—",
                    hint:
                      offer !== "all"
                        ? "Mídia não isolada por oferta"
                        : "Retorno sobre investimento em anúncios",
                    icon: ArrowUpRight,
                    tone:
                      metrics.roas !== null
                        ? metrics.roas >= 1.0
                          ? "positive"
                          : "negative"
                        : "neutral",
                    indicator:
                      metrics.roas !== null
                        ? metrics.roas >= 1.0
                          ? "up"
                          : "down"
                        : undefined,
                  },
                  {
                    name: "Clientes Únicos",
                    value: hasPayments
                      ? `${metrics.uniqueBuyers} clientes`
                      : "—",
                    hint:
                      metrics.purchases > metrics.uniqueBuyers
                        ? `${metrics.purchases - metrics.uniqueBuyers} compras adicionais (bumps/upsells)`
                        : `Ticket médio: ${money(metrics.averageTicket)}`,
                    icon: MousePointer2,
                    tone: "neutral",
                  },
                ].map((m) => (
                  <section
                    className={`metric-card tone-${m.tone}`}
                    key={m.name}
                  >
                    <div className="metric-label">
                      <span>{m.name}</span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {m.indicator === "up" && (
                          <TrendingUp size={16} className="text-positive" />
                        )}
                        {m.indicator === "down" && (
                          <TrendingDown size={16} className="text-negative" />
                        )}
                        <m.icon size={17} />
                      </div>
                    </div>
                    <strong
                      className={m.tone !== "neutral" ? `text-${m.tone}` : ""}
                    >
                      {m.value}
                    </strong>
                    <small>{m.hint}</small>
                  </section>
                ))}
              </div>

              <GraficoDiario
                sales={sales}
                insights={insights}
                periodDays={Number(period) || 7}
                timezone={timezone}
                currency={currency}
              />

              <div
                className="panel"
                style={{ marginTop: "1rem", marginBottom: "1rem" }}
              >
                <div className="panel-heading">
                  <div>
                    <h2>Funil da Operação</h2>
                    <p>
                      Visitas na página → Cliques em CTA → Checkouts iniciados →
                      Compras aprovadas
                    </p>
                  </div>
                  <span className="chip">Rastreamento ponta a ponta</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "0.75rem",
                    marginTop: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "var(--surface-subtle, #F9FAFB)",
                      border: "1px solid var(--line, #E5E7EB)",
                    }}
                  >
                    <small
                      style={{
                        color: "var(--muted, #64748B)",
                        display: "block",
                      }}
                    >
                      1. Visitas
                    </small>
                    <strong
                      style={{
                        fontSize: "1.35rem",
                        display: "block",
                        margin: "0.2rem 0",
                        color: "var(--ink, #0F172A)",
                      }}
                    >
                      {metrics.pageviews}
                    </strong>
                    <small style={{ color: "var(--muted, #64748B)" }}>
                      Pageviews
                    </small>
                  </div>
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "var(--surface-subtle, #F9FAFB)",
                      border: "1px solid var(--line, #E5E7EB)",
                    }}
                  >
                    <small
                      style={{
                        color: "var(--muted, #64748B)",
                        display: "block",
                      }}
                    >
                      2. Cliques em CTA
                    </small>
                    <strong
                      style={{
                        fontSize: "1.35rem",
                        display: "block",
                        margin: "0.2rem 0",
                        color: "var(--ink, #0F172A)",
                      }}
                    >
                      {metrics.ctas}
                    </strong>
                    <small style={{ color: "var(--muted, #64748B)" }}>
                      {metrics.pageviews > 0
                        ? `${((metrics.ctas / metrics.pageviews) * 100).toFixed(1)}% das visitas`
                        : "Sem visitas"}
                    </small>
                  </div>
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "var(--surface-subtle, #F9FAFB)",
                      border: "1px solid var(--line, #E5E7EB)",
                    }}
                  >
                    <small
                      style={{
                        color: "var(--muted, #64748B)",
                        display: "block",
                      }}
                    >
                      3. Checkouts
                    </small>
                    <strong
                      style={{
                        fontSize: "1.35rem",
                        display: "block",
                        margin: "0.2rem 0",
                        color: "var(--ink, #0F172A)",
                      }}
                    >
                      {metrics.checkouts}
                    </strong>
                    <small style={{ color: "var(--muted, #64748B)" }}>
                      {metrics.ctas > 0
                        ? `${((metrics.checkouts / metrics.ctas) * 100).toFixed(1)}% dos CTAs`
                        : "Sem CTAs"}
                    </small>
                  </div>
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "var(--surface-subtle, #F9FAFB)",
                      border: "1px solid var(--line, #E5E7EB)",
                    }}
                  >
                    <small
                      style={{
                        color: "var(--muted, #64748B)",
                        display: "block",
                      }}
                    >
                      4. Compras
                    </small>
                    <strong
                      style={{
                        fontSize: "1.35rem",
                        display: "block",
                        margin: "0.2rem 0",
                        color: "var(--ink, #0F172A)",
                      }}
                    >
                      {metrics.purchases}
                    </strong>
                    <small style={{ color: "var(--muted, #64748B)" }}>
                      {metrics.checkouts > 0
                        ? `${((metrics.purchases / metrics.checkouts) * 100).toFixed(1)}% conversão`
                        : "Aguardando"}
                    </small>
                  </div>
                </div>
              </div>
              <div className="dashboard-grid">
                <section className="panel performance">
                  <div className="panel-heading">
                    <div>
                      <h2>O ritmo da sua operação</h2>
                      <p>Investimento e faturamento ao longo do período</p>
                    </div>
                    <span className="chip">{currency}</span>
                  </div>
                  {!sales.length && !insights.length ? (
                    <div className="chart-empty">
                      <div className="chart-lines">
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                      <div className="chart-message">
                        <span className="empty-icon">
                          <BarChart3 size={24} />
                        </span>
                        <h3>Todo resultado começa com um clique.</h3>
                        <p>
                          Conecte suas integrações para acompanhar
                          <br />a evolução da sua operação aqui.
                        </p>
                        <button
                          className="text-button"
                          onClick={() => selectTab("integracoes")}
                        >
                          Conectar integrações <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="daily-chart">
                      {Array.from({ length: Number(period) }, (_, i) => {
                        const day = new Date(`${since}T12:00:00Z`);
                        day.setUTCDate(day.getUTCDate() + i);
                        const key = day.toISOString().slice(0, 10);
                        const revenue = sales
                          .filter(
                            (s) =>
                              s.status === "approved" &&
                              s.currency === currency &&
                              dayInZone(new Date(s.occurred_at), timezone) ===
                                key,
                          )
                          .reduce((a, s) => a + Number(s.amount), 0);
                        const spend = insights
                          .filter(
                            (s) => s.currency === currency && s.day === key,
                          )
                          .reduce((a, s) => a + Number(s.spend), 0);
                        const max = Math.max(
                          metrics.revenue,
                          metrics.spend ?? 0,
                          1,
                        );
                        return (
                          <div
                            className="day-bar"
                            key={key}
                            title={`${key}: faturamento ${money(revenue)} · gasto ${money(spend)}`}
                          >
                            <div className="bars">
                              <i
                                style={{
                                  height: `${Math.max((revenue / max) * 180, 2)}px`,
                                }}
                              />
                              <i
                                style={{
                                  height: `${Math.max((spend / max) * 180, 2)}px`,
                                }}
                              />
                            </div>
                            <small>{key.slice(8)}</small>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="chart-legend">
                    <span>
                      <i />
                      Faturamento
                    </span>
                    <span>
                      <i />
                      Investimento
                    </span>
                    <small>
                      {since.split("-").reverse().join("/")} —{" "}
                      {today.split("-").reverse().join("/")}
                    </small>
                  </div>
                </section>
                <section className="panel start-panel">
                  <span className="tag">SEU PRÓXIMO PASSO</span>
                  <h2>
                    Prepare o terreno.
                    <br />
                    Depois, acompanhe o retorno.
                  </h2>
                  <p>Três passos para tirar sua operação do escuro.</p>
                  {[
                    {
                      n: "01",
                      title: "Cadastre sua oferta",
                      sub: "O que você vai vender?",
                      done: p.offers.length > 0,
                      tab: "ofertas",
                    },
                    {
                      n: "02",
                      title: "Conecte suas integrações",
                      sub: "Una tráfego e vendas.",
                      done: p.integrations.some(
                        (i) => i.status === "connected",
                      ),
                      tab: "integracoes",
                    },
                    {
                      n: "03",
                      title: "Crie seu primeiro link",
                      sub: "Saiba de onde vem cada resultado.",
                      done: p.links.length > 0,
                      tab: "links",
                    },
                  ].map((s) => (
                    <button
                      className="onboarding-step"
                      key={s.n}
                      onClick={() => selectTab(s.tab)}
                    >
                      <span className={s.done ? "done" : ""}>
                        {s.done ? <Check size={16} /> : s.n}
                      </span>
                      <div>
                        <strong>{s.title}</strong>
                        <small>{s.sub}</small>
                      </div>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Ofertas em foco</h2>
                    <p>
                      Acompanhe o faturamento das suas ofertas em {currency}
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => selectTab("ofertas")}
                  >
                    Ver ofertas <ArrowRight size={15} />
                  </button>
                </div>
                {p.offers.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Oferta</th>
                          <th>Compras</th>
                          <th>Faturamento</th>
                          <th>Moeda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.offers.map((o) => {
                          const paid = sales.filter(
                            (s) =>
                              s.offer_id === o.id &&
                              s.status === "approved" &&
                              s.currency === currency,
                          );
                          return (
                            <tr key={o.id}>
                              <td>
                                <strong>{o.name}</strong>
                              </td>
                              <td>{paid.length}</td>
                              <td>
                                {money(
                                  paid.reduce(
                                    (n, s) => n + Number(s.amount),
                                    0,
                                  ),
                                )}
                              </td>
                              <td>{currency}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    icon={Layers}
                    title="Sua primeira oferta entra aqui."
                    description="Cadastre uma oferta para organizar links, tráfego e vendas."
                    action={
                      <button
                        className="button"
                        onClick={() => create("offer")}
                      >
                        <Plus size={15} /> Cadastrar oferta
                      </button>
                    }
                  />
                )}
              </section>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: "1.25rem",
                  marginTop: "1.25rem",
                  marginBottom: "1.25rem",
                }}
              >
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Desdobramento por Produto</h2>
                      <p>
                        Receita separada por produto principal, order bump,
                        upsell e downsell
                      </p>
                    </div>
                  </div>
                  {Object.keys(byProduct).length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Tipo de Produto</th>
                            <th>Vendas</th>
                            <th>Adesão / Conv.</th>
                            <th>Receita Bruta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(byProduct).map(([type, stats]) => {
                            const label =
                              type === "main"
                                ? "Produto Principal"
                                : type === "order_bump"
                                  ? "Order Bump"
                                  : type === "upsell"
                                    ? "Upsell"
                                    : type === "downsell"
                                      ? "Downsell"
                                      : type === "subscription"
                                        ? "Assinatura"
                                        : type === "complementary"
                                          ? "Complementar"
                                          : type === "alternative"
                                            ? "Alternativo"
                                            : type;
                            const mainCount = byProduct["main"]?.count || 0;
                            const rate =
                              type === "main"
                                ? "Base (100%)"
                                : mainCount > 0
                                  ? `${((stats.count / mainCount) * 100).toFixed(1)}%`
                                  : "—";
                            return (
                              <tr key={type}>
                                <td>
                                  <strong>{label}</strong>
                                </td>
                                <td>{stats.count}</td>
                                <td>
                                  <span className="chip">{rate}</span>
                                </td>
                                <td>{money(stats.revenue)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="Nenhum dado por tipo"
                      description="As vendas processadas aparecerão divididas por produto principal e adicionais."
                    />
                  )}
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Desdobramento por País</h2>
                      <p>Origem geográfica dos compradores com conversão</p>
                    </div>
                  </div>
                  {Object.keys(byCountry).length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>País</th>
                            <th>Vendas</th>
                            <th>Receita</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(byCountry).map(([code, stats]) => (
                            <tr key={code}>
                              <td>
                                <strong>{code.toUpperCase()}</strong>
                              </td>
                              <td>{stats.count}</td>
                              <td>{money(stats.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="Nenhum dado geográfico"
                      description="Conforme os pedidos chegarem via webhook, os países serão listados aqui."
                    />
                  )}
                </section>
              </div>

              <div className="footer-note">
                <ShieldCheck size={14} /> Dados isolados por workspace{" "}
                <span>•</span> Valores de moedas diferentes nunca são somados.
              </div>
            </>
          )}
          {tab === "ofertas" && (
            <>
              <div className="section-summary">
                <span>{p.offers.length} ofertas na operação</span>
                <span className="chip">Organização que dá resultado</span>
              </div>
              {p.offers.length ? (
                <div className="offer-grid">
                  {p.offers.map((o) => (
                    <section className="panel offer-card" key={o.id}>
                      <span className="empty-icon">
                        <Layers size={23} />
                      </span>
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                        <span className="chip">{o.currency}</span>
                        {o.product_type && (
                          <span className="chip">
                            {o.product_type === "main"
                              ? "Principal"
                              : o.product_type === "order_bump"
                                ? "Order Bump"
                                : o.product_type === "upsell"
                                  ? "Upsell"
                                  : o.product_type === "downsell"
                                    ? "Downsell"
                                    : o.product_type === "subscription"
                                      ? "Assinatura"
                                      : o.product_type === "complementary"
                                        ? "Complementar"
                                        : o.product_type === "alternative"
                                          ? "Alternativo"
                                          : o.product_type}
                          </span>
                        )}
                        {o.platform && (
                          <span className="chip" style={{ textTransform: "capitalize" }}>
                            {o.platform}
                          </span>
                        )}
                      </div>
                      <h2>{o.name}</h2>
                      <p className="url-text">{o.landing_url}</p>
                      {o.checkout_url && (
                        <p className="url-text" style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                          Checkout: {o.checkout_url}
                        </p>
                      )}
                      {(Number(o.percent_fee) > 0 || Number(o.fixed_fee) > 0 || Number(o.cost_per_sale) > 0) && (
                        <p style={{ fontSize: "0.75rem", color: "var(--muted, #64748B)", margin: "0.25rem 0" }}>
                          Taxas: {Number(o.percent_fee) > 0 ? `${o.percent_fee}% ` : ""}
                          {Number(o.fixed_fee) > 0 ? `+ ${money(o.fixed_fee ?? null)} fixa ` : ""}
                          {Number(o.cost_per_sale) > 0 ? `· Custo: ${money(o.cost_per_sale ?? null)}` : ""}
                        </p>
                      )}
                      {o.public_key && (
                        <div
                          style={{
                            marginTop: "0.75rem",
                            padding: "0.6rem",
                            background: "var(--surface-subtle, #F9FAFB)",
                            borderRadius: "6px",
                            border: "1px solid var(--line, #E5E7EB)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "0.3rem",
                            }}
                          >
                            <small
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--muted, #64748B)",
                              }}
                            >
                              Script da Página / Quiz:
                            </small>
                            <Clipboard
                              value={`<script src="${p.appUrl}/tracker.js" data-key="${o.public_key}"></script>`}
                              label="Copiar script"
                            />
                          </div>
                          <code
                            style={{
                              fontSize: "0.7rem",
                              wordBreak: "break-all",
                              display: "block",
                              color: "var(--brand-accent, #5B34EA)",
                            }}
                          >
                            {`<script src="${p.appUrl}/tracker.js" data-key="${o.public_key}"></script>`}
                          </code>
                        </div>
                      )}
                      <div className="offer-footer">
                        <span>
                          {p.links.filter((l) => l.offer_id === o.id).length}{" "}
                          links criados
                        </span>
                        <button
                          className="text-button"
                          onClick={() => create("link")}
                        >
                          Criar link <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    icon={Layers}
                    title="Qual é a sua próxima oferta?"
                    description="Cadastre a página e a moeda do produto para começar a rastrear."
                    action={
                      <button
                        className="button primary"
                        onClick={() => create("offer")}
                      >
                        Cadastrar primeira oferta <ArrowRight size={16} />
                      </button>
                    }
                  />
                </section>
              )}
            </>
          )}
          {tab === "links" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Seus links, sempre à mão</h2>
                  <p>
                    {p.links.length} links · parâmetros visíveis mesmo depois de
                    salvar
                  </p>
                </div>
                <Link2 size={22} />
              </div>
              {p.links.length ? (
                <div className="link-list">
                  {p.links.map((l) => {
                    const built = buildLink(l.url, l.params);
                    return (
                      <article key={l.id} className="saved-link">
                        <div className="saved-link-heading">
                          <h3>{l.name}</h3>
                          <span className={`chip ${l.active ? "green" : ""}`}>
                            {l.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <p>{p.offers.find((o) => o.id === l.offer_id)?.name}</p>
                        <label>
                          Link completo
                          <textarea readOnly value={built.full} />
                        </label>
                        <label>
                          Parâmetros de URL da Meta
                          <textarea readOnly value={built.parameters} />
                        </label>
                        {l.public_key && (
                          <div
                            style={{
                              marginTop: "0.5rem",
                              marginBottom: "0.75rem",
                              padding: "0.5rem",
                              background: "var(--surface-subtle, #F9FAFB)",
                              borderRadius: "6px",
                              border: "1px solid var(--line, #E5E7EB)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "0.25rem",
                              }}
                            >
                              <small
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--muted, #64748B)",
                                }}
                              >
                                Script individual deste link:
                              </small>
                              <Clipboard
                                value={`<script src="${p.appUrl}/tracker.js" data-key="${l.public_key}"></script>`}
                                label="Copiar script"
                              />
                            </div>
                            <code
                              style={{
                                fontSize: "0.7rem",
                                wordBreak: "break-all",
                                display: "block",
                                color: "var(--brand-accent, #5B34EA)",
                              }}
                            >
                              {`<script src="${p.appUrl}/tracker.js" data-key="${l.public_key}"></script>`}
                            </code>
                          </div>
                        )}
                        <div className="link-actions">
                          <Clipboard value={built.full} label="Copiar link" />
                          <Clipboard
                            value={built.parameters}
                            label="Copiar parâmetros"
                          />
                          <button
                            className="button small"
                            disabled={pending}
                            onClick={() =>
                              run(async () => {
                                const r = await saveLink(workspace, {
                                  name: `${l.name} (cópia)`,
                                  url: l.url,
                                  offer_id: l.offer_id,
                                  params: l.params,
                                });
                                if (r.error) throw new Error(r.error);
                              })
                            }
                          >
                            Duplicar
                          </button>
                          <button
                            className="text-button"
                            disabled={pending}
                            onClick={() =>
                              run(async () => {
                                const r = await toggleLink(
                                  workspace,
                                  l.id,
                                  !l.active,
                                );
                                if (r.error) throw new Error(r.error);
                              })
                            }
                          >
                            {l.active ? "Desativar" : "Ativar"}
                          </button>
                        </div>
                        <small>
                          O status organiza o histórico; links diretos já
                          distribuídos continuam acessíveis.
                        </small>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  icon={Link2}
                  title="Nenhum clique perdido no caminho."
                  description="Gere um link com macros dinâmicas da Meta e identifique sua origem."
                  action={
                    <button
                      className="button primary"
                      onClick={() => create("link")}
                    >
                      Criar primeiro link <Plus size={16} />
                    </button>
                  }
                />
              )}
            </section>
          )}
          {tab === "integracoes" && (
            <>
              <div className="integration-grid">
                {[
                  {
                    id: "meta",
                    name: "Meta Ads",
                    letter: "∞",
                    text: "Gasto, campanhas, conjuntos e anúncios. Tudo na moeda da sua conta.",
                    color: "blue",
                  },
                  {
                    id: "google",
                    name: "Google Ads",
                    letter: "G",
                    text: "Métricas de cliques, impressões e custo com sincronização segura.",
                    color: "red",
                  },
                  {
                    id: "hotmart",
                    name: "Hotmart",
                    letter: "H",
                    text: "Receba vendas, reembolsos e atualizações por webhook.",
                    color: "orange",
                  },
                  {
                    id: "kiwify",
                    name: "Kiwify",
                    letter: "K",
                    text: "Rastreie pedidos aprovados, bumps, upsells e reembolsos.",
                    color: "green",
                  },
                  {
                    id: "cakto",
                    name: "Cakto",
                    letter: "C",
                    text: "Conecte seus produtos e acompanhe os pedidos aprovados.",
                    color: "green",
                  },
                  {
                    id: "kirvano",
                    name: "Kirvano",
                    letter: "K",
                    text: "Vendas digitais, assinaturas e webhooks em tempo real.",
                    color: "purple",
                  },
                  {
                    id: "eduzz",
                    name: "Eduzz",
                    letter: "E",
                    text: "Vendas, faturas e contratos de produtos digitais e físicos.",
                    color: "orange",
                  },
                  {
                    id: "monetizze",
                    name: "Monetizze",
                    letter: "M",
                    text: "Produtos físicos e digitais com comissões e pós-venda.",
                    color: "blue",
                  },
                  {
                    id: "wiapy",
                    name: "Wiapy",
                    letter: "W",
                    text: "Plataforma de vendas com checkout de alta conversão.",
                    color: "purple",
                  },
                ].map((i) => (
                  <section className="panel integration-card" key={i.id}>
                    <div className={`provider-logo ${i.color}`}>{i.letter}</div>
                    <h2>{i.name}</h2>
                    <p>{i.text}</p>
                    <span className="chip">
                      {p.integrations.filter((c) => c.provider === i.id).length}{" "}
                      conexões
                    </span>
                    <button
                      className="button"
                      onClick={() => {
                        if (!workspace) {
                          create("workspace");
                          return;
                        }
                        if (i.id === "meta") {
                          window.location.assign(
                            `/api/meta/connect?workspace=${workspace}`,
                          );
                        } else if (i.id === "google") {
                          window.location.assign(
                            `/api/google/connect?workspace=${workspace}`,
                          );
                        } else setModal(i.id);
                      }}
                    >
                      Conectar {i.name} <ArrowUpRight size={15} />
                    </button>
                  </section>
                ))}
              </div>
              {p.integrations.map((i) => (
                <IntegrationCard
                  key={i.id}
                  integration={i}
                  workspace={workspace}
                  appUrl={p.appUrl}
                  run={run}
                  request={request}
                  pending={pending}
                />
              ))}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recebimentos de webhook</h2>
                    <p>
                      Últimos 50 eventos · registros inválidos não geram vendas
                    </p>
                  </div>
                </div>
                {p.logs.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Evento</th>
                          <th>Status</th>
                          <th>Recebido em</th>
                          <th>Detalhe</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {p.logs.map((l) => (
                          <tr key={l.id}>
                            <td>
                              {l.event_id.slice(0, 28)}
                              {l.is_test ? " · teste" : ""}
                            </td>
                            <td>
                              <span className="chip">{l.status}</span>
                            </td>
                            <td>
                              {new Date(l.received_at).toLocaleString("pt-BR", {
                                timeZone: timezone,
                              })}
                            </td>
                            <td>{l.reason || "—"}</td>
                            <td>
                              <button
                                className="text-button"
                                disabled={pending}
                                onClick={() =>
                                  run(() =>
                                    request("/api/webhooks/reprocess", {
                                      workspace,
                                      id: l.id,
                                    }),
                                  )
                                }
                              >
                                Reprocessar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Aguardando o primeiro evento"
                    description="Configure o endpoint no provedor. Cada recebimento aparecerá aqui."
                  />
                )}
              </section>
              {p.sales.some((s) => s.is_test) && (
                <button
                  className="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const r = await cleanupTests(workspace);
                      if (r.error) throw new Error(r.error);
                    })
                  }
                >
                  Remover somente vendas marcadas como teste
                </button>
              )}

              <section className="panel" style={{ marginTop: "1.5rem" }}>
                <div className="panel-heading">
                  <div>
                    <h2>Meta Pixel & Conversions API (CAPI)</h2>
                    <p>
                      Disparos server-side redundantes com deduplicação por
                      event_id
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: "1.5rem",
                    marginTop: "1rem",
                  }}
                >
                  <div>
                    <ActionForm
                      action={(f) => savePixel(workspace, f)}
                      label="Salvar Pixel / Token CAPI"
                      onSuccess={() => {}}
                    >
                      <label>
                        Pixel ID (Meta)
                        <input
                          name="pixel_id"
                          placeholder="Ex: 123456789012345"
                          required
                          pattern="^\d{8,25}$"
                        />
                      </label>
                      <label>
                        Oferta vinculada (opcional)
                        <select name="offer_id">
                          <option value="">
                            Global do workspace (todas as ofertas)
                          </option>
                          {p.offers.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Token de Acesso da Conversions API (CAPI)
                        <input
                          name="capi_token"
                          type="password"
                          placeholder="EAA..."
                          required
                          autoComplete="new-password"
                        />
                      </label>
                      <label>
                        Test Event Code (opcional para depuração no Gerenciador)
                        <input
                          name="test_event_code"
                          placeholder="Ex: TEST12345"
                        />
                      </label>
                      <p className="form-help">
                        O token CAPI é criptografado com AES-256 no banco e
                        nunca é exposto ao navegador.
                      </p>
                    </ActionForm>
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
                      Pixels Ativos
                    </h3>
                    {p.pixels && p.pixels.length > 0 ? (
                      <div style={{ display: "grid", gap: "0.75rem" }}>
                        {p.pixels.map((px) => {
                          const linkedOffer = p.offers.find(
                            (o) => o.id === px.offer_id,
                          );
                          return (
                            <div
                              key={px.id}
                              style={{
                                padding: "0.85rem 1rem",
                                borderRadius: "8px",
                                background: "var(--surface-subtle, #F9FAFB)",
                                border: "1px solid var(--line, #E5E7EB)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <strong
                                  style={{
                                    display: "block",
                                    fontSize: "0.95rem",
                                  }}
                                >
                                  Pixel: {px.pixel_id}
                                </strong>
                                <small
                                  style={{
                                    color: "var(--muted, #64748B)",
                                    display: "block",
                                  }}
                                >
                                  Escopo:{" "}
                                  {linkedOffer
                                    ? linkedOffer.name
                                    : "Global (Workspace)"}
                                </small>
                                {px.test_event_code && (
                                  <small
                                    style={{
                                      color: "var(--brand-accent, #5B34EA)",
                                      display: "block",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Teste ativo: {px.test_event_code}
                                  </small>
                                )}
                              </div>
                              <button
                                className="icon-button"
                                aria-label="Excluir Pixel"
                                disabled={pending}
                                onClick={() =>
                                  run(async () => {
                                    const res = await deletePixel(
                                      workspace,
                                      px.id,
                                    );
                                    if (res.error) throw new Error(res.error);
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty
                        title="Nenhum Pixel configurado"
                        description="Adicione seu Pixel e Token CAPI para rastreamento server-side à prova de bloqueadores."
                      />
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
          {tab === "campanhas" && (
            <Campaigns
              entities={p.entities}
              workspace={workspace}
              pending={pending}
              run={run}
              request={request}
              connect={() => selectTab("integracoes")}
            />
          )}
          {tab === "clonador" && (
            <ClonadorView
              workspace={workspace}
              funnels={p.funnels || []}
              offers={p.offers}
              appUrl={p.appUrl}
              run={run}
              pending={pending}
            />
          )}
          {tab === "diagnostico" && (
            <DiagnosticoView
              workspace={workspace}
              offers={p.offers}
              metrics={metrics}
              diagnostics={p.diagnostics || []}
              currency={currency}
              selectTab={selectTab}
            />
          )}
          {tab === "assistente" && (
            <AssistenteTrackbase
              metrics={metrics}
              currency={currency}
              offers={p.offers}
              links={p.links}
              insights={p.insights}
              entities={p.entities}
              diagnostics={p.diagnostics}
            />
          )}
          {tab === "alertas" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Alertas Inteligentes</h2>
                  <p>
                    Detecção de anomalias com volume mínimo de amostra e sem
                    falsos positivos
                  </p>
                </div>
                <span className="chip">
                  {p.alerts.filter((a) => !a.read).length} não lidos
                </span>
              </div>

              {p.alerts.length ? (
                <div
                  style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}
                >
                  {p.alerts.map((al) => {
                    const isCrit = al.severity === "critical";
                    const isWarn =
                      al.severity === "high" || al.severity === "medium";
                    const borderColor = isCrit
                      ? "var(--red-border, #FECACA)"
                      : isWarn
                        ? "var(--yellow-border, #FDE68A)"
                        : "var(--brand-border, #DDD6FE)";
                    const bgBadge = isCrit
                      ? "var(--red-soft, #FEF2F2)"
                      : isWarn
                        ? "var(--yellow-soft, #FEF3C7)"
                        : "var(--brand-soft, #F3F0FF)";
                    const textBadge = isCrit
                      ? "var(--red-text, #B91C1C)"
                      : isWarn
                        ? "var(--yellow-text, #B45309)"
                        : "var(--brand-text, #3B1E78)";

                    return (
                      <article
                        key={al.id}
                        style={{
                          padding: "1rem 1.25rem",
                          borderRadius: "10px",
                          background: al.read
                            ? "var(--surface-subtle, #F9FAFB)"
                            : "var(--surface, #FFFFFF)",
                          border: `1px solid ${borderColor}`,
                          boxShadow: "var(--shadow-sm)",
                          opacity: al.read ? 0.75 : 1,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "1rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "0.75rem",
                              alignItems: "flex-start",
                            }}
                          >
                            <AlertTriangle
                              size={20}
                              style={{
                                color: isCrit
                                  ? "var(--red, #EF3340)"
                                  : isWarn
                                    ? "var(--yellow, #F59E0B)"
                                    : "var(--brand-accent, #5B34EA)",
                                marginTop: "2px",
                                flexShrink: 0,
                              }}
                            />
                            <div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                }}
                              >
                                <strong
                                  style={{
                                    fontSize: "1rem",
                                    color: "var(--ink, #0F172A)",
                                  }}
                                >
                                  {al.title}
                                </strong>
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: bgBadge,
                                    color: textBadge,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    border: `1px solid ${borderColor}`,
                                  }}
                                >
                                  {al.severity}
                                </span>
                                {al.read && (
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "var(--muted, #64748B)",
                                    }}
                                  >
                                    (Lido)
                                  </span>
                                )}
                              </div>
                              <p
                                style={{
                                  margin: "0.35rem 0",
                                  color: "var(--ink-secondary, #334155)",
                                  fontSize: "0.9rem",
                                }}
                              >
                                {al.message}
                              </p>
                              {al.evidence &&
                                Object.keys(al.evidence).length > 0 && (
                                  <div
                                    style={{
                                      marginTop: "0.5rem",
                                      padding: "0.5rem 0.75rem",
                                      background:
                                        "var(--surface-muted, #F3F4F6)",
                                      border: "1px solid var(--line, #E5E7EB)",
                                      borderRadius: "6px",
                                      fontSize: "0.8rem",
                                      fontFamily: "monospace",
                                      color: "var(--ink-secondary, #334155)",
                                    }}
                                  >
                                    {Object.entries(al.evidence).map(
                                      ([k, v]) => (
                                        <span
                                          key={k}
                                          style={{ marginRight: "1rem" }}
                                        >
                                          {k}: <strong>{String(v)}</strong>
                                        </span>
                                      ),
                                    )}
                                  </div>
                                )}
                              <small
                                style={{
                                  color: "var(--muted, #64748B)",
                                  display: "block",
                                  marginTop: "0.4rem",
                                }}
                              >
                                Registrado em:{" "}
                                {new Date(al.created_at).toLocaleString(
                                  "pt-BR",
                                  { timeZone: timezone },
                                )}
                              </small>
                            </div>
                          </div>

                          {!al.read && (
                            <button
                              className="button small"
                              disabled={pending}
                              onClick={() =>
                                run(async () => {
                                  const r = await markAlertRead(
                                    workspace,
                                    al.id,
                                  );
                                  if (r.error) throw new Error(r.error);
                                })
                              }
                            >
                              Marcar como lido
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  icon={Bell}
                  title="Operação saudável"
                  description="Nenhuma anomalia crítica ou aviso pendente. Suas taxas e integrações estão dentro do esperado."
                />
              )}
            </section>
          )}
        </main>
      </div>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Cadastrar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Fechar"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            <span className="tag">UM PASSO A MAIS</span>
            <h2>
              {modal === "workspace"
                ? "Novo workspace"
                : modal === "offer"
                  ? "Cadastrar oferta"
                  : modal === "link"
                    ? "Criar link UTM"
                    : `Conectar ${
                        modal === "hotmart"
                          ? "Hotmart"
                          : modal === "kiwify"
                            ? "Kiwify"
                            : modal === "cakto"
                              ? "Cakto"
                              : modal === "kirvano"
                                ? "Kirvano"
                                : modal === "eduzz"
                                  ? "Eduzz"
                                  : modal === "monetizze"
                                    ? "Monetizze"
                                    : modal === "wiapy"
                                      ? "Wiapy"
                                      : modal
                      }`}
            </h2>
            {modal === "workspace" ? (
              <WorkspaceForm />
            ) : modal === "offer" ? (
              <OfferForm workspace={workspace} offers={p.offers} />
            ) : modal === "link" ? (
              p.offers.length ? (
                <LinkForm
                  offers={p.offers}
                  workspace={workspace}
                  done={() => setModal(null)}
                />
              ) : (
                <Empty
                  title="Comece por uma oferta"
                  description="Todo link precisa estar vinculado a uma oferta."
                  action={
                    <button
                      className="button primary"
                      onClick={() => setModal("offer")}
                    >
                      Cadastrar oferta
                    </button>
                  }
                />
              )
            ) : (
              <ActionForm
                action={(f) => savePaymentIntegration(workspace, f)}
                label="Salvar integração"
                onSuccess={() => setModal(null)}
              >
                <input type="hidden" name="provider" value={modal} />
                <label>
                  Oferta
                  <select name="offer_id" required>
                    {p.offers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ID do produto no provedor
                  <input
                    name="external_product_id"
                    placeholder="Ex.: 123456 ou código do produto"
                    required
                  />
                </label>
                <label>
                  Código da oferta no provedor (opcional)
                  <input name="external_offer_id" placeholder="Ex.: OF-01" />
                </label>
                <label>
                  Moeda quando o webhook não informar
                  <select name="currency">
                    <option>BRL</option>
                    <option>USD</option>
                    <option>EUR</option>
                    <option>MXN</option>
                    <option>COP</option>
                    <option>ARS</option>
                  </select>
                </label>
                <label>
                  {modal === "hotmart"
                    ? "Hottok da Hotmart"
                    : modal === "kiwify"
                      ? "Token / Assinatura do webhook Kiwify"
                      : modal === "cakto"
                        ? "Secret do webhook Cakto"
                        : modal === "kirvano"
                          ? "Token / Secret da Kirvano"
                          : modal === "eduzz"
                            ? "Chave secreta / API Key Eduzz"
                            : modal === "monetizze"
                              ? "Chave Única do webhook Monetizze"
                              : modal === "wiapy"
                                ? "Token de webhook Wiapy"
                                : "Secret / Token do webhook"}
                  <input
                    name="secret"
                    type="password"
                    autoComplete="new-password"
                    minLength={4}
                    required
                  />
                </label>
                <p className="form-help">
                  {modal === "hotmart" &&
                    "Copie o Hottok em Ferramentas > Webhook na Hotmart."}
                  {modal === "kiwify" &&
                    "Na Kiwify (Webhooks), gere uma URL e copie o token configurado."}
                  {modal === "cakto" &&
                    "Na Cakto (Webhooks), informe o segredo gerado no painel."}
                  {modal === "kirvano" &&
                    "Na Kirvano (Webhooks), copie o token de validação."}
                  {modal === "eduzz" &&
                    "Na Eduzz / Órbita, cadastre o webhook e cole sua chave de segurança."}
                  {modal === "monetizze" &&
                    "Na Monetizze (Ferramentas > Postback), informe sua Chave Única."}
                  {modal === "wiapy" &&
                    "Na Wiapy (Webhooks), insira a URL da Trackbase e o token gerado."}
                  O token será armazenado como hash seguro para autenticar cada webhook.
                </p>
              </ActionForm>
            )}
          </section>
        </div>
      )}
      <BottomBar currentTab={tab} onSelectTab={selectTab} />
    </div>
  );
}
function LinkForm({
  offers,
  workspace,
  done,
}: {
  offers: Offer[];
  workspace: string;
  done: () => void;
}) {
  const [offer, setOffer] = useState(offers[0].id),
    [url, setUrl] = useState(offers[0].landing_url),
    [params, setParams] = useState<Record<string, string>>({ ...metaDefaults }),
    [custom, setCustom] = useState("");
  let preview = { full: "", parameters: "" };
  try {
    preview = buildLink(url, params);
  } catch {}
  const names: Record<string, string> = {
    utm_source: "Origem",
    utm_medium: "Canal",
    utm_campaign: "Campanha",
    utm_term: "Conjunto",
    utm_content: "Anúncio",
    utm_creative: "Criativo",
    utm_country: "País",
    utm_placement: "Posicionamento",
    utm_variation: "Variação",
  };
  return (
    <ActionForm
      action={(f) =>
        saveLink(workspace, {
          name: f.get("name"),
          offer_id: offer,
          url,
          params,
        })
      }
      label="Salvar link"
      onSuccess={done}
    >
      <label>
        Nome do link
        <input
          name="name"
          placeholder="Ex.: Campanha de lançamento"
          required
          minLength={2}
        />
      </label>
      <label>
        Oferta
        <select
          value={offer}
          onChange={(e) => {
            setOffer(e.target.value);
            setUrl(offers.find((o) => o.id === e.target.value)!.landing_url);
          }}
        >
          {offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        URL da página
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <div className="fields-grid">
        {Object.entries(names).map(([key, name]) => (
          <label key={key}>
            {name}
            <input
              value={params[key] ?? ""}
              onChange={(e) => setParams({ ...params, [key]: e.target.value })}
              placeholder={key}
            />
          </label>
        ))}
      </div>
      <label>
        Campo customizado
        <div className="custom-field">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Ex.: utm_hook"
          />
          <button
            type="button"
            className="button"
            onClick={() => {
              if (/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(custom)) {
                setParams({ ...params, [custom]: "" });
                setCustom("");
              }
            }}
          >
            Adicionar
          </button>
        </div>
      </label>
      {Object.keys(params)
        .filter((k) => !names[k])
        .map((k) => (
          <label key={k}>
            {k}
            <input
              value={params[k]}
              onChange={(e) => setParams({ ...params, [k]: e.target.value })}
            />
          </label>
        ))}
      <div className="preview-box">
        <span className="tag">PRÉVIA DOS PARÂMETROS</span>
        <code>{preview.parameters || "Informe uma URL válida"}</code>
        <Clipboard value={preview.parameters} />
      </div>
    </ActionForm>
  );
}
function IntegrationCard({
  integration: i,
  workspace,
  appUrl,
  run,
  request,
  pending,
}: {
  integration: Integration;
  workspace: string;
  appUrl: string;
  run: (fn: () => Promise<unknown>) => void;
  request: (path: string, data: unknown) => Promise<unknown>;
  pending: boolean;
}) {
  const [accounts, setAccounts] = useState<
    { id: string; name: string; currency: string }[]
  >([]);
  return (
    <section className="panel connection-row">
      <div>
        <h3>{i.name}</h3>
        <p>
          {i.status === "connected"
            ? "Conectada"
            : i.status === "select_account"
              ? "Selecione a conta de anúncios"
              : "Aguardando primeiro evento"}{" "}
          · {i.currency || "Moeda pendente"}
        </p>
        {i.last_synced_at && (
          <small>
            Última sincronização:{" "}
            {new Date(i.last_synced_at).toLocaleString("pt-BR")}
          </small>
        )}
      </div>
      {i.provider === "meta" ? (
        <div className="connection-actions">
          {!i.account_id ? (
            <>
              <button
                className="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const r = await fetch(
                        `/api/meta/accounts?workspace=${workspace}&integration=${i.id}`,
                      ),
                      data = await r.json();
                    if (!r.ok) throw new Error(data.error);
                    setAccounts(data.accounts);
                  })
                }
              >
                Listar contas
              </button>
              {accounts.map((a) => (
                <button
                  className="button"
                  key={a.id}
                  onClick={() =>
                    run(() =>
                      request("/api/meta/accounts", {
                        workspace,
                        integration: i.id,
                        account: a.id,
                      }),
                    )
                  }
                >
                  {a.name} · {a.currency}
                </button>
              ))}
            </>
          ) : (
            <button
              className="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  request("/api/meta/sync", { workspace, integration: i.id }),
                )
              }
            >
              <RefreshCw size={15} /> Sincronizar 30 dias
            </button>
          )}
        </div>
      ) : i.provider === "google" ? (
        <div className="connection-actions">
          <button
            className="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                request("/api/google/sync", { workspace, integration: i.id }),
              )
            }
          >
            <RefreshCw size={15} /> Sincronizar Google Ads
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", width: "100%", maxWidth: "420px" }}>
          <div className="webhook-url">
            <input
              aria-label="Endpoint do webhook"
              readOnly
              value={`${appUrl}/api/webhooks/${i.provider}/${i.id}`}
            />
            <Clipboard value={`${appUrl}/api/webhooks/${i.provider}/${i.id}`} />
          </div>
          <small style={{ fontSize: "0.75rem", color: "var(--muted, #64748B)" }}>
            {i.provider === "hotmart" && "Configure em Ferramentas > Webhook na Hotmart com seu Hottok."}
            {i.provider === "kiwify" && "Configure em Configurações > Webhooks na Kiwify com o token salvo."}
            {i.provider === "cakto" && "Configure em Webhooks na Cakto com o secret configurado."}
            {i.provider === "kirvano" && "Configure em Configurações > Webhooks na Kirvano com seu token."}
            {i.provider === "eduzz" && "Configure em Ferramentas > Webhooks na Eduzz / Órbita."}
            {i.provider === "monetizze" && "Configure em Ferramentas > Postback na Monetizze com a Chave Única."}
            {i.provider === "wiapy" && "Configure na aba Webhooks da Wiapy com seu token de autenticação."}
          </small>
        </div>
      )}
    </section>
  );
}
function Campaigns({
  entities,
  workspace,
  pending,
  run,
  request,
  connect,
}: {
  entities: Entity[];
  workspace: string;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
  request: (path: string, data: unknown) => Promise<unknown>;
  connect: () => void;
}) {
  const [kind, setKind] = useState("campaign"),
    [search, setSearch] = useState("");
  const rows = entities.filter(
    (e) =>
      e.kind === kind &&
      e.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="segmented">
          {[
            ["campaign", "Campanhas"],
            ["adset", "Conjuntos"],
            ["ad", "Anúncios"],
          ].map(([k, n]) => (
            <button
              className={kind === k ? "selected" : ""}
              key={k}
              onClick={() => setKind(k)}
            >
              {n}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Buscar campanha"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pelo nome"
          />
        </label>
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>ID Meta</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.external_id}>
                  <td>
                    <strong>{e.name}</strong>
                  </td>
                  <td>{e.external_id}</td>
                  <td>
                    <span className="chip">{e.status}</span>
                  </td>
                  <td>
                    <button
                      className="button small"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          request("/api/meta/status", {
                            workspace,
                            integration: e.integration_id,
                            id: e.external_id,
                            status: e.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                          }),
                        )
                      }
                    >
                      {e.status === "ACTIVE" ? "Pausar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={MousePointer2}
          title={
            entities.length
              ? "Nenhum resultado neste filtro"
              : "Seus anúncios entram em cena aqui."
          }
          description="Conecte uma conta Meta e sincronize para ver campanhas, conjuntos e anúncios."
          action={
            <button className="button" onClick={connect}>
              Ir para integrações <ArrowRight size={15} />
            </button>
          }
        />
      )}
    </section>
  );
}
