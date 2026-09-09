"use client";
import { plans, canUse, normalizePlan } from "@/lib/plans";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { soundPlayer } from "@/lib/sound";
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
  BarChart3,
  Menu,
  X,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Bell,
  AlertTriangle,
  Trash2,
  Pencil,
  Download,
  Bot,
  Volume2,
  Building2,
  Landmark,
  Sun,
  Moon,
  Radio,
  BookOpen,
} from "lucide-react";
import { UtmifySummary } from "./utmify-summary";
import { ActionForm, OfferForm, WorkspaceDeleteForm, WorkspaceForm, WorkspaceRenameForm } from "./forms";
import { GatewayConnectForm } from "./gateway-connect-form";
import { GuideModal } from "./guide-modal";
import { LockedFeatureCard } from "./locked-feature-card";
import {
  saveLink,
  toggleLink,
  savePaymentIntegration,
  saveGatewayWebhookSecret,
  removeGatewayWebhookSecret,
  cleanupTests,
  logout,
  savePixel,
  deletePixel,
  markAlertRead,
  savePushSettings,
  sendTestPushAction,
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
  DiagnosticRow,
  ShieldRow,
  ShieldLogRow,
} from "@/lib/types";
import dynamic from "next/dynamic";
import { GraficoDiario } from "./grafico-diario";
import { OnboardingChecklist } from "./onboarding";
const AssistenteTrackbase = dynamic(() => import("./assistente").then((m) => m.AssistenteTrackbase), { ssr: false });
const DiagnosticoViewLazy = dynamic(() => import("./diagnostico").then((m) => m.DiagnosticoView), { ssr: false });
const ShieldView = dynamic(() => import("./shield-view").then((m) => m.ShieldView), { ssr: false });
const CampaignsView = dynamic(() => import("./campaigns-view").then((m) => m.CampaignsView), { ssr: false });
const LeadScrollVisualizer = dynamic(() => import("./lead-scroll-visualizer").then((m) => m.LeadScrollVisualizer), { ssr: false });
import { BottomBar } from "./bottom-bar";
import { SalesNotifier } from "./sales-notifier";
import { exportSalesCsv, exportCampaignsCsv, exportLinksCsv } from "@/lib/export-csv";
type Props = {
  isAdmin?: boolean;
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
  diagnostics?: DiagnosticRow[];
  alerts: AlertItem[];
  summary?: DashboardSummary | null;
  initialTab?: string;
  initialPeriod?: string;
  initialCurrency?: string;
  appUrl: string;
  error?: string;
  shields?: ShieldRow[];
  shieldLogs?: ShieldLogRow[];
};
const tabs = [
  { id: "visao", name: "Visão geral", icon: LayoutDashboard },
  { id: "ofertas", name: "Minhas ofertas", icon: Layers },
  { id: "links", name: "Links e UTMs", icon: Link2 },
  { id: "campanhas", name: "Campanhas", icon: BarChart3 },
  { id: "shield", name: "Shield (Anti-Spy)", icon: ShieldCheck },
  { id: "diagnostico", name: "Diagnóstico de Funil", icon: Activity },
  { id: "radar", name: "Radar de Leads", icon: Radio },
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
  diagnostico: [
    "Diagnóstico de Funil.",
    "Identifique gargalos, perdas de tráfego e impacto financeiro nas suas ofertas.",
  ],
  radar: [
    "Radar de Leads em Tempo Real.",
    "Acompanhe a sessão individual de cada lead no seu funil: origem do anúncio, rolagem (25%, 50%, 75%, 90%) e intenção de compra.",
  ],
  simulador: [
    "Radar de Leads em Tempo Real.",
    "Acompanhe a sessão individual de cada lead no seu funil: origem do anúncio, rolagem (25%, 50%, 75%, 90%) e intenção de compra.",
  ],
  integracoes: [
    "Conecte os pontos.",
    "Suas fontes de tráfego, plataformas de vendas e envio para o Facebook na mesma operação.",
  ],
  shield: [
    "Proteção de Ofertas (Anti-Clonagem & Anti-Espião).",
    "Carregamento ultra-rápido e entrega inteligente para proteger sua VSL de concorrentes.",
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
    [period, setPeriod] = useState(p.initialPeriod || "7"),
    [currency, setCurrency] = useState(p.initialCurrency || "BRL"),
    [offer, setOffer] = useState("all"),
    [provider, setProvider] = useState("all"),
    [notice, setNotice] = useState(""),
    [showExportMenu, setShowExportMenu] = useState(false),
    [guideModalOpen, setGuideModalOpen] = useState(false),
    [pending, start] = useTransition();

  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setCurrency(p.initialCurrency || "BRL");
  }, [p.initialCurrency]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("trackbase_theme") as "light" | "dark" | null;
      const initial = saved === "dark" ? "dark" : "light";
      setTheme(initial);
      document.documentElement.setAttribute("data-theme", initial);
    } catch {}
  }, []);

  // Success feedback should confirm the immediate action, not become stale
  // interface content in a section the user opens minutes later.
  useEffect(() => {
    if (notice !== "Operação concluída.") return;
    const timeout = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("trackbase_theme", next);
      document.documentElement.setAttribute("data-theme", next);
    } catch {}
  };
  const workspace = p.workspace?.id ?? "",
    timezone = p.workspace?.timezone ?? "America/Sao_Paulo";
  const today = dayInZone(new Date(), timezone);

  const currentPlan = normalizePlan(p.workspace?.plan || "devedor");
  const isFreePlan = currentPlan === "devedor";
  const hasShieldAccess = canUse(currentPlan, "shield");
  const hasRadarAccess = canUse(currentPlan, "radar");
  const hasDiagnosticoAccess = canUse(currentPlan, "diagnostico");

  let since: string;
  let until: string;

  if (period === "yesterday") {
    const yDate = new Date(`${today}T12:00:00Z`);
    yDate.setUTCDate(yDate.getUTCDate() - 1);
    const yStr = yDate.toISOString().slice(0, 10);
    since = yStr;
    until = yStr;
  } else if (period.includes("_")) {
    const [startDate, endDate] = period.split("_");
    since = startDate || today;
    until = endDate || today;
  } else {
    const periodDays = Number(period) || 7;
    const begin = new Date(`${today}T12:00:00Z`);
    begin.setUTCDate(begin.getUTCDate() - periodDays + 1);
    since = begin.toISOString().slice(0, 10);
    until = today;
  }

  const sales = p.sales.filter((s) => {
    if (s.is_test) return false;
    const sDay = dayInZone(new Date(s.occurred_at), timezone);
    return (
      sDay >= since &&
      sDay <= until &&
      (offer === "all" || s.offer_id === offer) &&
      (provider === "all" || s.provider === provider)
    );
  });

  const insights =
    offer === "all" && provider === "all"
      ? p.insights.filter((i) => i.day >= since && i.day <= until)
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
      : new Intl.NumberFormat(currency === "USD" ? "en-US" : "pt-BR", {
          style: "currency",
          currency,
        }).format(v);

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
        ...(provider !== "all" ? { provider } : {}),
      })}`,
      { scroll: false },
    );
  };

  const changeProvider = (val: string) => {
    setProvider(val);
    router.replace(
      `/painel?${new URLSearchParams({
        ...(workspace ? { workspace } : {}),
        tab,
        period,
        currency,
        ...(offer !== "all" ? { offer } : {}),
        ...(val !== "all" ? { provider: val } : {}),
      })}`,
      { scroll: false },
    );
  };
  const selectTab = (value: string) => {
    setTab(value);
    setMobile(false);
    setNotice("");
    setShowExportMenu(false);
    // A section is a new context, not a continuation of the previous scroll.
    // Reset before changing the URL so mobile and desktop behave identically.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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
    if (!response.ok) throw new Error(typeof r.error === "string" ? r.error : r.error?.message || "Não foi possível concluir.");
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
      {/* Overlay escuro de fundo no mobile ao abrir o menu */}
      {mobile && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobile(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="sidebar-header">
          <Link href="/painel" className="brand" onClick={() => setMobile(false)}>
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
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobile(false)}
            aria-label="Fechar menu lateral"
          >
            <X size={20} />
          </button>
        </div>
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
        {workspace && (
          <div className="workspace-quick-actions">
            <button type="button" className="workspace-action" onClick={() => create("workspace")}>
              <Plus size={14} /> Criar
            </button>
            <button type="button" className="workspace-action" onClick={() => setModal("workspace-rename")}>
              <Pencil size={14} /> Editar
            </button>
            <button type="button" className="workspace-action danger" onClick={() => setModal("workspace-delete")}>
              <Trash2 size={14} /> Excluir
            </button>
          </div>
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
              {isFreePlan && ["shield", "diagnostico", "radar"].includes(t.id) && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.68rem",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(91, 52, 234, 0.12)",
                    color: "var(--brand-accent, #5B34EA)",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                  }}
                >
                  PRO
                </span>
              )}
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
            <span className="sidebar-user-details">
              <strong>{p.workspace?.name || "Bem-vindo"}</strong>
              <small>Powered by Trackbase</small>
            </span>
            {!p.setup && (
              <form action={logout}>
                <button
                  type="submit"
                  className="icon-button logout-btn"
                  aria-label="Sair da conta"
                  title="Deslogar da Trackbase"
                >
                  <LogOut size={17} />
                </button>
              </form>
            )}
          </div>
          {!p.setup && (
            <form action={logout}>
              <button
                type="submit"
                className="button ghost small sidebar-logout-full"
              >
                <LogOut size={15} /> Desconectar da conta
              </button>
            </form>
          )}
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
            <span className="breadcrumb-prefix">Workspace</span> <span className="breadcrumb-sep">/</span>{" "}
            <strong>{tabs.find((t) => t.id === tab)?.name}</strong>
          </div>
          <div className="topbar-right">
            {p.isAdmin && (
              <Link href="/admin" className="button small admin-btn-topbar" title="Painel de Administração">
                <ShieldCheck size={16} /> <span className="admin-btn-label">Admin</span>
              </Link>
            )}
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === "dark" ? "Alternar para modo claro" : "Alternar para modo escuro"}
              aria-label="Alternar tema claro/escuro"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <SalesNotifier workspaceId={workspace} />
            <span className="live-dot" />
            <span className="topbar-status-text">
              {p.setup ? "Ambiente em configuração" : "Dados do seu workspace"}
            </span>
            <span className="top-avatar">U</span>
          </div>
        </header>
        <main id="dashboard-content" className={`${tab === "campanhas" ? "main-fluid" : ""} ${tab === "assistente" ? "main-assistente" : ""}`}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">CONTROLE NA MÃO. PAZ NO BOLSO.</div>
              <h1>{titles[tab][0]}</h1>
              <p>{titles[tab][1]}</p>
            </div>
            <div className="page-heading-actions">
              <div className="export-menu-wrap" style={{ position: "relative" }}>
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
                type="button"
                className="button ghost"
                onClick={() => setGuideModalOpen(true)}
                title="Guia Passo a Passo Oficial (Todas as Funções)"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  borderColor: "var(--line)",
                }}
              >
                <BookOpen size={16} color="var(--brand-accent)" />
                <span>Passo a Passo</span>
              </button>
              {tab === "ofertas" && (
                <button
                  className="button primary"
                  onClick={() => create("offer")}
                >
                  <Plus size={17} />
                  Nova oferta
                </button>
              )}
              {tab === "links" && (
                <button
                  className="button primary"
                  onClick={() => create("link")}
                >
                  <Plus size={17} />
                  Criar link UTM
                </button>
              )}
              {tab === "shield" && (
                <button
                  className="button primary"
                  onClick={() => {
                    const addBtn = document.querySelector('[data-shield-add]') as HTMLButtonElement | null;
                    if (addBtn) addBtn.click();
                    else setNotice("Clique em 'Configurar Novo Domínio' na seção do Shield.");
                  }}
                >
                  <Plus size={17} />
                  Novo Domínio Shield
                </button>
              )}
              {tab === "integracoes" && (
                <button
                  className="button primary"
                  onClick={() => {
                    const gatewaySection = document.getElementById("gateway-select-section");
                    if (gatewaySection) gatewaySection.scrollIntoView({ behavior: "smooth" });
                    else setModal("hotmart");
                  }}
                >
                  <Plus size={17} />
                  Conectar Gateway
                </button>
              )}
              {tab === "alertas" && (
                <button
                  className="button primary"
                  onClick={() => {
                    soundPlayer.play().catch(() => {});
                    setNotice("Som de alerta/notificação reproduzido!");
                  }}
                >
                  <Volume2 size={17} />
                  Testar Alerta Sonoro
                </button>
              )}
              {["visao", "campanhas"].includes(tab) && (
                <button
                  className="button primary"
                  onClick={() => create("link")}
                >
                  <Plus size={17} />
                  Criar link UTM
                </button>
              )}
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
                hasPaymentGateway={hasPayments}
                hasTrackerActivity={metrics.pageviews > 0}
                linksCount={p.links.length}
                hasMetaConnected={p.integrations.some((i) => i.provider === "meta" && i.status === "connected")}
                hasShieldConfigured={(p.shields?.length ?? 0) > 0}
                salesCount={p.sales.length}
                onNavigateTab={selectTab}
              />
              <UtmifySummary
                sales={sales}
                insights={insights}
                offers={p.offers}
                integrations={p.integrations}
                currency={currency}
                period={period}
                changePeriod={changePeriod}
                selectedOffer={offer}
                changeOffer={changeOffer}
                selectedProvider={provider}
                changeProvider={changeProvider}
                changeCurrency={changeCurrency}
                metrics={metrics}
                onRefresh={() => {
                  start(() => {
                    router.refresh();
                  });
                }}
                pending={pending}
              />

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
                      {p.integrations.some((integration) => integration.offer_id === o.id && integration.provider === "cakto" && integration.status !== "connected") && (
                        <div className="offer-activation">
                          <div>
                            <strong>Falta ativar as vendas</strong>
                            <span>Configure o webhook da Cakto para receber compras, reembolsos e chargebacks.</span>
                          </div>
                          <button className="button secondary" type="button" onClick={() => selectTab("integracoes")}>
                            Configurar webhook
                          </button>
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
                        <p style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--ink-secondary)" }}>
                          Oferta: <strong>{p.offers.find((o) => o.id === l.offer_id)?.name}</strong>
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <label>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: "12px", fontWeight: 700 }}>1. URL do site (Página de destino limpa para a Meta)</span>
                              <Clipboard value={l.url} label="Copiar URL do site" />
                            </div>
                            <input readOnly value={l.url} style={{ width: "100%" }} />
                          </label>
                          <label>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: "12px", fontWeight: 700 }}>2. Parâmetros de URL (Campo da Meta Ads)</span>
                              <Clipboard value={built.parameters} label="Copiar parâmetros" />
                            </div>
                            <textarea readOnly rows={2} value={built.parameters} style={{ width: "100%" }} />
                          </label>
                          <label>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-secondary)" }}>3. Link completo integrado (URL + Parâmetros juntos)</span>
                              <Clipboard value={built.full} label="Copiar link completo" />
                            </div>
                            <textarea readOnly rows={2} value={built.full} style={{ width: "100%", opacity: 0.9 }} />
                          </label>
                        </div>
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
                          <Clipboard value={l.url} label="Copiar URL" />
                          <Clipboard
                            value={built.parameters}
                            label="Copiar parâmetros"
                          />
                          <Clipboard value={built.full} label="Copiar link" />
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
                  {
                    id: "lowfy",
                    name: "Lowfy",
                    letter: "L",
                    text: "Checkout e pagamentos para infoprodutos e vendas digitais.",
                    color: "purple",
                  },
                  {
                    id: "greenn",
                    name: "Greenn",
                    letter: "G",
                    text: "Plataforma de infoprodutos, cursos e checkout de alta conversão.",
                    color: "green",
                  },
                  {
                    id: "stripe",
                    name: "Stripe",
                    letter: "S",
                    text: "Infraestrutura global de pagamentos em múltiplas moedas (USD, EUR, BRL).",
                    color: "blue",
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
                        } else if (["cakto", "kiwify", "hotmart"].includes(i.id) && p.integrations.some((connection) => connection.provider === i.id)) {
                          setModal(`${i.id}-add`);
                        } else setModal(i.id);
                      }}
                    >
                      {["cakto", "kiwify", "hotmart"].includes(i.id) && p.integrations.some((connection) => connection.provider === i.id)
                        ? "Adicionar outro produto"
                        : `Conectar ${i.name}`} <ArrowUpRight size={15} />
                    </button>
                  </section>
                ))}
              </div>
              {p.integrations.length > 0 && (
                <section className="connected-integrations-section" aria-labelledby="connected-integrations-title">
                  <div className="connected-integrations-heading">
                    <div>
                      <span className="eyebrow">SUAS CONEXÕES</span>
                      <h2 id="connected-integrations-title">Contas e gateways conectados</h2>
                    </div>
                    <span className="chip">{p.integrations.length} ativo{p.integrations.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="connected-integrations-grid">
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
                  </div>
                </section>
              )}
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
                    <h2>Envio Automático de Vendas para o Facebook (Pixel &amp; API)</h2>
                    <p>
                      Envia as compras aprovadas direto via servidor para o Facebook Ads, imune ao iOS 14+ e bloqueadores de anúncios
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
                      label="Conectar Envio ao Facebook"
                      onSuccess={() => {}}
                    >
                      <label>
                        ID do Pixel da Meta
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
                            Todas as ofertas deste workspace (Recomendado)
                          </option>
                          {p.offers.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Token de Acesso da Meta (Gerado no Gerenciador de Eventos)
                        <input
                          name="capi_token"
                          type="password"
                          placeholder="EAA..."
                          required
                          autoComplete="new-password"
                        />
                      </label>
                      <label>
                        Código de Teste da Meta (Opcional - para testar eventos ao vivo)
                        <input
                          name="test_event_code"
                          placeholder="Ex: TEST12345"
                        />
                      </label>
                      <p className="form-help">
                        🔒 Suas credenciais são criptografadas com segurança máxima e usadas exclusivamente para alimentar o algoritmo do Facebook com vendas reais.
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
                        title="Nenhum Pixel conectado"
                        description="Adicione seu Pixel e Token da Meta para que suas vendas sejam enviadas automaticamente ao Facebook Ads mesmo com o iOS 14+ e AdBlock."
                      />
                    )}
                  </div>
                </div>
              </section>

              <PushSettingsCard
                workspace={workspace}
                pushSettings={p.workspace?.push_settings}
                pending={pending}
                run={run}
              />
              <AccountPrivacyCard pending={pending} run={run} request={request} />
            </>
          )}
          {tab === "campanhas" && (
            <CampaignsView
              workspace={workspace}
              entities={p.entities}
              insights={insights}
              sales={sales}
              offers={p.offers}
              integrations={p.integrations}
              currency={currency}
              changeCurrency={changeCurrency}
              pending={pending}
              period={period}
              changePeriod={changePeriod}
              run={run}
              request={request}
              connect={() => selectTab("integracoes")}
            />
          )}
          {tab === "diagnostico" && (
            !hasDiagnosticoAccess ? (
              <LockedFeatureCard feature="diagnostico" />
            ) : (
              <DiagnosticoViewLazy
                workspace={workspace}
                offers={p.offers}
                metrics={metrics}
                hasCapi={p.pixels.some((pixel) => pixel.active)}
                diagnostics={p.diagnostics || []}
                currency={currency}
                selectTab={selectTab}
              />
            )
          )}
          {(tab === "radar" || tab === "simulador") && (
            !hasRadarAccess ? (
              <LockedFeatureCard feature="radar" />
            ) : (
              <LeadScrollVisualizer sales={p.sales} />
            )
          )}
          {tab === "assistente" && (
            <AssistenteTrackbase
              workspace={workspace}
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
            <>
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
            <PushSettingsCard
              workspace={workspace}
              pushSettings={p.workspace?.push_settings}
              pending={pending}
              run={run}
            />
          </>
          )}
          {tab === "shield" && (
            !hasShieldAccess ? (
              <LockedFeatureCard feature="shield" />
            ) : (
              <ShieldView
                workspaceId={workspace}
                offers={p.offers}
                shields={p.shields ?? []}
                logs={p.shieldLogs ?? []}
                appUrl={p.appUrl}
              />
            )
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
                : modal === "workspace-delete"
                  ? "Excluir workspace"
                  : modal === "workspace-rename"
                    ? "Renomear workspace"
                : modal === "offer"
                  ? "Cadastrar oferta"
                  : modal === "link"
                    ? "Criar link UTM"
                : modal === "cakto-add"
                  ? "Adicionar produto da Cakto"
                  : modal === "kiwify-add"
                    ? "Adicionar produto da Kiwify"
                    : modal === "hotmart-add"
                      ? "Adicionar produto da Hotmart"
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
                                        : modal === "lowfy"
                                          ? "Lowfy"
                                          : modal === "greenn"
                                            ? "Greenn"
                                            : modal === "stripe"
                                              ? "Stripe"
                                              : modal
                      }`}
            </h2>
            {modal === "workspace" ? (
              <WorkspaceForm />
            ) : modal === "workspace-rename" && p.workspace ? (
              <WorkspaceRenameForm workspace={workspace} name={p.workspace.name} defaultCurrency={p.workspace.default_currency} />
            ) : modal === "workspace-delete" && p.workspace ? (
              <WorkspaceDeleteForm workspace={workspace} name={p.workspace.name} />
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
            ) : ["hotmart", "kiwify", "cakto", "kirvano", "eduzz", "monetizze", "wiapy", "lowfy", "greenn"].includes(modal.replace("-add", "")) ? (
              <GatewayConnectForm
                workspace={workspace}
                provider={modal.replace("-add", "") as "cakto" | "kiwify" | "hotmart" | "kirvano" | "eduzz" | "monetizze" | "wiapy" | "lowfy" | "greenn"}
                offers={p.offers.map((offer) => ({ id: offer.id, name: offer.name }))}
                existingIntegrationId={
                  modal.endsWith("-add")
                    ? p.integrations.find(
                        (connection) => connection.provider === modal.replace("-add", ""),
                      )?.id
                    : undefined
                }
                appUrl={p.appUrl}
                onSuccess={() => {
                  setModal(null);
                  router.refresh();
                }}
              />
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
                                : modal === "lowfy"
                                  ? "Token / Secret de webhook Lowfy"
                                  : modal === "greenn"
                                    ? "Token de autenticação Greenn"
                                    : modal === "stripe"
                                      ? "Signing Secret Stripe (whsec_...) ou Token"
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
                  {modal === "lowfy" &&
                    "Na Lowfy (Webhooks), insira a URL do webhook gerada e o token de autenticação (ou defina uma chave segura)."}
                  {modal === "greenn" &&
                    "Na Greenn (Ferramentas > Webhooks), insira a URL da Trackbase e seu token de validação."}
                  {modal === "stripe" &&
                    "No Stripe Dashboard (Developers > Webhooks), adicione a URL e copie o Signing Secret (whsec_...) ou token de segurança."}
                  O token será armazenado como hash seguro para autenticar cada webhook.
                </p>
              </ActionForm>
            )}
          </section>
        </div>
      )}
      <BottomBar
        currentTab={tab}
        onSelectTab={selectTab}
        onOpenMenu={() => setMobile(true)}
        unreadAlertsCount={p.alerts.filter((a) => !a.read).length}
      />
      <GuideModal
        isOpen={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        onNavigateTab={selectTab}
      />
    </div>
  );
}
const UTM_CHANNEL_PRESETS: {
  id: string;
  name: string;
  badge: string;
  params: Record<string, string>;
}[] = [
  {
    id: "meta",
    name: "Meta Ads",
    badge: "Facebook & Instagram",
    params: {
      utm_source: "meta",
      utm_medium: "paid_social",
      utm_campaign: "{{campaign.id}}",
      utm_term: "{{adset.id}}",
      utm_content: "{{ad.id}}",
    },
  },
  {
    id: "google",
    name: "Google Ads",
    badge: "Pesquisa & Display",
    params: {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "{campaignid}",
      utm_term: "{keyword}",
      utm_content: "{creative}",
    },
  },
  {
    id: "tiktok",
    name: "TikTok Ads",
    badge: "TikTok",
    params: {
      utm_source: "tiktok",
      utm_medium: "paid_social",
      utm_campaign: "__CAMPAIGN_ID__",
      utm_term: "__AID__",
      utm_content: "__CID__",
    },
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    badge: "Mensagens & Chat",
    params: {
      utm_source: "whatsapp",
      utm_medium: "social",
      utm_campaign: "direto",
      utm_content: "chat",
    },
  },
  {
    id: "bio",
    name: "Bio & Redes",
    badge: "Orgânico / Perfil",
    params: {
      utm_source: "instagram",
      utm_medium: "social_bio",
      utm_campaign: "bio",
      utm_content: "perfil",
    },
  },
];

function LinkForm({
  offers,
  workspace,
  done,
}: {
  offers: Offer[];
  workspace: string;
  done: () => void;
}) {
  const [selectedChannel, setSelectedChannel] = useState("meta");
  const [offer, setOffer] = useState(offers[0]?.id || "");
  const selectedOffer = offers.find((o) => o.id === offer) || offers[0];
  const [url, setUrl] = useState(selectedOffer?.landing_url || "");
  const [name, setName] = useState(
    selectedOffer ? `Meta Ads - ${selectedOffer.name}` : "Meta Ads",
  );
  const [params, setParams] = useState<Record<string, string>>({
    ...metaDefaults,
  });
  const [custom, setCustom] = useState("");

  function handleSelectChannel(preset: (typeof UTM_CHANNEL_PRESETS)[0]) {
    setSelectedChannel(preset.id);
    setParams({ ...preset.params });
    if (selectedOffer) {
      setName(`${preset.name} - ${selectedOffer.name}`);
    }
  }

  let preview = { full: "", parameters: "" };
  try {
    preview = buildLink(url, params);
  } catch {}

  const names: Record<string, string> = {
    utm_source: "Origem (utm_source)",
    utm_medium: "Canal / Meio (utm_medium)",
    utm_campaign: "Campanha (utm_campaign)",
    utm_term: "Conjunto / Termo (utm_term)",
    utm_content: "Anúncio / Conteúdo (utm_content)",
    utm_creative: "Criativo (utm_creative)",
    utm_country: "País (utm_country)",
    utm_placement: "Posicionamento (utm_placement)",
    utm_variation: "Variação (utm_variation)",
  };

  return (
    <ActionForm
      action={(f) =>
        saveLink(workspace, {
          name: f.get("name") || name,
          offer_id: offer,
          url,
          params,
        })
      }
      label="Criar e Salvar Link"
      onSuccess={done}
    >
      <div className="utm-presets-container">
        <label style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
          1. Escolha a Plataforma (1 clique)
        </label>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-secondary)" }}>
          Os parâmetros oficiais são configurados automaticamente sem complicação.
        </p>
        <div className="utm-preset-grid">
          {UTM_CHANNEL_PRESETS.map((p) => {
            const isActive = selectedChannel === p.id;
            return (
              <button
                type="button"
                key={p.id}
                className={`utm-preset-btn ${isActive ? "active" : ""}`}
                onClick={() => handleSelectChannel(p)}
              >
                <div className="utm-preset-title">
                  {p.id === "meta" && "🔵"}
                  {p.id === "google" && "🔴"}
                  {p.id === "tiktok" && "⚫"}
                  {p.id === "whatsapp" && "🟢"}
                  {p.id === "bio" && "🟣"}
                  {p.name}
                </div>
                <div className="utm-preset-subtitle">{p.badge}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>
          Oferta de destino
          <select
            value={offer}
            onChange={(e) => {
              const newId = e.target.value;
              setOffer(newId);
              const found = offers.find((o) => o.id === newId);
              if (found) {
                setUrl(found.landing_url);
                const currentPreset = UTM_CHANNEL_PRESETS.find(
                  (p) => p.id === selectedChannel,
                );
                setName(`${currentPreset?.name || "Link"} - ${found.name}`);
              }
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
          Nome do link
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Meta Ads - Minha Oferta"
            required
            minLength={2}
          />
        </label>
      </div>

      <label>
        URL da página (onde o cliente cai)
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://seu-dominio.com/pagina"
        />
      </label>

      <div className="utm-link-preview-box">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <span
            className="tag"
            style={{ margin: 0, background: "#0284C7", color: "#FFFFFF" }}
          >
            {selectedChannel === "meta"
              ? "FORMATO OFICIAL META ADS"
              : "CAMPOS PARA RASTREAMENTO"}
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-secondary)" }}>
            Cole cada campo no Gerenciador de Anúncios
          </span>
        </div>

        <div className="utm-split-card">
          <div className="utm-split-item">
            <div className="utm-split-header">
              <span className="utm-split-title">
                1. Campo &quot;URL do site&quot; na Meta:
              </span>
              <Clipboard value={url} label="Copiar URL" />
            </div>
            <code>{url || "Informe a URL da página acima"}</code>
          </div>

          <div className="utm-split-item">
            <div className="utm-split-header">
              <span className="utm-split-title">
                2. Campo &quot;Parâmetros de URL&quot; na Meta:
              </span>
              <Clipboard value={preview.parameters} label="Copiar parâmetros" />
            </div>
            <code>{preview.parameters || "Nenhum parâmetro gerado"}</code>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--line, #E2E8F0)",
              paddingTop: 8,
              marginTop: 4,
            }}
          >
            <div className="utm-split-header" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--ink-secondary)" }}>
                Ou Link completo integrado (para WhatsApp, Bio ou outros canais):
              </span>
              <Clipboard value={preview.full} label="Copiar link completo" />
            </div>
            <code style={{ fontSize: 11, opacity: 0.85 }}>
              {preview.full || "Informe uma URL válida"}
            </code>
          </div>
        </div>
      </div>

      <details className="utm-advanced-details">
        <summary>⚙️ Ajustar parâmetros UTM manualmente (opcional)</summary>
        <p
          style={{
            fontSize: 11,
            color: "var(--ink-secondary)",
            margin: "8px 0 12px",
          }}
        >
          Campos preenchidos automaticamente. Modifique apenas se quiser usar parâmetros personalizados.
        </p>
        <div className="fields-grid">
          {Object.entries(names).map(([key, labelText]) => (
            <label key={key}>
              {labelText}
              <input
                value={params[key] ?? ""}
                onChange={(e) =>
                  setParams({ ...params, [key]: e.target.value })
                }
                placeholder={key}
              />
            </label>
          ))}
        </div>
        <label style={{ marginTop: 10 }}>
          Adicionar campo customizado
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
      </details>
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
  type MetaAccount = {
    id: string;
    name: string;
    currency: string;
    timezone_name: string;
    origins: Array<{
      type: "direct" | "business";
      businessId?: string;
      businessName?: string;
    }>;
  };
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [editingWebhookSecret, setEditingWebhookSecret] = useState(false);
  const statusText: Record<string, string> = {
    connected: "Conta conectada",
    select_account: "OAuth conectado · selecione uma conta de anúncios",
    syncing: "Sincronizando campanhas, conjuntos, anúncios e insights",
    token_expired: "Token Meta expirado · conecte novamente",
    permission_insufficient: "Permissão Meta insuficiente · conecte novamente",
  };
  return (
    <section className="panel connection-row">
      <div>
        <h3>{i.name}</h3>
        <p>
          {statusText[i.status] || "Aguardando configuração"}{" "}
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
                    if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "Não foi possível listar contas.");
                    setAccounts(data.accounts);
                    setBusinesses(data.businesses || []);
                    setAccountsLoaded(true);
                  })
                }
              >
                <Landmark size={15} /> Carregar contas
              </button>
              {accountsLoaded && businesses.length > 0 && (
                <div className="meta-business-summary">
                  <span><Building2 size={15} /> Business Managers com acesso</span>
                  <div>
                    {businesses.map((business) => (
                      <span className="meta-business-chip" key={business.id}>
                        {business.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {accounts.length > 0 && (
                <div className="meta-account-picker" aria-label="Contas Meta disponíveis">
                  <div className="meta-account-picker-heading">
                    <div>
                      <strong>Escolha a conta para sincronizar</strong>
                      <small>{accounts.length} conta{accounts.length === 1 ? "" : "s"} encontrada{accounts.length === 1 ? "" : "s"}</small>
                    </div>
                  </div>
                  <div className="meta-account-list">
                    {accounts.map((a) => (
                      <button
                        className="meta-account-card"
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
                        <span className="meta-account-card-label">CONTA DE ANÚNCIOS</span>
                        <strong>{a.name}</strong>
                        <span className="meta-account-meta">
                          <code>{a.id}</code>
                          <span>{a.currency}</span>
                          <span>{a.timezone_name}</span>
                        </span>
                        <span className="meta-account-sources">
                          {a.origins.map((origin, index) => (
                            <span key={`${origin.type}-${origin.businessId || index}`}>
                              {origin.type === "direct"
                                ? "Acesso direto"
                                : origin.businessName || "Business Manager"}
                            </span>
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {accountsLoaded && accounts.length === 0 && (
                <div className="meta-accounts-empty">
                  <AlertTriangle size={16} />
                  Nenhuma conta de anúncios foi encontrada para este token.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="meta-selected-account">
                <div className="meta-selected-account-head">
                  <span>CONTA SELECIONADA</span>
                  <button
                    className="meta-disconnect-button"
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Desconectar esta conta Meta? O token e os dados sincronizados desta conta serão removidos. As outras integrações não serão afetadas.")) return;
                      run(async () => {
                        const response = await fetch(`/api/meta/accounts?workspace=${encodeURIComponent(workspace)}&integration=${encodeURIComponent(i.id)}`, { method: "DELETE" });
                        const data = await response.json().catch(() => null);
                        if (!response.ok) throw new Error(data?.error || "Não foi possível desconectar a conta Meta.");
                      });
                    }}
                    title="Desconectar esta conta Meta"
                  >
                    <Trash2 size={13} /> Desconectar
                  </button>
                </div>
                <strong>{i.name}</strong>
                <small>{i.account_id} · {i.currency || "Moeda indisponível"}</small>
              </div>
              <button
                className="button"
                disabled={pending || i.status === "syncing"}
                onClick={() =>
                  run(() =>
                    request("/api/meta/sync", { workspace, integration: i.id }),
                  )
                }
              >
                <RefreshCw size={15} /> {i.status === "syncing" ? "Sincronizando…" : "Sincronizar 30 dias"}
              </button>
            </>
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
        <div className="gateway-connection-details">
          {["cakto", "kiwify", "hotmart", "kirvano", "eduzz", "monetizze", "wiapy", "lowfy", "greenn"].includes(i.provider) && i.status === "connected" && !editingWebhookSecret ? (
            <div className="gateway-saved-state">
              <span className="gateway-saved-badge">WEBHOOK ATIVO</span>
              <strong>Webhook salvo para {i.name.replace(/^[A-Z]+\s*·\s*/i, "")}</strong>
              <span>As vendas deste produto serão recebidas pela Trackbase.</span>
              <div className="gateway-saved-actions">
                <button className="button secondary" type="button" onClick={() => setEditingWebhookSecret(true)}>
                  Editar {i.provider === "hotmart" ? "Hottok" : i.provider === "kiwify" ? "token" : "secret"}
                </button>
                <button
                  className="text-button danger"
                  type="button"
                  onClick={() => {
                    if (window.confirm("Remover o webhook desta integração? As vendas deixarão de ser recebidas até você configurar novamente.")) {
                      run(() => removeGatewayWebhookSecret(workspace, i.id));
                    }
                  }}
                >
                  Remover webhook
                </button>
              </div>
            </div>
          ) : ["cakto", "kiwify", "hotmart"].includes(i.provider) ? (
            <div className="gateway-connection-guide">
              <span className="gateway-next-step-kicker">ÚLTIMO PASSO</span>
              <strong>
                {editingWebhookSecret
                  ? `Atualize o ${i.provider === "hotmart" ? "Hottok / token" : i.provider === "kiwify" ? "token" : "secret"} do webhook`
                  : "Ative o recebimento das vendas"}
              </strong>
              <span>
                {i.provider === "cakto" && "Na Cakto, crie um webhook para esta URL, selecione o produto e marque Compra aprovada, Reembolso e Chargeback."}
                {i.provider === "kiwify" && "Na Kiwify, crie um webhook para esta URL, selecione o produto e marque Pedido aprovado, Reembolso e Chargeback."}
                {i.provider === "hotmart" && "Na Hotmart, acesse Ferramentas > Webhook, crie um webhook para esta URL e marque Compra aprovada, Reembolso e Disputa."}
              </span>
              <a
                href={
                  i.provider === "cakto"
                    ? "https://app.cakto.com.br/dashboard/webhooks"
                    : i.provider === "kiwify"
                      ? "https://dashboard.kiwify.com.br/webhooks"
                      : "https://app-vlc.hotmart.com/tools/webhook"
                }
                target="_blank"
                rel="noreferrer"
              >
                Abrir Webhooks na {i.provider === "cakto" ? "Cakto" : i.provider === "kiwify" ? "Kiwify" : "Hotmart"} ↗
              </a>
            </div>
          ) : null}
          <div className="webhook-url">
            <input
              aria-label="Endpoint do webhook"
              readOnly
              value={`${appUrl}/api/webhooks/${i.provider}/${i.id}`}
            />
            <Clipboard value={`${appUrl}/api/webhooks/${i.provider}/${i.id}`} />
          </div>
          <small style={{ fontSize: "0.75rem", color: "var(--muted, #64748B)" }}>
            {i.provider === "hotmart" && (i.status === "connected" && !editingWebhookSecret ? "URL ativa para este produto." : editingWebhookSecret ? "Cole o novo Hottok / token gerado pela Hotmart." : "Depois de salvar o webhook na Hotmart, cole aqui o Hottok.")}
            {i.provider === "kiwify" && (i.status === "connected" && !editingWebhookSecret ? "URL ativa para este produto." : editingWebhookSecret ? "Cole o novo token / assinatura gerado pela Kiwify." : "Depois de salvar o webhook na Kiwify, cole aqui o token gerado.")}
            {i.provider === "cakto" && (i.status === "connected" && !editingWebhookSecret ? "URL ativa para este produto." : editingWebhookSecret ? "Cole o novo secret gerado pela Cakto." : "Depois de salvar o webhook na Cakto, cole aqui o secret gerado.")}
            {i.provider === "kirvano" && "Configure em Configurações > Webhooks na Kirvano com seu token."}
            {i.provider === "eduzz" && "Configure em Ferramentas > Webhooks na Eduzz / Órbita."}
            {i.provider === "monetizze" && "Configure em Ferramentas > Postback na Monetizze com a Chave Única."}
            {i.provider === "wiapy" && "Configure na aba Webhooks da Wiapy com seu token de autenticação."}
            {i.provider === "lowfy" && "Configure na área de Webhooks da Lowfy com o token cadastrado."}
            {i.provider === "greenn" && "Configure em Ferramentas > Webhooks na Greenn com seu token de autenticação."}
            {i.provider === "stripe" && "Configure em Developers > Webhooks no Stripe com o Signing Secret (whsec_...) ou token."}
          </small>
          {["cakto", "kiwify", "hotmart", "kirvano", "eduzz", "monetizze", "wiapy", "lowfy", "greenn"].includes(i.provider) && (i.status !== "connected" || editingWebhookSecret) && (
            <form
              className="gateway-secret-form"
              onSubmit={(event) => {
                event.preventDefault();
                const secret = new FormData(event.currentTarget).get("secret");
                run(async () => {
                  const result = await saveGatewayWebhookSecret(workspace, i.id, String(secret || ""));
                  if (result.error) throw new Error(result.error);
                  setEditingWebhookSecret(false);
                });
                event.currentTarget.reset();
              }}
            >
              <input
                name="secret"
                type="password"
                minLength={4}
                required
                placeholder={
                  i.provider === "cakto"
                    ? "Secret gerado pela Cakto"
                    : i.provider === "kiwify"
                      ? "Token / assinatura da Kiwify"
                    : i.provider === "hotmart" ? "Hottok / token da Hotmart" : "Token/secret do webhook"
                }
              />
              <button className="button secondary" disabled={pending}>
                {editingWebhookSecret ? "Atualizar" : "Salvar e ativar"}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
function AccountPrivacyCard({
  pending,
  run,
  request,
}: {
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
  request: (path: string, data: unknown) => Promise<unknown>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const canDelete = confirmation === "EXCLUIR MINHA CONTA";

  return (
    <section className="panel" style={{ marginTop: "1rem" }}>
      <div className="panel-head">
        <div>
          <span className="eyebrow">PRIVACIDADE</span>
          <h2>Seus dados e conta</h2>
          <p>Baixe seus dados sem incluir tokens, segredos ou inscrições de push.</p>
        </div>
      </div>
      <div style={{ display: "grid", gap: "1rem" }}>
        <button
          type="button"
          className="button secondary"
          onClick={() => window.location.assign("/api/account/export")}
        >
          <Download size={16} /> Exportar meus dados
        </button>
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
          <strong style={{ color: "var(--red, #DC2626)" }}>Excluir conta e dados</strong>
          <p className="form-help">
            Esta ação remove seus workspaces próprios e dados relacionados. Não pode ser desfeita.
          </p>
          <label>
            Digite EXCLUIR MINHA CONTA para confirmar
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              aria-label="Confirmação de exclusão de conta"
            />
          </label>
          <button
            type="button"
            className="button danger"
            disabled={pending || !canDelete}
            onClick={() =>
              run(async () => {
                await request("/api/account/delete", { confirmation });
                window.location.assign("/login?account=deleted");
              })
            }
          >
            <Trash2 size={16} /> Excluir permanentemente
          </button>
        </div>
      </div>
    </section>
  );
}

function PushSettingsCard({
  workspace,
  pushSettings,
  pending,
  run,
}: {
  workspace: string;
  pushSettings?: {
    title_template?: string;
    body_template?: string;
    show_buyer?: boolean;
  };
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [title, setTitle] = useState(
    pushSettings?.title_template || "💰 Venda Realizada: {valor}!",
  );
  const [body, setBody] = useState(
    pushSettings?.body_template || "Opa, caiu mais uma! {produto} via {provedor}.",
  );
  const [showBuyer, setShowBuyer] = useState(pushSettings?.show_buyer !== false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Sync state if pushSettings prop updates
  useEffect(() => {
    if (pushSettings?.title_template) {
      setTitle(pushSettings.title_template);
    }
    if (pushSettings?.body_template) {
      setBody(pushSettings.body_template);
    }
    if (pushSettings?.show_buyer !== undefined) {
      setShowBuyer(pushSettings.show_buyer);
    }
  }, [pushSettings]);

  // Manual preview is the only path that is initiated by a user gesture.
  const playSound = () => {
    void soundPlayer.play();
  };

  const previewTitle = title
    .replace(/\{valor\}/gi, "R$ 197,00")
    .replace(/\{produto\}/gi, "Oferta Escala Black")
    .replace(/\{provedor\}/gi, "HOTMART")
    .replace(/\{comprador\}/gi, showBuyer ? "Lucas Silva" : "");

  const previewBody = body
    .replace(/\{valor\}/gi, "R$ 197,00")
    .replace(/\{produto\}/gi, "Oferta Escala Black")
    .replace(/\{provedor\}/gi, "HOTMART")
    .replace(/\{comprador\}/gi, showBuyer ? "Lucas Silva" : "");

  const handleSave = () => {
    setStatusFeedback(null);
    run(async () => {
      const res = await savePushSettings(workspace, {
        title_template: title,
        body_template: body,
        show_buyer: showBuyer,
      });
      if (res.error) {
        setStatusFeedback({ type: "error", message: res.error });
        throw new Error(res.error);
      }
      setStatusFeedback({
        type: "success",
        message: "Configurações salvas com sucesso no banco!",
      });
      setTimeout(() => setStatusFeedback(null), 4000);
    });
  };

  const handleTestPush = () => {
    setStatusFeedback(null);
    run(async () => {
      const res = await sendTestPushAction(workspace);
      if (res.error) {
        setStatusFeedback({ type: "error", message: res.error });
        throw new Error(res.error);
      }
      setStatusFeedback({
        type: "success",
        message: "💰 Notificação de teste disparada! Verifique seu aparelho.",
      });
      setTimeout(() => setStatusFeedback(null), 5000);
    });
  };
  return (
    <section className="panel" style={{ marginTop: "1.5rem" }}>
      <div className="panel-heading">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h2>Personalização das Notificações de Venda (Push)</h2>
            <span
              className="chip"
              style={{
                background: "rgba(91, 52, 234, 0.1)",
                color: "var(--brand-accent, #5B34EA)",
                fontWeight: 600,
              }}
            >
              Exclusivo
            </span>
          </div>
          <p>
            Personalize a mensagem visual da venda. Com o painel aberto, o Trackbase tenta tocar o som personalizado; em segundo plano, o iOS controla o som da notificação.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: "1.5rem",
          marginTop: "1rem",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0, width: "100%" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.35rem",
                color: "var(--text-strong, #1E1744)",
              }}
            >
              Título da Notificação
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: 💰 Venda Realizada: {valor}!"
              maxLength={150}
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid var(--line, #E5E7EB)",
                fontSize: "0.9rem",
              }}
            />
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", background: "var(--surface-subtle, #F3F4F6)", borderRadius: "4px" }}
                onClick={() => setTitle("💰 Venda Realizada: {valor}!")}
              >
                Padrão
              </button>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", background: "var(--surface-subtle, #F3F4F6)", borderRadius: "4px" }}
                onClick={() => setTitle("🚀 Pingou com força: {valor}!")}
              >
                &quot;🚀 Pingou com força&quot;
              </button>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", background: "var(--surface-subtle, #F3F4F6)", borderRadius: "4px" }}
                onClick={() => setTitle("💸 Mais uma no bolso: {valor}!")}
              >
                &quot;💸 Mais uma no bolso&quot;
              </button>
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.35rem",
                color: "var(--text-strong, #1E1744)",
              }}
            >
              Corpo da Notificação (Mensagem)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ex: Opa, caiu mais uma! {produto} via {provedor}."
              maxLength={300}
              rows={3}
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid var(--line, #E5E7EB)",
                fontSize: "0.9rem",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", background: "var(--surface-subtle, #F3F4F6)", borderRadius: "4px" }}
                onClick={() => setBody("Opa, caiu mais uma! {produto} via {provedor}.")}
              >
                &quot;Opa, caiu mais uma!&quot;
              </button>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", background: "var(--surface-subtle, #F3F4F6)", borderRadius: "4px" }}
                onClick={() => setBody("Pingou legal! {comprador} acabou de levar {produto}.")}
              >
                &quot;Pingou legal! &#123;comprador&#125;...&quot;
              </button>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem", background: "var(--surface-subtle, #F3F4F6)", borderRadius: "4px" }}
                onClick={() => setBody("Venda aprovada no checkout! {produto} via {provedor}.")}
              >
                &quot;Venda aprovada no checkout!&quot;
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <input
              type="checkbox"
              id="show-buyer-opt"
              checked={showBuyer}
              onChange={(e) => setShowBuyer(e.target.checked)}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            <label
              htmlFor="show-buyer-opt"
              style={{ fontSize: "0.85rem", color: "var(--text-strong, #1E1744)", cursor: "pointer" }}
            >
              Incluir nome do comprador nas variáveis
            </label>
          </div>

          <div
            style={{
              padding: "0.85rem",
              borderRadius: "8px",
              background: "var(--surface-subtle, #F9FAFB)",
              border: "1px dashed var(--line, #E5E7EB)",
              fontSize: "0.8rem",
              color: "var(--muted, #64748B)",
            }}
          >
            <strong style={{ display: "block", color: "var(--text-strong, #1E1744)", marginBottom: "0.35rem" }}>
              Tags dinâmicas disponíveis:
            </strong>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "grid", gap: "0.2rem" }}>
              <li>
                <code>{"{valor}"}</code>: Valor formatado da venda (Ex: R$ 197,00)
              </li>
              <li>
                <code>{"{produto}"}</code>: Nome do produto ou oferta
              </li>
              <li>
                <code>{"{provedor}"}</code>: Gateway (Ex: HOTMART, KIWIFY, CAKTO)
              </li>
              <li>
                <code>{"{comprador}"}</code>: Primeiro nome do comprador (se disponível)
              </li>
            </ul>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="button primary"
              disabled={pending}
              onClick={handleSave}
            >
              {pending ? "Salvando..." : "Salvar Notificações"}
            </button>
          </div>

          {statusFeedback && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 500,
                marginTop: "0.5rem",
                background:
                  statusFeedback.type === "success"
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                color:
                  statusFeedback.type === "success"
                    ? "#065F46"
                    : "#991B1B",
                border: `1px solid ${
                  statusFeedback.type === "success"
                    ? "rgba(16, 185, 129, 0.3)"
                    : "rgba(239, 68, 68, 0.3)"
                }`,
              }}
            >
              {statusFeedback.type === "success" ? "✓ " : "⚠️ "}
              {statusFeedback.message}
            </div>
          )}
        </div>

        {/* Live Mobile Push Preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: 0, width: "100%", maxWidth: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--muted, #64748B)" }}>
              Pré-visualização no celular:
            </span>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                type="button"
                className="button small secondary"
                onClick={playSound}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem" }}
                title="Testar som no navegador"
              >
                <Volume2 size={13} />
                Ouvir Som
              </button>
              <button
                type="button"
                className="button small"
                disabled={pending}
                onClick={handleTestPush}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", background: "var(--brand-accent, #5B34EA)", color: "#FFF" }}
                title="Enviar notificação push real para o aparelho agora"
              >
                <Bell size={13} />
                Disparar no Aparelho
              </button>
            </div>
          </div>

          <div
            style={{
              padding: "1.25rem",
              borderRadius: "16px",
              background: "#1E1744",
              color: "#FFFFFF",
              boxShadow: "0 10px 25px -5px rgba(30, 23, 68, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
                opacity: 0.8,
                fontSize: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "5px",
                    background: "var(--brand-accent, #5B34EA)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                  }}
                >
                  T
                </span>
                <strong style={{ letterSpacing: "0.02em" }}>TRACKBASE</strong>
              </div>
              <span>agora</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "#FFFFFF",
                  lineHeight: "1.3",
                }}
              >
                {previewTitle}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "rgba(255, 255, 255, 0.82)",
                  lineHeight: "1.4",
                }}
              >
                {previewBody}
              </div>
            </div>

            <div
              style={{
                marginTop: "0.85rem",
                paddingTop: "0.65rem",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.72rem",
                color: "rgba(255, 255, 255, 0.6)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Volume2 size={12} color="#10B981" /> Som de caixa registradora ativo
              </span>
              <span style={{ color: "#5B34EA", fontWeight: 600 }}>Tocar para abrir</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

