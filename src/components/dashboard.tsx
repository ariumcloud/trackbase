"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { ActionForm, OfferForm, WorkspaceForm } from "./forms";
import {
  saveLink,
  toggleLink,
  savePaymentIntegration,
  cleanupTests,
  logout,
} from "@/app/actions";
import { buildLink, metaDefaults } from "@/lib/utm";
import { calculate, dayInZone } from "@/lib/metrics";
import type {
  Workspace,
  Offer,
  LinkRow,
  Integration,
  SaleRow,
  InsightRow,
  Entity,
  WebhookLog,
} from "@/lib/types";
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
  initialTab?: string;
  appUrl: string;
  error?: string;
};
const tabs = [
  { id: "visao", name: "Visão geral", icon: LayoutDashboard },
  { id: "ofertas", name: "Minhas ofertas", icon: Layers },
  { id: "links", name: "Links e UTMs", icon: Link2 },
  { id: "campanhas", name: "Campanhas", icon: BarChart3 },
  { id: "integracoes", name: "Integrações", icon: Plug },
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
  integracoes: [
    "Conecte os pontos.",
    "Suas fontes de tráfego e vendas, na mesma operação.",
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
  const metrics = calculate(sales, insights, currency);
  const hasPayments = p.integrations.some(
    (i) => i.provider !== "meta" && i.status === "connected",
  );
  const money = (v: number | null) =>
    v === null
      ? "—"
      : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
          v,
        );
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
          <span className="brand-icon">u↗</span> UTM<span>Liso</span>
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
              {p.workspace?.plan === "devedor"
                ? "UTMDevedor · gratuito"
                : "UTMLiso · MVP"}
            </span>
          </div>
          <div className="sidebar-user">
            <span className="user-avatar">
              {p.workspace?.name.slice(0, 1) || "U"}
            </span>
            <span>
              <strong>{p.workspace?.name || "Bem-vindo"}</strong>
              <small>Powered by UTMLiso</small>
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
            <button
              className="button primary"
              onClick={() => create(tab === "ofertas" ? "offer" : "link")}
            >
              <Plus size={17} />
              {tab === "ofertas" ? "Nova oferta" : "Criar link UTM"}
            </button>
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
              <div className="filterbar">
                <div className="filter-group">
                  <SlidersHorizontal size={16} />
                  <select
                    aria-label="Período"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option value="1">Hoje</option>
                    <option value="7">Últimos 7 dias</option>
                    <option value="30">Últimos 30 dias</option>
                  </select>
                  <select
                    aria-label="Oferta"
                    value={offer}
                    onChange={(e) => setOffer(e.target.value)}
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
                    onChange={(e) => setCurrency(e.target.value)}
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
                    value: money(metrics.spend),
                    hint: "Gasto na Meta Ads",
                    icon: Wallet,
                  },
                  {
                    name: "Faturamento",
                    value: hasPayments ? money(metrics.revenue) : "—",
                    hint: "Vendas aprovadas · sem testes",
                    icon: ShoppingBag,
                  },
                  {
                    name: "Resultado bruto",
                    value: hasPayments ? money(metrics.profit) : "—",
                    hint: "Faturamento menos mídia, antes de taxas",
                    icon: Activity,
                  },
                  {
                    name: "ROAS",
                    value:
                      hasPayments && metrics.roas !== null
                        ? `${metrics.roas.toFixed(2)}x`
                        : "—",
                    hint: "Retorno sobre investimento em mídia",
                    icon: ArrowUpRight,
                  },
                ].map((m, i) => (
                  <section
                    className={`metric-card ${i === 2 ? "featured" : ""}`}
                    key={m.name}
                  >
                    <div className="metric-label">
                      {m.name}
                      <m.icon size={18} />
                    </div>
                    <strong>{m.value}</strong>
                    <small>{m.hint}</small>
                  </section>
                ))}
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
                      <span className="chip">{o.currency}</span>
                      <h2>{o.name}</h2>
                      <p className="url-text">{o.landing_url}</p>
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
                    id: "hotmart",
                    name: "Hotmart",
                    letter: "h",
                    text: "Receba vendas, reembolsos e atualizações por webhook.",
                    color: "orange",
                  },
                  {
                    id: "cakto",
                    name: "Cakto",
                    letter: "c",
                    text: "Conecte seus produtos e acompanhe os pedidos aprovados.",
                    color: "green",
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
                    : `Conectar ${modal === "hotmart" ? "Hotmart" : "Cakto"}`}
            </h2>
            {modal === "workspace" ? (
              <WorkspaceForm />
            ) : modal === "offer" ? (
              <OfferForm workspace={workspace} />
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
                  <input name="external_product_id" required />
                </label>
                <label>
                  Código da oferta no provedor (opcional)
                  <input name="external_offer_id" />
                </label>
                <label>
                  Moeda quando o webhook não informar
                  <select name="currency">
                    <option>BRL</option>
                    <option>USD</option>
                    <option>EUR</option>
                    <option>MXN</option>
                  </select>
                </label>
                <label>
                  {modal === "hotmart"
                    ? "Hottok da Hotmart"
                    : "Secret do webhook Cakto"}
                  <input
                    name="secret"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
                <p className="form-help">
                  O token será armazenado como hash. Use o mesmo valor
                  configurado no provedor.
                </p>
              </ActionForm>
            )}
          </section>
        </div>
      )}
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
      ) : (
        <div className="webhook-url">
          <input
            aria-label="Endpoint do webhook"
            readOnly
            value={`${appUrl}/api/webhooks/${i.provider}/${i.id}`}
          />
          <Clipboard value={`${appUrl}/api/webhooks/${i.provider}/${i.id}`} />
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
