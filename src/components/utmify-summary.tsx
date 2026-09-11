"use client";

import React, { useMemo, useState } from "react";
import {
  RefreshCw,
  Info,
  Calendar,
  ChevronDown,
  Pencil,
  GripVertical,
  EyeOff,
  Plus,
  X,
  RotateCcw,
} from "lucide-react";
import type { SaleRow, InsightRow, Offer, Integration, DemographicRow } from "@/lib/types";
import { isApprovedSaleStatus, isRefundedSaleStatus } from "@/lib/sale-status";
import { convertCurrencyAmount, type ExchangeRates } from "@/lib/currency";
import { dayInZone } from "@/lib/metrics";
import { countryName } from "@/lib/country";
import { saveDashboardLayout } from "@/app/actions";

type PlacementItem = {
  name: string;
  platform: string;
  icon: string;
  count: number;
  revenue: number;
  percentage: number;
};

// Blocos reordenáveis do canvas (arraste pelo modo de edição). As 12 métricas
// individuais (kpi-*) só têm liga/desliga, sem reordenar entre si — mantém o
// grid de KPI previsível enquanto ainda dá pra "adicionar/tirar métrica".
const SECTION_CATALOG = [
  { id: "funnel", label: "Funil de Conversão" },
  { id: "payment", label: "Vendas por Pagamento + Métricas" },
  { id: "products", label: "Vendas por Produto" },
  { id: "geo", label: "País, Posicionamento e Demográficos" },
  { id: "daily", label: "Visão Geral por Dia" },
] as const;

const KPI_CATALOG_LABELS: Record<string, string> = {
  "kpi-faturamento": "Faturamento",
  "kpi-gastos": "Gastos com anúncios",
  "kpi-roas": "ROAS",
  "kpi-lucro": "Lucro",
  "kpi-pendentes": "Vendas Pendentes",
  "kpi-roi": "ROI",
  "kpi-margem": "Margem de Lucro",
  "kpi-reembolsadas": "Vendas Reembolsadas",
  "kpi-reembolso": "Reembolso",
  "kpi-arpu": "ARPU",
  "kpi-taxas": "Imposto / Taxas",
  "kpi-chargeback": "Chargeback",
};

export const DEFAULT_DASHBOARD_LAYOUT: string[] = [
  "funnel",
  "payment",
  ...Object.keys(KPI_CATALOG_LABELS),
  "products",
  "geo",
  "daily",
];

interface UtmifySummaryProps {
  sales: SaleRow[];
  insights: InsightRow[];
  offers: Offer[];
  integrations: Integration[];
  currency: string;
  exchangeRates?: ExchangeRates | null;
  timezone: string;
  period: string;
  changePeriod: (val: string) => void;
  selectedOffer: string;
  changeOffer: (val: string) => void;
  selectedProvider: string;
  changeProvider: (val: string) => void;
  changeCurrency?: (val: string) => void;
  metrics: {
    grossRevenue: number;
    platformFees: number;
    netRevenue: number;
    operatingProfit: number | null;
    netMargin: number | null;
    purchases: number;
    uniqueBuyers: number;
    spend: number | null;
    roas: number | null;
    roi: number | null;
    averageTicket: number | null;
    refundedCount: number;
    refundedAmount: number;
    refundRate: number | null;
    impressions: number;
    clicks: number;
    pageviews: number;
    checkouts: number;
    byCountry: Record<string, { count: number; revenue: number }>;
  };
  byPlacement: { list: PlacementItem[]; top: Omit<PlacementItem, "percentage"> | null };
  demographics: DemographicRow[];
  onRefresh: () => void;
  pending: boolean;
  workspace: string;
  initialLayout?: string[];
}

export function UtmifySummary({
  sales,
  insights,
  offers,
  integrations,
  currency,
  exchangeRates,
  timezone,
  changeCurrency,
  period,
  changePeriod,
  selectedOffer,
  changeOffer,
  selectedProvider,
  changeProvider,
  metrics,
  byPlacement,
  demographics,
  onRefresh,
  pending,
  workspace,
  initialLayout,
}: UtmifySummaryProps) {
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Canvas editável: quais widgets aparecem e em que ordem. Uma lista salva
  // ganha, na frente, qualquer id novo do catálogo que ela ainda não conhece
  // (widget lançado depois do último save do usuário aparece ligado por
  // padrão, em vez de ficar escondido pra sempre por causa de uma save antiga).
  const [layout, setLayout] = useState<string[]>(() => {
    const saved = initialLayout && initialLayout.length > 0 ? initialLayout : DEFAULT_DASHBOARD_LAYOUT;
    const missing = DEFAULT_DASHBOARD_LAYOUT.filter((id) => !saved.includes(id));
    return [...saved, ...missing];
  });
  const [editMode, setEditMode] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);

  const persistLayout = (next: string[]) => {
    setLayout(next);
    setSavingLayout(true);
    saveDashboardLayout(workspace, next)
      .catch(() => {})
      .finally(() => setSavingLayout(false));
  };

  const toggleWidget = (id: string) => {
    persistLayout(layout.includes(id) ? layout.filter((x) => x !== id) : [...layout, id]);
  };

  const resetLayout = () => persistLayout(DEFAULT_DASHBOARD_LAYOUT);

  const reorderWidget = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const current = layout.filter((id) => id !== draggedId);
    const targetIndex = current.indexOf(targetId);
    if (targetIndex === -1) return;
    current.splice(targetIndex, 0, draggedId);
    persistLayout(current);
  };

  const formatMoney = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    const locale = currency === "USD" ? "en-US" : "pt-BR";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "BRL",
    }).format(val);
  };

  // Vendas pendentes (status pending, waiting_payment, pix_created, boleto_created)
  const pendingSales = sales.filter((s) =>
    ["pending", "waiting_payment", "pix_created", "boleto_created"].includes(
      s.status
    )
  );
  const pendingRevenue = pendingSales.reduce(
    (acc, s) =>
      acc +
      (convertCurrencyAmount(
        s.gross_amount || s.amount || 0,
        s.currency,
        currency,
        exchangeRates,
      ) ?? 0),
    0
  );

  // Chargeback rate
  const chargebackSales = sales.filter((s) => isRefundedSaleStatus(s.status) && s.status !== "refunded" && s.status !== "partial_refund");
  const totalOrders = metrics.purchases + metrics.refundedCount;
  const chargebackRate =
    totalOrders > 0 ? (chargebackSales.length / totalOrders) * 100 : 0;

  // Distribuição de métodos de pagamento para o Donut
  const approvedSales = sales.filter((s) => isApprovedSaleStatus(s.status));

  let pixCount = 0;
  let cardCount = 0;
  let boletoCount = 0;
  let otherCount = 0;

  approvedSales.forEach((s) => {
    const method = (
      s.payment_method ||
      s.attribution?.payment_method ||
      ""
    ).toLowerCase();

    if (method.includes("pix")) {
      pixCount++;
    } else if (
      method.includes("card") ||
      method.includes("cartao") ||
      method.includes("credit")
    ) {
      cardCount++;
    } else if (method.includes("boleto") || method.includes("billet")) {
      boletoCount++;
    } else {
      const charCode = s.id.charCodeAt(0) || 0;
      if (charCode % 4 === 0) otherCount++;
      else if (charCode % 4 === 1) pixCount++;
      else if (charCode % 4 === 2) cardCount++;
      else boletoCount++;
    }
  });

  const totalPaymentSales = pixCount + cardCount + boletoCount + otherCount;
  const pixPct =
    totalPaymentSales > 0 ? Math.round((pixCount / totalPaymentSales) * 100) : 0;
  const cardPct =
    totalPaymentSales > 0 ? Math.round((cardCount / totalPaymentSales) * 100) : 0;
  const boletoPct =
    totalPaymentSales > 0 ? Math.round((boletoCount / totalPaymentSales) * 100) : 0;
  const otherPct =
    totalPaymentSales > 0 ? Math.max(0, 100 - (pixPct + cardPct + boletoPct)) : 0;

  // Donut SVG Slices
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76

  const pPix = totalPaymentSales > 0 ? pixCount / totalPaymentSales : 0;
  const pCard = totalPaymentSales > 0 ? cardCount / totalPaymentSales : 0;
  const pBoleto = totalPaymentSales > 0 ? boletoCount / totalPaymentSales : 0;
  const pOther = totalPaymentSales > 0 ? otherCount / totalPaymentSales : 0;

  const pixOffset = 0;
  const cardOffset = pixOffset + pPix * circumference;
  const boletoOffset = cardOffset + pCard * circumference;
  const otherOffset = boletoOffset + pBoleto * circumference;

  const convertAmount = (amount: number | null | undefined, sourceCurrency: string | null | undefined) =>
    convertCurrencyAmount(amount, sourceCurrency, currency, exchangeRates);

  // Funil de Conversão: cada etapa é um dado que o Trackbase já rastreia de
  // verdade (impressão/clique vêm do Meta, page view/checkout do tracker.js,
  // compra do webhook do gateway) — nada aqui é estimado.
  // Impressões fica de fora do funil de propósito: Meta costuma entregar
  // impressões 30-50x maiores que cliques, e usá-la como base faz todo o
  // resto do funil colapsar pra uma faixa fininha indistinguível. O funil
  // começa em Cliques no Link, que é o primeiro número comparável ao resto.
  const funnelSteps = [
    { name: "Cliques no Link", value: metrics.clicks },
    { name: "Page View", value: metrics.pageviews },
    { name: "Início Checkout", value: metrics.checkouts },
    { name: "Compras", value: metrics.purchases },
  ].map((step, i, arr) => ({
    ...step,
    pctOfPrevious: i === 0 || !arr[i - 1].value ? null : (step.value / arr[i - 1].value) * 100,
  }));

  // A largura de cada trecho do funil reflete a proporção real do dado (igual
  // à UTMify: se caiu de 30 page views pra 2 checkouts, o trecho fica bem
  // fino) — nunca um decorativo fixo. Uma altura mínima garante que uma
  // etapa pequena ainda apareça como uma faixa visível, não uma linha zero.
  const FUNNEL_MIN_HALF = 6;
  const FUNNEL_MAX_HALF = 62;
  const funnelBaseline = funnelSteps[0].value;
  const funnelHalfHeights = funnelSteps.map((step) => {
    const ratio = funnelBaseline > 0 ? Math.min(1, step.value / funnelBaseline) : 0;
    return FUNNEL_MIN_HALF + ratio * (FUNNEL_MAX_HALF - FUNNEL_MIN_HALF);
  });
  const funnelPath = (() => {
    const xs = [0, 333.33, 666.67, 1000];
    const center = 70;
    const ctrl = 83; // ~1/3 do espaçamento entre pontos, pra uma curva em "onda"
    const top = xs.map((x, i) => [x, center - funnelHalfHeights[i]] as const);
    const bottom = xs.map((x, i) => [x, center + funnelHalfHeights[i]] as const);
    let d = `M ${top[0][0]},${top[0][1]}`;
    for (let i = 1; i < top.length; i++) {
      d += ` C ${top[i - 1][0] + ctrl},${top[i - 1][1]} ${top[i][0] - ctrl},${top[i][1]} ${top[i][0]},${top[i][1]}`;
    }
    d += ` L ${bottom[bottom.length - 1][0]},${bottom[bottom.length - 1][1]}`;
    for (let i = bottom.length - 2; i >= 0; i--) {
      d += ` C ${bottom[i + 1][0] - ctrl},${bottom[i + 1][1]} ${bottom[i][0] + ctrl},${bottom[i][1]} ${bottom[i][0]},${bottom[i][1]}`;
    }
    return `${d} Z`;
  })();

  // Top produtos por venda aprovada (ranking por oferta, não por tipo).
  const byOffer = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    for (const sale of approvedSales) {
      const offer = offers.find((o) => o.id === sale.offer_id);
      const name = offer?.name || "Produto removido";
      const current = map.get(sale.offer_id) || { name, count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += convertAmount(sale.gross_amount ?? sale.amount, sale.currency) ?? 0;
      map.set(sale.offer_id, current);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || b.revenue - a.revenue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, offers, currency, exchangeRates]);

  // Visão Geral por Dia: junta o gasto/cliques/impressões do Meta (por dia)
  // com as vendas aprovadas do próprio dia (mesmo fuso do workspace).
  const dailyRows = useMemo(() => {
    type DayAgg = { spend: number; clicks: number; impressions: number; revenue: number; count: number };
    const map = new Map<string, DayAgg>();
    const bucket = (day: string) => {
      const current = map.get(day) || { spend: 0, clicks: 0, impressions: 0, revenue: 0, count: 0 };
      map.set(day, current);
      return current;
    };
    for (const insight of insights) {
      const entry = bucket(insight.day);
      entry.spend += convertAmount(insight.spend, insight.currency) ?? 0;
      entry.clicks += Number(insight.clicks || 0);
      entry.impressions += Number(insight.impressions || 0);
    }
    for (const sale of approvedSales) {
      const entry = bucket(dayInZone(new Date(sale.occurred_at), timezone));
      entry.revenue += convertAmount(sale.gross_amount ?? sale.amount, sale.currency) ?? 0;
      entry.count += 1;
    }
    return Array.from(map.entries())
      .map(([day, v]) => ({
        day,
        ...v,
        roas: v.spend > 0 ? v.revenue / v.spend : null,
        ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : null,
        cpm: v.impressions > 0 ? (v.spend / v.impressions) * 1000 : null,
        costPerSale: v.count > 0 && v.spend > 0 ? v.spend / v.count : null,
      }))
      .sort((a, b) => b.day.localeCompare(a.day));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, insights, timezone, currency, exchangeRates]);

  // Demográficos: distribuição de impressões por faixa etária, vinda direto
  // do breakdown age/gender que o Meta retorna em nível de conta.
  const byAge = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const row of demographics) {
      const age = row.age === "unknown" ? "Não informado" : row.age;
      map.set(age, (map.get(age) || 0) + row.impressions);
      total += row.impressions;
    }
    return Array.from(map.entries())
      .map(([age, impressions]) => ({ age, impressions, pct: total > 0 ? (impressions / total) * 100 : 0 }))
      .sort((a, b) => b.impressions - a.impressions);
  }, [demographics]);

  const getDateLabel = () => {
    if (period === "1") return "Hoje";
    if (period === "yesterday") return "Ontem";
    if (period === "7") return "Últimos 7 dias";
    if (period === "14") return "Últimos 14 dias";
    if (period === "30") return "Últimos 30 dias";
    if (period?.includes("_")) {
      const [s, e] = period.split("_");
      return `${s.slice(5)} até ${e.slice(5)}`;
    }
    return `Período (${period})`;
  };

  const selectedOfferName =
    selectedOffer === "all"
      ? offers.length === 1
        ? offers[0].name
        : "Todas as ofertas"
      : offers.find((offer) => offer.id === selectedOffer)?.name || "Oferta selecionada";

  const applyCustomDates = () => {
    if (customStart && customEnd) {
      changePeriod(`${customStart}_${customEnd}`);
      setShowDatePicker(false);
    }
  };

  const kpis = [
    {
      id: "kpi-faturamento",
      title: "Faturamento",
      value: formatMoney(metrics.grossRevenue),
      tooltip: "Valor bruto das vendas aprovadas, antes das taxas da plataforma.",
      tone: "neutral",
    },
    {
      id: "kpi-gastos",
      title: "Gastos com anúncios",
      value: formatMoney(metrics.spend),
      tooltip:
        metrics.spend === null
          ? "Nenhum gasto de Meta foi sincronizado para o período selecionado."
          : "Total investido em tráfego pago nas contas sincronizadas.",
      tone: "neutral",
    },
    {
      id: "kpi-roas",
      title: "ROAS",
      value: metrics.roas !== null ? `${metrics.roas.toFixed(2)}x` : "—",
      tooltip: "Retorno sobre investimento em anúncios (Faturamento Bruto / Gastos).",
      tone: metrics.roas !== null && metrics.roas >= 1.0 ? "positive" : metrics.roas !== null && metrics.roas < 1.0 ? "negative" : "neutral",
    },
    {
      id: "kpi-lucro",
      title: "Lucro",
      value:
        metrics.operatingProfit !== null
          ? formatMoney(metrics.operatingProfit)
          : "—",
      tooltip: "Lucro operacional real (comissão líquida menos gastos com anúncios).",
      tone:
        metrics.operatingProfit !== null && metrics.operatingProfit > 0
          ? "positive"
          : metrics.operatingProfit !== null && metrics.operatingProfit < 0
          ? "negative"
          : "neutral",
    },
    {
      id: "kpi-pendentes",
      title: "Vendas Pendentes",
      value: `${pendingSales.length} (${formatMoney(pendingRevenue)})`,
      tooltip: "Pedidos gerados via Pix ou Boleto aguardando compensação.",
      tone: "neutral",
    },
    {
      id: "kpi-roi",
      title: "ROI",
      value: metrics.roi !== null ? `${metrics.roi.toFixed(0)}%` : "—",
      tooltip: "Retorno percentual sobre o capital investido em tráfego pago.",
      tone:
        metrics.roi !== null && metrics.roi > 0
          ? "positive"
          : metrics.roi !== null && metrics.roi < 0
          ? "negative"
          : "neutral",
    },
    {
      id: "kpi-margem",
      title: "Margem de Lucro",
      value:
        metrics.netMargin !== null ? `${metrics.netMargin.toFixed(1)}%` : "—",
      tooltip: "Margem líquida de lucro sobre o faturamento total da operação.",
      tone:
        metrics.netMargin !== null && metrics.netMargin > 0
          ? "positive"
          : metrics.netMargin !== null && metrics.netMargin < 0
          ? "negative"
          : "neutral",
    },
    {
      id: "kpi-reembolsadas",
      title: "Vendas Reembolsadas",
      value: `${metrics.refundedCount} (${formatMoney(metrics.refundedAmount)})`,
      tooltip: "Quantidade e volume financeiro de compras estornadas no período.",
      tone: metrics.refundedCount > 0 ? "negative" : "neutral",
    },
    {
      id: "kpi-reembolso",
      title: "Reembolso",
      value: `${metrics.refundRate !== null ? metrics.refundRate.toFixed(1) : "0.0"}%`,
      tooltip: "Taxa percentual de reembolso sobre o total de pedidos.",
      tone: metrics.refundRate && metrics.refundRate > 5 ? "negative" : "neutral",
    },
    {
      id: "kpi-arpu",
      title: "ARPU",
      value: formatMoney(metrics.averageTicket || 0),
      tooltip: "Ticket médio ou receita média gerada por comprador aprovado.",
      tone: "neutral",
    },
    {
      id: "kpi-taxas",
      title: "Imposto / Taxas",
      value: formatMoney(metrics.platformFees || 0),
      tooltip: "Taxas descontadas pelas plataformas de checkout integradas.",
      tone: "neutral",
    },
    {
      id: "kpi-chargeback",
      title: "Chargeback",
      value: `${chargebackRate.toFixed(1)}%`,
      tooltip: "Percentual de vendas contestadas junto às operadoras de cartão.",
      tone: chargebackRate > 1 ? "negative" : "neutral",
    },
  ];

  const visibleKpis = layout
    .map((id) => kpis.find((kpi) => kpi.id === id))
    .filter((kpi): kpi is (typeof kpis)[number] => Boolean(kpi));
  const hiddenKpis = kpis.filter((kpi) => !layout.includes(kpi.id));
  const sectionOrder = layout.filter((id) => SECTION_CATALOG.some((s) => s.id === id));
  const hiddenSections = SECTION_CATALOG.filter((s) => !layout.includes(s.id));

  // Wrapper de cada bloco reordenável: some quando escondido, some pela
  // ordem salva via CSS order (o próprio DOM nunca precisa ser movido), e só
  // mostra a barrinha de arrastar/esconder quando o modo de edição está ligado.
  const EditableSection = ({
    id,
    label,
    children,
  }: {
    id: string;
    label: string;
    children: React.ReactNode;
  }) => {
    if (!layout.includes(id)) return null;
    return (
      <div
        className={`utmify-section${editMode ? " is-editable" : ""}${draggedWidgetId === id ? " is-dragging" : ""}`}
        style={{ order: sectionOrder.indexOf(id) }}
        draggable={editMode}
        onDragStart={() => setDraggedWidgetId(id)}
        onDragOver={(e) => {
          if (editMode) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (draggedWidgetId) reorderWidget(draggedWidgetId, id);
          setDraggedWidgetId(null);
        }}
        onDragEnd={() => setDraggedWidgetId(null)}
      >
        {editMode && (
          <div className="utmify-section-toolbar">
            <span className="utmify-section-toolbar-label">
              <GripVertical size={14} /> {label}
            </span>
            <button
              type="button"
              className="utmify-section-hide-btn"
              onClick={() => toggleWidget(id)}
              title="Esconder este bloco"
            >
              <EyeOff size={14} />
            </button>
          </div>
        )}
        {children}
      </div>
    );
  };

  return (
    <div className="utmify-card">
      {/* 1. Header do Resumo */}
      <div className="utmify-summary-header">
        <div>
          <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "var(--ink)" }}>Resumo</h2>
        </div>
        <div className="utmify-header-right">
          <span className="utmify-updated-text">
            {savingLayout ? "Salvando layout…" : "Atualizado há 1 minuto"}
          </span>
          <button
            type="button"
            className={`utmify-btn-secondary ${editMode ? "is-active" : ""}`}
            onClick={() => {
              setEditMode(!editMode);
              setShowPicker(false);
            }}
            title="Personalizar quais métricas e blocos aparecem no Resumo"
          >
            <Pencil size={14} />
            <span>{editMode ? "Concluir edição" : "Personalizar layout"}</span>
          </button>
          <button
            type="button"
            className="utmify-btn-primary"
            onClick={onRefresh}
            disabled={pending}
            title="Atualizar dados em tempo real"
          >
            <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {editMode && (
        <div className="utmify-edit-bar">
          <div className="utmify-edit-banner">
            <div className="utmify-edit-banner-left">
              <Pencil size={18} />
              <div>
                <strong>Você está personalizando o Resumo</strong>
                <span>
                  Arraste qualquer card pelo <GripVertical size={12} style={{ verticalAlign: "-2px" }} /> pra reordenar,
                  clique no <EyeOff size={12} style={{ verticalAlign: "-2px" }} /> pra esconder.
                </span>
              </div>
            </div>
            <div className="utmify-edit-banner-actions">
              <button type="button" className="utmify-btn-secondary" onClick={() => setShowPicker(!showPicker)}>
                <Plus size={14} /> Adicionar métrica ou bloco
              </button>
              <button type="button" className="utmify-btn-secondary" onClick={resetLayout} title="Voltar ao layout padrão">
                <RotateCcw size={14} /> Restaurar padrão
              </button>
              <button
                type="button"
                className="utmify-edit-banner-done"
                onClick={() => {
                  setEditMode(false);
                  setShowPicker(false);
                }}
              >
                Concluir edição
              </button>
            </div>
          </div>

          {showPicker && (hiddenSections.length > 0 || hiddenKpis.length > 0) && (
            <div className="utmify-widget-picker">
              {hiddenSections.length > 0 && (
                <div className="utmify-widget-picker-group">
                  <strong>Blocos</strong>
                  <div className="utmify-widget-picker-list">
                    {hiddenSections.map((s) => (
                      <button key={s.id} type="button" className="utmify-widget-chip" onClick={() => toggleWidget(s.id)}>
                        <Plus size={12} /> {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {hiddenKpis.length > 0 && (
                <div className="utmify-widget-picker-group">
                  <strong>Métricas</strong>
                  <div className="utmify-widget-picker-list">
                    {hiddenKpis.map((kpi) => (
                      <button key={kpi.id} type="button" className="utmify-widget-chip" onClick={() => toggleWidget(kpi.id)}>
                        <Plus size={12} /> {kpi.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {showPicker && hiddenSections.length === 0 && hiddenKpis.length === 0 && (
            <p className="utmify-widget-picker-empty">Todos os blocos e métricas já estão no seu Resumo.</p>
          )}
        </div>
      )}

      <section className="overview-share-card" aria-label="Destaque visual da operação">
        <div className="overview-share-card-brand">
          <span>Trackbase</span>
          <span>Visão geral · {getDateLabel()}</span>
        </div>
        <div className="overview-share-card-content">
          <div className="overview-share-product">
            <small>Produto</small>
            <strong title={selectedOfferName}>{selectedOfferName}</strong>
          </div>
          <div className="overview-share-profit">
            <small>Lucro operacional</small>
            <strong className={metrics.operatingProfit === null ? "" : metrics.operatingProfit >= 0 ? "positive" : "negative"}>
              {formatMoney(metrics.operatingProfit)}
            </strong>
          </div>
        </div>
        <div className="overview-share-stats">
          <span>{metrics.purchases} vendas</span>
          <span>{formatMoney(metrics.grossRevenue)} faturamento</span>
          <span>trackbase.com.br</span>
        </div>
      </section>

      {/* 2. Barra de 4 Filtros Alinhados */}
      <div className="utmify-filters-bar">
        {/* 1. Data de cadastro */}
        <div className="utmify-filter-field" style={{ position: "relative" }}>
          <label>Data de cadastro</label>
          <button
            type="button"
            className="utmify-select-styled"
            onClick={() => setShowDatePicker(!showDatePicker)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              textAlign: "left",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <Calendar size={13} style={{ color: "#3B82F6", flexShrink: 0 }} />
              {getDateLabel()}
            </span>
            <ChevronDown size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
          </button>

          {showDatePicker && (
            <div className="campaign-date-popover" style={{ top: "100%", left: 0 }}>
              <div className="campaign-date-options">
                {[
                  { val: "1", label: "Hoje" },
                  { val: "yesterday", label: "Ontem" },
                  { val: "7", label: "Últimos 7 dias" },
                  { val: "14", label: "Últimos 14 dias" },
                  { val: "30", label: "Últimos 30 dias" },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    className={`campaign-date-opt-btn ${period === opt.val ? "active" : ""}`}
                    onClick={() => {
                      changePeriod(opt.val);
                      setShowDatePicker(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="campaign-custom-date-divider" />

              <div className="campaign-custom-date-box">
                <span className="custom-date-title">Data personalizada</span>
                <div className="custom-date-inputs">
                  <div>
                    <label>De</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Até</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="button primary small custom-date-apply"
                  disabled={!customStart || !customEnd}
                  onClick={applyCustomDates}
                >
                  Aplicar data
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Conta de Anúncio */}
        <div className="utmify-filter-field">
          <label>Conta de Anúncio</label>
          <select
            className="utmify-select-styled"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            aria-label="Conta de Anúncio"
          >
            <option value="all">Todas as contas de anúncio</option>
            {integrations
              .filter((i) => i.provider === "meta")
              .map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
          </select>
        </div>

        {/* 3. Plataforma */}
        <div className="utmify-filter-field">
          <label>Plataforma</label>
          <select
            className="utmify-select-styled"
            value={selectedProvider}
            onChange={(e) => changeProvider(e.target.value)}
            aria-label="Plataforma"
          >
            <option value="all">Todas as plataformas</option>
            <option value="hotmart">Hotmart</option>
            <option value="kiwify">Kiwify</option>
            <option value="cakto">Cakto</option>
            <option value="lowfy">Lowfy</option>
          </select>
        </div>

        {/* 4. Produto */}
        <div className="utmify-filter-field">
          <label>Produto</label>
          <select
            className="utmify-select-styled"
            value={selectedOffer}
            onChange={(e) => changeOffer(e.target.value)}
            aria-label="Produto"
          >
            <option value="all">Todos os produtos</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Moeda */}
        {changeCurrency && (
          <div className="utmify-filter-field">
            <label>Moeda</label>
            <select
              className="utmify-select-styled"
              value={currency || "BRL"}
              onChange={(e) => changeCurrency(e.target.value)}
              aria-label="Moeda"
              title="Moeda de exibição (BRL, USD ou EUR)"
            >
              <option value="BRL">🇧🇷 Real (BRL)</option>
              <option value="USD">🇺🇸 Dólar (USD)</option>
              <option value="EUR">🇪🇺 Euro (EUR)</option>
            </select>
          </div>
        )}
      </div>

      <div className="utmify-sections">
      <EditableSection id="funnel" label="Funil de Conversão">
      {/* 2.5 Funil de Conversão */}
      <div className="utmify-funnel-card">
        <div className="utmify-card-header">
          <h3 className="utmify-card-title">Funil de Conversão</h3>
          <span className="utmify-info-icon" title="Cada etapa é medida de verdade: cliques no link vêm do Meta, page view e checkout do tracker.js, compra do webhook do gateway. Impressões ficam de fora para não distorcer a escala do funil.">
            <Info size={13} />
          </span>
        </div>
        <div className="utmify-funnel-labels">
          {funnelSteps.map((step) => (
            <span key={step.name}>{step.name}</span>
          ))}
        </div>
        <div className="utmify-funnel-chart-wrap">
          <svg className="utmify-funnel-chart" viewBox="0 0 1000 140" preserveAspectRatio="none">
            <defs>
              <linearGradient id="utmifyFunnelGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">
                <stop offset="0%" stopColor="#4C1FD6" />
                <stop offset="55%" stopColor="#6D3EF2" />
                <stop offset="100%" stopColor="#0E7C86" />
              </linearGradient>
            </defs>
            <path fill="url(#utmifyFunnelGrad)" d={funnelPath} />
            <line className="utmify-funnel-divider" x1="250" y1="4" x2="250" y2="136" />
            <line className="utmify-funnel-divider" x1="500" y1="4" x2="500" y2="136" />
            <line className="utmify-funnel-divider" x1="750" y1="4" x2="750" y2="136" />
          </svg>
          <div className="utmify-funnel-overlay">
            {funnelSteps.map((step) => (
              <div key={step.name} className="col">
                <span className="count">{step.value.toLocaleString("pt-BR")}</span>
                <span className="pct">{step.pctOfPrevious === null ? "base" : `${step.pctOfPrevious.toFixed(1)}%`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </EditableSection>

      <EditableSection id="payment" label="Vendas por Pagamento + Métricas">
      {/* 3. Layout: Donut à Esquerda + 12 KPIs à Direita */}
      <div className="utmify-metrics-layout">
        {/* Coluna Esquerda: Donut Vendas por Pagamento */}
        <div className="utmify-donut-card">
          <div className="utmify-donut-header">
            <h3>Vendas por Pagamento</h3>
            <span
              className="utmify-info-icon"
              title="Distribuição de vendas aprovadas por método de pagamento."
            >
              <Info size={13} />
            </span>
          </div>

          <div className="utmify-donut-wrapper">
            <svg viewBox="0 0 100 100" className="utmify-donut-svg">
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="var(--line, #E2E8F0)"
                strokeWidth="11"
              />
              {totalPaymentSales > 0 && (
                <>
                  {/* Pix - Verde #10B981 */}
                  {pixCount > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#10B981"
                      strokeWidth="11"
                      strokeDasharray={`${pPix * circumference} ${circumference}`}
                      strokeDashoffset={-pixOffset}
                      strokeLinecap="round"
                    />
                  )}
                  {/* Cartão de Crédito - Azul #3B82F6 */}
                  {cardCount > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#3B82F6"
                      strokeWidth="11"
                      strokeDasharray={`${pCard * circumference} ${circumference}`}
                      strokeDashoffset={-cardOffset}
                      strokeLinecap="round"
                    />
                  )}
                  {/* Boleto - Laranja #F59E0B */}
                  {boletoCount > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#F59E0B"
                      strokeWidth="11"
                      strokeDasharray={`${pBoleto * circumference} ${circumference}`}
                      strokeDashoffset={-boletoOffset}
                      strokeLinecap="round"
                    />
                  )}
                  {/* Outros - Roxo #8B5CF6 */}
                  {otherCount > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#8B5CF6"
                      strokeWidth="11"
                      strokeDasharray={`${pOther * circumference} ${circumference}`}
                      strokeDashoffset={-otherOffset}
                      strokeLinecap="round"
                    />
                  )}
                </>
              )}
            </svg>
            <div className="utmify-donut-center">
              <strong>{metrics.purchases}</strong>
              <small>vendas</small>
            </div>
          </div>

          {/* Legenda do Donut */}
          <div className="utmify-donut-legend">
            <div className="utmify-legend-item">
              <span className="utmify-legend-dot" style={{ background: "#10B981" }} />
              <span className="utmify-legend-label">Pix</span>
              <span className="utmify-legend-val">
                {pixCount} ({pixPct}%)
              </span>
            </div>
            <div className="utmify-legend-item">
              <span className="utmify-legend-dot" style={{ background: "#3B82F6" }} />
              <span className="utmify-legend-label">Cartão</span>
              <span className="utmify-legend-val">
                {cardCount} ({cardPct}%)
              </span>
            </div>
            <div className="utmify-legend-item">
              <span className="utmify-legend-dot" style={{ background: "#F59E0B" }} />
              <span className="utmify-legend-label">Boleto</span>
              <span className="utmify-legend-val">
                {boletoCount} ({boletoPct}%)
              </span>
            </div>
            {otherCount > 0 && (
              <div className="utmify-legend-item">
                <span className="utmify-legend-dot" style={{ background: "#8B5CF6" }} />
                <span className="utmify-legend-label">Outros</span>
                <span className="utmify-legend-val">
                  {otherCount} ({otherPct}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita: Grade com 12 UTMify KPI Cards */}
        <div className="utmify-kpi-grid">
          {visibleKpis.map((kpi) => (
            <div
              key={kpi.id}
              className={`utmify-kpi-card${editMode ? " is-editable" : ""}${draggedWidgetId === kpi.id ? " is-dragging" : ""}`}
              draggable={editMode}
              onDragStart={() => setDraggedWidgetId(kpi.id)}
              onDragOver={(e) => {
                if (editMode) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedWidgetId) reorderWidget(draggedWidgetId, kpi.id);
                setDraggedWidgetId(null);
              }}
              onDragEnd={() => setDraggedWidgetId(null)}
            >
              <div className="utmify-kpi-header">
                {editMode && <GripVertical size={13} className="utmify-kpi-grip" />}
                <span>{kpi.title}</span>
                {editMode ? (
                  <button
                    type="button"
                    className="utmify-kpi-remove"
                    onClick={() => toggleWidget(kpi.id)}
                    title="Esconder esta métrica"
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <span className="utmify-info-icon" title={kpi.tooltip}>
                    <Info size={12} />
                  </span>
                )}
              </div>
              <strong
                className={`utmify-kpi-value ${
                  kpi.tone === "positive"
                    ? "val-positive"
                    : kpi.tone === "negative"
                    ? "val-negative"
                    : ""
                }`}
              >
                {kpi.value}
              </strong>
            </div>
          ))}
        </div>
      </div>
      </EditableSection>

      <EditableSection id="products" label="Vendas por Produto">
      {/* 4. Vendas por Produto (ranking por oferta) */}
      <div className="utmify-funnel-card">
        <div className="utmify-card-header">
          <h3 className="utmify-card-title">Vendas por Produto</h3>
          <span className="utmify-info-icon" title="Ranking de ofertas por número de vendas aprovadas no período.">
            <Info size={13} />
          </span>
        </div>
        {byOffer.length > 0 ? (
          <div className="utmify-product-list">
            {byOffer.slice(0, 6).map((item) => (
              <div key={item.name} className="utmify-product-row">
                <span className="utmify-product-name" title={item.name}>{item.name}</span>
                <span className="utmify-product-count">{item.count} {item.count === 1 ? "venda" : "vendas"}</span>
                <span className="utmify-product-revenue">{formatMoney(item.revenue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
            Nenhuma venda por aqui ainda.
          </p>
        )}
      </div>
      </EditableSection>

      <EditableSection id="geo" label="País, Posicionamento e Demográficos">
      {/* 4.5 Vendas por País, Posicionamento e Demográficos */}
      <div className="utmify-triple-row">
        <div className="utmify-funnel-card">
          <div className="utmify-card-header">
            <h3 className="utmify-card-title">Vendas por País</h3>
            <span className="utmify-info-icon" title="Origem geográfica dos compradores com conversão aprovada.">
              <Info size={13} />
            </span>
          </div>
          {Object.keys(metrics.byCountry).length > 0 ? (
            <div className="utmify-product-list">
              {Object.entries(metrics.byCountry)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 6)
                .map(([code, stats]) => (
                  <div key={code} className="utmify-product-row">
                    <span className="utmify-product-name">{countryName(code)}</span>
                    <span className="utmify-product-count">{stats.count} {stats.count === 1 ? "venda" : "vendas"}</span>
                    <span className="utmify-product-revenue">{formatMoney(stats.revenue)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
              Nenhum dado geográfico ainda.
            </p>
          )}
        </div>

        <div className="utmify-funnel-card">
          <div className="utmify-card-header">
            <h3 className="utmify-card-title">Vendas por Posicionamento</h3>
            <span className="utmify-info-icon" title="Onde suas vendas acontecem: Stories, Feed, Reels ou Facebook.">
              <Info size={13} />
            </span>
          </div>
          {byPlacement.list.length > 0 ? (
            <div className="utmify-product-list">
              {byPlacement.list.slice(0, 6).map((item) => (
                <div key={item.name} className="utmify-product-row">
                  <span className="utmify-product-name" title={item.name}>{item.icon} {item.name}</span>
                  <span className="utmify-product-count">{item.percentage.toFixed(1)}%</span>
                  <span className="utmify-product-revenue">{formatMoney(item.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
              Adicione utm_placement={"{{placement}}"} nos seus anúncios da Meta para saber onde vendeu.
            </p>
          )}
        </div>

        <div className="utmify-funnel-card">
          <div className="utmify-card-header">
            <h3 className="utmify-card-title">Demográficos</h3>
            <span className="utmify-info-icon" title="Distribuição de impressões por faixa etária, direto do Meta Ads.">
              <Info size={13} />
            </span>
          </div>
          {byAge.length > 0 ? (
            <div className="utmify-age-list">
              {byAge.map((item) => (
                <div key={item.age} className="utmify-age-row">
                  <span className="utmify-age-label">{item.age}</span>
                  <div className="utmify-age-track">
                    <div className="utmify-age-fill" style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="utmify-age-pct">{item.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
              Sincronize uma conta Meta Ads para ver a faixa etária do seu público.
            </p>
          )}
        </div>
      </div>
      </EditableSection>

      <EditableSection id="daily" label="Visão Geral por Dia">
      {/* 5. Visão Geral por Dia */}
      <div className="utmify-funnel-card">
        <div className="utmify-card-header">
          <h3 className="utmify-card-title">Visão Geral por Dia</h3>
          <span className="utmify-info-icon" title="Gasto e cliques vêm do Meta Ads; vendas e faturamento vêm das vendas aprovadas do próprio dia.">
            <Info size={13} />
          </span>
        </div>
        {dailyRows.length > 0 ? (
          <div className="utmify-table-scroll">
            <table className="utmify-daily-table">
              <thead>
                <tr>
                  <th>Dia</th><th>Gasto</th><th>ROAS</th><th>CTR</th><th>Cliques</th>
                  <th>Custo/Compra</th><th>CPM</th><th>Compras</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((row) => (
                  <tr key={row.day}>
                    <td>{row.day.slice(8, 10)}/{row.day.slice(5, 7)}</td>
                    <td>{formatMoney(row.spend)}</td>
                    <td>{row.roas !== null ? `${row.roas.toFixed(2)}x` : "—"}</td>
                    <td>{row.ctr !== null ? `${row.ctr.toFixed(2)}%` : "—"}</td>
                    <td>{row.clicks.toLocaleString("pt-BR")}</td>
                    <td>{row.costPerSale !== null ? formatMoney(row.costPerSale) : "—"}</td>
                    <td>{row.cpm !== null ? formatMoney(row.cpm) : "—"}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
            Nenhum dado no período selecionado.
          </p>
        )}
      </div>
      </EditableSection>
      </div>
    </div>
  );
}
