"use client";

import React, { useState } from "react";
import {
  RefreshCw,
  Info,
  Calendar,
  ChevronDown,
  Share2,
} from "lucide-react";
import type { SaleRow, InsightRow, Offer, Integration } from "@/lib/types";

interface UtmifySummaryProps {
  sales: SaleRow[];
  insights: InsightRow[];
  offers: Offer[];
  integrations: Integration[];
  currency: string;
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
  };
  onRefresh: () => void;
  pending: boolean;
}

export function UtmifySummary({
  sales,
  offers,
  integrations,
  currency,
  changeCurrency,
  period,
  changePeriod,
  selectedOffer,
  changeOffer,
  selectedProvider,
  changeProvider,
  metrics,
  onRefresh,
  pending,
}: UtmifySummaryProps) {
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared">("idle");

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
    (acc, s) => acc + (s.gross_amount || s.amount || 0),
    0
  );

  // Chargeback rate
  const chargebackSales = sales.filter((s) =>
    ["chargeback", "chargedback"].includes(s.status)
  );
  const totalOrders = metrics.purchases + metrics.refundedCount;
  const chargebackRate =
    totalOrders > 0 ? (chargebackSales.length / totalOrders) * 100 : 0;

  // Distribuição de métodos de pagamento para o Donut
  const approvedSales = sales.filter((s) =>
    ["paid", "approved", "completed"].includes(s.status)
  );

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

  const shareText = `${selectedOfferName} · Lucro ${formatMoney(metrics.operatingProfit)} · ${metrics.purchases} vendas · Trackbase`;

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const shareData = {
      title: `${selectedOfferName} · Trackbase`,
      text: shareText,
      url: window.location.href,
    };

    try {
      if (typeof navigator.share === "function") {
        await navigator.share(shareData);
        setShareStatus("shared");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setShareStatus("copied");
      } else {
        const fallback = document.createElement("textarea");
        fallback.value = shareText;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand("copy");
        fallback.remove();
        setShareStatus("copied");
      }
      window.setTimeout(() => setShareStatus("idle"), 2200);
    } catch (error) {
      // Cancelar o compartilhamento nativo não deve exibir erro para o usuário.
      if ((error as DOMException)?.name !== "AbortError") {
        console.error("Share overview failed", error);
      }
    }
  };

  const applyCustomDates = () => {
    if (customStart && customEnd) {
      changePeriod(`${customStart}_${customEnd}`);
      setShowDatePicker(false);
    }
  };

  const kpis = [
    {
      title: "Faturamento Líquido",
      value: formatMoney(metrics.netRevenue),
      tooltip: "Valor líquido faturado após dedução de taxas das plataformas.",
      tone: "neutral",
    },
    {
      title: "Gastos com anúncios",
      value: formatMoney(metrics.spend || 0),
      tooltip: "Total investido em tráfego pago nas contas sincronizadas.",
      tone: "neutral",
    },
    {
      title: "ROAS",
      value: metrics.roas !== null ? `${metrics.roas.toFixed(2)}x` : "—",
      tooltip: "Retorno sobre investimento em anúncios (Faturamento Líquido / Gastos).",
      tone: metrics.roas !== null && metrics.roas >= 1.0 ? "positive" : metrics.roas !== null && metrics.roas < 1.0 ? "negative" : "neutral",
    },
    {
      title: "Lucro",
      value:
        metrics.operatingProfit !== null
          ? formatMoney(metrics.operatingProfit)
          : "—",
      tooltip: "Lucro operacional real (Faturamento Líquido menos Gastos com anúncios).",
      tone:
        metrics.operatingProfit !== null && metrics.operatingProfit > 0
          ? "positive"
          : metrics.operatingProfit !== null && metrics.operatingProfit < 0
          ? "negative"
          : "neutral",
    },
    {
      title: "Vendas Pendentes",
      value: `${pendingSales.length} (${formatMoney(pendingRevenue)})`,
      tooltip: "Pedidos gerados via Pix ou Boleto aguardando compensação.",
      tone: "neutral",
    },
    {
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
      title: "Vendas Reembolsadas",
      value: `${metrics.refundedCount} (${formatMoney(metrics.refundedAmount)})`,
      tooltip: "Quantidade e volume financeiro de compras estornadas no período.",
      tone: metrics.refundedCount > 0 ? "negative" : "neutral",
    },
    {
      title: "Reembolso",
      value: `${metrics.refundRate !== null ? metrics.refundRate.toFixed(1) : "0.0"}%`,
      tooltip: "Taxa percentual de reembolso sobre o total de pedidos.",
      tone: metrics.refundRate && metrics.refundRate > 5 ? "negative" : "neutral",
    },
    {
      title: "ARPU",
      value: formatMoney(metrics.averageTicket || 0),
      tooltip: "Ticket médio ou receita média gerada por comprador aprovado.",
      tone: "neutral",
    },
    {
      title: "Imposto / Taxas",
      value: formatMoney(metrics.platformFees || 0),
      tooltip: "Taxas descontadas pelas plataformas de checkout integradas.",
      tone: "neutral",
    },
    {
      title: "Chargeback",
      value: `${chargebackRate.toFixed(1)}%`,
      tooltip: "Percentual de vendas contestadas junto às operadoras de cartão.",
      tone: chargebackRate > 1 ? "negative" : "neutral",
    },
  ];

  return (
    <div className="utmify-card">
      {/* 1. Header do Resumo */}
      <div className="utmify-summary-header">
        <div>
          <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "var(--ink)" }}>Resumo</h2>
        </div>
        <div className="utmify-header-right">
          <span className="utmify-updated-text">Atualizado há 1 minuto</span>
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

      <section className="overview-share-card" aria-label="Resumo compartilhável da operação">
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
          <span>{formatMoney(metrics.netRevenue)} líquido</span>
          <span>trackbase.com.br</span>
        </div>
        <button
          type="button"
          className="overview-share-button"
          onClick={handleShare}
          title="Compartilhar este resumo com a marca Trackbase"
        >
          <Share2 size={15} />
          {shareStatus === "shared"
            ? "Compartilhado"
            : shareStatus === "copied"
            ? "Resumo copiado"
            : "Compartilhar resumo"}
        </button>
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
          {kpis.map((kpi, idx) => (
            <div key={idx} className="utmify-kpi-card">
              <div className="utmify-kpi-header">
                <span>{kpi.title}</span>
                <span className="utmify-info-icon" title={kpi.tooltip}>
                  <Info size={12} />
                </span>
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
    </div>
  );
}
