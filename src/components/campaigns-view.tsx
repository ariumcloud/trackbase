"use client";

import { useState } from "react";
import {
  BarChart3,
  Layers,
  Tag,
  Search,
  Columns,
  X,
  MousePointer2,
  ArrowRight,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from "lucide-react";
import type { Entity, InsightRow, SaleRow, Integration } from "@/lib/types";

export type ColumnKey =
  | "status"
  | "name"
  | "sales"
  | "cpa"
  | "spend"
  | "revenue"
  | "profit"
  | "roas"
  | "margin"
  | "roi"
  | "cpc"
  | "ctr"
  | "cpm"
  | "clicks"
  | "impressions";

export const DEFAULT_COLUMNS: Record<
  ColumnKey,
  { label: string; defaultVisible: boolean; numeric?: boolean }
> = {
  status: { label: "Status", defaultVisible: true, numeric: false },
  name: { label: "Identificação", defaultVisible: true, numeric: false },
  sales: { label: "Vendas", defaultVisible: true, numeric: true },
  cpa: { label: "CPA", defaultVisible: true, numeric: true },
  spend: { label: "Gastos", defaultVisible: true, numeric: true },
  revenue: { label: "Faturamento", defaultVisible: true, numeric: true },
  profit: { label: "Lucro", defaultVisible: true, numeric: true },
  roas: { label: "ROAS", defaultVisible: true, numeric: true },
  margin: { label: "Margem", defaultVisible: true, numeric: true },
  roi: { label: "ROI", defaultVisible: true, numeric: true },
  cpc: { label: "CPC", defaultVisible: true, numeric: true },
  ctr: { label: "CTR", defaultVisible: true, numeric: true },
  cpm: { label: "CPM", defaultVisible: true, numeric: true },
  clicks: { label: "Cliques", defaultVisible: false, numeric: true },
  impressions: { label: "Impressões", defaultVisible: false, numeric: true },
};

export function CampaignsView({
  entities,
  insights = [],
  sales = [],
  integrations = [],
  currency = "BRL",
  workspace,
  pending,
  period = "7",
  changePeriod,
  run,
  request,
  connect,
}: {
  entities: Entity[];
  insights?: InsightRow[];
  sales?: SaleRow[];
  integrations?: Integration[];
  currency?: string;
  workspace: string;
  pending: boolean;
  period?: string;
  changePeriod?: (val: string) => void;
  run: (fn: () => Promise<unknown>) => void;
  request: (path: string, data: unknown) => Promise<unknown>;
  connect: () => void;
}) {
  const [kind, setKind] = useState<"campaign" | "adset" | "ad">("campaign");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIntegration, setSelectedIntegration] = useState("all");
  const [showColPicker, setShowColPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Ordenação por colunas (crescente / decrescente)
  const [sortKey, setSortKey] = useState<ColumnKey | null>("profit");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Período personalizado
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("trackbase_campaign_cols_v2");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    const initial: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(DEFAULT_COLUMNS)) {
      initial[k] = v.defaultVisible;
    }
    return initial as Record<ColumnKey, boolean>;
  });

  const toggleColumn = (key: ColumnKey) => {
    setVisibleCols((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("trackbase_campaign_cols_v2", JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  const handleSort = (key: ColumnKey) => {
    if (sortKey === key) {
      if (sortOrder === "desc") {
        setSortOrder("asc");
      } else {
        setSortKey(null);
        setSortOrder("desc");
      }
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  // Moeda detectada dinamicamente da conta Meta / insights
  const detectedCurrency =
    insights.find((i) => i.currency)?.currency ||
    integrations.find((i) => i.provider === "meta" && i.currency)?.currency ||
    currency ||
    "BRL";

  // 1. Agregação de dados dos insights da Meta por ID (campanha, conjunto ou anúncio)
  const insightsMap = new Map<
    string,
    { spend: number; clicks: number; impressions: number }
  >();

  for (const ins of insights) {
    const targetId =
      kind === "campaign"
        ? ins.campaign_id
        : kind === "adset"
          ? ins.adset_id
          : ins.ad_id;
    if (!targetId) continue;
    const current = insightsMap.get(targetId) || {
      spend: 0,
      clicks: 0,
      impressions: 0,
    };
    current.spend += Number(ins.spend || 0);
    current.clicks += Number(ins.clicks || 0);
    current.impressions += Number(ins.impressions || 0);
    insightsMap.set(targetId, current);
  }

  // 2. Agregação de vendas pagas e rastreadas pelas UTMs salvas
  const salesMap = new Map<string, { count: number; revenue: number }>();
  for (const sale of sales) {
    if (sale.is_test || sale.status !== "approved") continue;
    const attr = sale.attribution || {};
    const targetId =
      kind === "campaign"
        ? attr.utm_campaign
        : kind === "adset"
          ? attr.utm_term
          : attr.utm_content;
    if (!targetId) continue;
    const current = salesMap.get(targetId) || { count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += Number(sale.amount || 0);
    salesMap.set(targetId, current);
  }

  // 3. Filtragem das linhas da entidade
  const filteredEntities = entities.filter((e) => {
    if (e.kind !== kind) return false;
    if (selectedIntegration !== "all" && e.integration_id !== selectedIntegration)
      return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (
      search &&
      !e.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      !e.external_id.includes(search)
    )
      return false;
    return true;
  });

  // 4. Mapeamento de métricas completas para ordenação
  interface RowData {
    entity: Entity;
    spend: number;
    clicks: number;
    impressions: number;
    salesCount: number;
    revenue: number;
    profit: number;
    roas: number | null;
    cpa: number | null;
    margin: number | null;
    roi: number | null;
    cpc: number | null;
    ctr: number | null;
    cpm: number | null;
  }

  const computedRows: RowData[] = filteredEntities.map((e) => {
    const ins = insightsMap.get(e.external_id) || {
      spend: 0,
      clicks: 0,
      impressions: 0,
    };
    const sls = salesMap.get(e.external_id) || { count: 0, revenue: 0 };
    const profit = sls.revenue - ins.spend;
    const roas = ins.spend > 0 ? sls.revenue / ins.spend : null;
    const cpa = sls.count > 0 ? ins.spend / sls.count : null;
    const margin = sls.revenue > 0 ? (profit / sls.revenue) * 100 : null;
    const roi = ins.spend > 0 ? (profit / ins.spend) * 100 : null;
    const cpc = ins.clicks > 0 ? ins.spend / ins.clicks : null;
    const ctr =
      ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : null;
    const cpm =
      ins.impressions > 0 ? (ins.spend / ins.impressions) * 1000 : null;

    return {
      entity: e,
      spend: ins.spend,
      clicks: ins.clicks,
      impressions: ins.impressions,
      salesCount: sls.count,
      revenue: sls.revenue,
      profit,
      roas,
      cpa,
      margin,
      roi,
      cpc,
      ctr,
      cpm,
    };
  });

  // 5. Ordenação dinâmica por coluna clicada
  if (sortKey) {
    computedRows.sort((a, b) => {
      let aVal = 0;
      let bVal = 0;
      switch (sortKey) {
        case "status":
          return sortOrder === "asc"
            ? a.entity.status.localeCompare(b.entity.status)
            : b.entity.status.localeCompare(a.entity.status);
        case "name":
          return sortOrder === "asc"
            ? a.entity.name.localeCompare(b.entity.name)
            : b.entity.name.localeCompare(a.entity.name);
        case "sales":
          aVal = a.salesCount;
          bVal = b.salesCount;
          break;
        case "spend":
          aVal = a.spend;
          bVal = b.spend;
          break;
        case "revenue":
          aVal = a.revenue;
          bVal = b.revenue;
          break;
        case "cpa":
          aVal = a.cpa ?? (sortOrder === "asc" ? Infinity : -Infinity);
          bVal = b.cpa ?? (sortOrder === "asc" ? Infinity : -Infinity);
          break;
        case "profit":
          aVal = a.profit;
          bVal = b.profit;
          break;
        case "roas":
          aVal = a.roas ?? -Infinity;
          bVal = b.roas ?? -Infinity;
          break;
        case "margin":
          aVal = a.margin ?? -Infinity;
          bVal = b.margin ?? -Infinity;
          break;
        case "roi":
          aVal = a.roi ?? -Infinity;
          bVal = b.roi ?? -Infinity;
          break;
        case "cpc":
          aVal = a.cpc ?? (sortOrder === "asc" ? Infinity : -Infinity);
          bVal = b.cpc ?? (sortOrder === "asc" ? Infinity : -Infinity);
          break;
        case "ctr":
          aVal = a.ctr ?? -Infinity;
          bVal = b.ctr ?? -Infinity;
          break;
        case "cpm":
          aVal = a.cpm ?? (sortOrder === "asc" ? Infinity : -Infinity);
          bVal = b.cpm ?? (sortOrder === "asc" ? Infinity : -Infinity);
          break;
        case "clicks":
          aVal = a.clicks;
          bVal = b.clicks;
          break;
        case "impressions":
          aVal = a.impressions;
          bVal = b.impressions;
          break;
      }
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  // Totais agregados
  let totalSales = 0;
  let totalSpend = 0;
  let totalRevenue = 0;
  let totalClicks = 0;
  let totalImpressions = 0;

  for (const row of computedRows) {
    totalSales += row.salesCount;
    totalSpend += row.spend;
    totalRevenue += row.revenue;
    totalClicks += row.clicks;
    totalImpressions += row.impressions;
  }

  const totalProfit = totalRevenue - totalSpend;
  const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const totalCpa = totalSales > 0 ? totalSpend / totalSales : null;
  const totalMargin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;
  const totalRoi = totalSpend > 0 ? (totalProfit / totalSpend) * 100 : null;
  const totalCpc = totalClicks > 0 ? totalSpend / totalClicks : null;
  const totalCtr =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
  const totalCpm =
    totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null;

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: detectedCurrency,
    }).format(val);
  };

  const kindCounts = {
    campaign: entities.filter((e) => e.kind === "campaign").length,
    adset: entities.filter((e) => e.kind === "adset").length,
    ad: entities.filter((e) => e.kind === "ad").length,
  };

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

  const applyCustomDates = () => {
    if (customStart && customEnd && changePeriod) {
      changePeriod(`${customStart}_${customEnd}`);
      setShowDatePicker(false);
    }
  };

  const renderSortIndicator = (col: ColumnKey) => {
    if (sortKey !== col) {
      return <ArrowUpDown size={11} className="sort-icon-idle" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp size={11} className="sort-icon-active" />
    ) : (
      <ArrowDown size={11} className="sort-icon-active" />
    );
  };

  return (
    <section className="campaigns-container">
      {/* Abas Superiores Meta */}
      <div className="campaign-tabs-header">
        {[
          { key: "campaign" as const, label: "Campanhas", icon: BarChart3 },
          { key: "adset" as const, label: "Conjuntos de Anúncios", icon: Layers },
          { key: "ad" as const, label: "Anúncios", icon: Tag },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = kind === tab.key;
          return (
            <button
              key={tab.key}
              className={`campaign-tab-btn ${isActive ? "active" : ""}`}
              onClick={() => setKind(tab.key)}
              type="button"
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              <span className="badge-count">{kindCounts[tab.key]}</span>
            </button>
          );
        })}

        <div className="campaign-tabs-header-right">
          <span className="currency-indicator" title={`Moeda de exibição: ${detectedCurrency}`}>
            {detectedCurrency}
          </span>
        </div>
      </div>

      {/* Barra de Filtros e Ferramentas */}
      <div className="campaign-toolbar">
        <div className="campaign-search-box">
          <Search size={15} />
          <input
            aria-label="Buscar campanha, conjunto ou anúncio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou ID..."
          />
        </div>

        <div className="campaign-toolbar-actions">
          {/* Seletor de Data Premium / Meta style com Personalizado */}
          {changePeriod && (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="campaign-btn-date"
                onClick={() => setShowDatePicker(!showDatePicker)}
              >
                <Calendar size={14} />
                <span>{getDateLabel()}</span>
                <ChevronDown size={13} />
              </button>

              {showDatePicker && (
                <div className="campaign-date-popover">
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
          )}

          {/* Filtro de Status Estilizado */}
          <div className="campaign-pill-select-wrap">
            <select
              className="campaign-select-styled"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="all">Status: Todos</option>
              <option value="ACTIVE">Apenas Ativos</option>
              <option value="PAUSED">Apenas Pausados</option>
            </select>
          </div>

          {/* Filtro de Contas / Integrações Meta se houver mais de uma */}
          {integrations.filter((i) => i.provider === "meta").length > 1 && (
            <div className="campaign-pill-select-wrap">
              <select
                className="campaign-select-styled"
                value={selectedIntegration}
                onChange={(e) => setSelectedIntegration(e.target.value)}
                aria-label="Filtrar por conta"
              >
                <option value="all">Todas as contas</option>
                {integrations
                  .filter((i) => i.provider === "meta")
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Botão de Personalização de Colunas */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="campaign-btn-tool"
              onClick={() => setShowColPicker(!showColPicker)}
            >
              <Columns size={14} />
              <span>Colunas</span>
            </button>

            {showColPicker && (
              <div className="columns-picker-popover">
                <div className="columns-picker-title">
                  <span>Colunas Visíveis</span>
                  <button
                    type="button"
                    onClick={() => setShowColPicker(false)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#9CA3AF",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
                {(Object.keys(DEFAULT_COLUMNS) as ColumnKey[]).map((colKey) => (
                  <label key={colKey} className="columns-picker-item">
                    <input
                      type="checkbox"
                      checked={Boolean(visibleCols[colKey])}
                      onChange={() => toggleColumn(colKey)}
                    />
                    <span>{DEFAULT_COLUMNS[colKey].label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Dados com Rolagem Horizontal Suave e Ordenação Interativa */}
      {computedRows.length > 0 ? (
        <div className="campaign-table-wrapper">
          <table className="campaign-table">
            <thead>
              <tr>
                {visibleCols.status && (
                  <th
                    style={{ width: "65px", textAlign: "center" }}
                    onClick={() => handleSort("status")}
                    className="th-sortable"
                  >
                    <div className="th-content-center">
                      <span>Status</span>
                      {renderSortIndicator("status")}
                    </div>
                  </th>
                )}
                {visibleCols.name && (
                  <th
                    className="col-sticky-name th-sortable"
                    onClick={() => handleSort("name")}
                  >
                    <div className="th-content">
                      <span>
                        {kind === "campaign"
                          ? "Campanha"
                          : kind === "adset"
                            ? "Conjunto"
                            : "Anúncio"}
                      </span>
                      {renderSortIndicator("name")}
                    </div>
                  </th>
                )}
                {visibleCols.sales && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("sales")}
                  >
                    <div className="th-content-right">
                      <span>Vendas</span>
                      {renderSortIndicator("sales")}
                    </div>
                  </th>
                )}
                {visibleCols.cpa && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("cpa")}
                  >
                    <div className="th-content-right">
                      <span>CPA</span>
                      {renderSortIndicator("cpa")}
                    </div>
                  </th>
                )}
                {visibleCols.spend && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("spend")}
                  >
                    <div className="th-content-right">
                      <span>Gastos</span>
                      {renderSortIndicator("spend")}
                    </div>
                  </th>
                )}
                {visibleCols.revenue && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("revenue")}
                  >
                    <div className="th-content-right">
                      <span>Faturamento</span>
                      {renderSortIndicator("revenue")}
                    </div>
                  </th>
                )}
                {visibleCols.profit && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("profit")}
                  >
                    <div className="th-content-right">
                      <span>Lucro</span>
                      {renderSortIndicator("profit")}
                    </div>
                  </th>
                )}
                {visibleCols.roas && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("roas")}
                  >
                    <div className="th-content-right">
                      <span>ROAS</span>
                      {renderSortIndicator("roas")}
                    </div>
                  </th>
                )}
                {visibleCols.margin && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("margin")}
                  >
                    <div className="th-content-right">
                      <span>Margem</span>
                      {renderSortIndicator("margin")}
                    </div>
                  </th>
                )}
                {visibleCols.roi && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("roi")}
                  >
                    <div className="th-content-right">
                      <span>ROI</span>
                      {renderSortIndicator("roi")}
                    </div>
                  </th>
                )}
                {visibleCols.cpc && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("cpc")}
                  >
                    <div className="th-content-right">
                      <span>CPC</span>
                      {renderSortIndicator("cpc")}
                    </div>
                  </th>
                )}
                {visibleCols.ctr && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("ctr")}
                  >
                    <div className="th-content-right">
                      <span>CTR</span>
                      {renderSortIndicator("ctr")}
                    </div>
                  </th>
                )}
                {visibleCols.cpm && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("cpm")}
                  >
                    <div className="th-content-right">
                      <span>CPM</span>
                      {renderSortIndicator("cpm")}
                    </div>
                  </th>
                )}
                {visibleCols.clicks && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("clicks")}
                  >
                    <div className="th-content-right">
                      <span>Cliques</span>
                      {renderSortIndicator("clicks")}
                    </div>
                  </th>
                )}
                {visibleCols.impressions && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("impressions")}
                  >
                    <div className="th-content-right">
                      <span>Impressões</span>
                      {renderSortIndicator("impressions")}
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {computedRows.map((row) => {
                const e = row.entity;
                const isActive = e.status === "ACTIVE";

                return (
                  <tr key={e.external_id}>
                    {visibleCols.status && (
                      <td style={{ textAlign: "center" }}>
                        <label
                          className="status-switch"
                          title={isActive ? "Clique para pausar" : "Clique para ativar"}
                        >
                          <input
                            type="checkbox"
                            checked={isActive}
                            disabled={pending}
                            onChange={() =>
                              run(() =>
                                request("/api/meta/status", {
                                  workspace,
                                  integration: e.integration_id,
                                  id: e.external_id,
                                  status: isActive ? "PAUSED" : "ACTIVE",
                                }),
                              )
                            }
                          />
                          <span className="status-slider" />
                        </label>
                      </td>
                    )}

                    {visibleCols.name && (
                      <td className="col-sticky-name">
                        <div className="campaign-name-cell">
                          <strong title={e.name}>{e.name}</strong>
                          <small>ID: {e.external_id}</small>
                        </div>
                      </td>
                    )}

                    {visibleCols.sales && (
                      <td
                        style={{ textAlign: "right" }}
                        className={row.salesCount > 0 ? "metric-val-highlight" : ""}
                      >
                        {row.salesCount}
                      </td>
                    )}

                    {visibleCols.cpa && (
                      <td style={{ textAlign: "right" }}>
                        {row.cpa !== null ? formatMoney(row.cpa) : "N/A"}
                      </td>
                    )}

                    {visibleCols.spend && (
                      <td style={{ textAlign: "right" }}>
                        {formatMoney(row.spend)}
                      </td>
                    )}

                    {visibleCols.revenue && (
                      <td style={{ textAlign: "right" }}>
                        {formatMoney(row.revenue)}
                      </td>
                    )}

                    {visibleCols.profit && (
                      <td
                        style={{ textAlign: "right" }}
                        className={
                          row.profit > 0
                            ? "metric-val-positive"
                            : row.profit < 0
                              ? "metric-val-negative"
                              : ""
                        }
                      >
                        {formatMoney(row.profit)}
                      </td>
                    )}

                    {visibleCols.roas && (
                      <td
                        style={{ textAlign: "right" }}
                        className={
                          row.roas !== null && row.roas >= 1.5
                            ? "metric-val-positive"
                            : row.roas !== null && row.roas < 1
                              ? "metric-val-negative"
                              : ""
                        }
                      >
                        {row.roas !== null ? `${row.roas.toFixed(2)}x` : "0.00x"}
                      </td>
                    )}

                    {visibleCols.margin && (
                      <td
                        style={{ textAlign: "right" }}
                        className={
                          row.margin !== null && row.margin > 0
                            ? "metric-val-positive"
                            : row.margin !== null && row.margin < 0
                              ? "metric-val-negative"
                              : ""
                        }
                      >
                        {row.margin !== null ? `${row.margin.toFixed(1)}%` : "N/A"}
                      </td>
                    )}

                    {visibleCols.roi && (
                      <td
                        style={{ textAlign: "right" }}
                        className={
                          row.roi !== null && row.roi > 0
                            ? "metric-val-positive"
                            : row.roi !== null && row.roi < 0
                              ? "metric-val-negative"
                              : ""
                        }
                      >
                        {row.roi !== null ? `${row.roi.toFixed(1)}%` : "N/A"}
                      </td>
                    )}

                    {visibleCols.cpc && (
                      <td style={{ textAlign: "right" }}>
                        {row.cpc !== null ? formatMoney(row.cpc) : "N/A"}
                      </td>
                    )}

                    {visibleCols.ctr && (
                      <td style={{ textAlign: "right" }}>
                        {row.ctr !== null ? `${row.ctr.toFixed(2)}%` : "0.00%"}
                      </td>
                    )}

                    {visibleCols.cpm && (
                      <td style={{ textAlign: "right" }}>
                        {row.cpm !== null ? formatMoney(row.cpm) : "N/A"}
                      </td>
                    )}

                    {visibleCols.clicks && (
                      <td style={{ textAlign: "right" }}>
                        {new Intl.NumberFormat("pt-BR").format(row.clicks)}
                      </td>
                    )}

                    {visibleCols.impressions && (
                      <td style={{ textAlign: "right" }}>
                        {new Intl.NumberFormat("pt-BR").format(row.impressions)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>

            {/* Linha de Totalização Agregada Fixada/Flutuante */}
            <tfoot>
              <tr>
                {visibleCols.status && (
                  <td style={{ textAlign: "center" }}>-</td>
                )}
                {visibleCols.name && (
                  <td className="col-sticky-name">
                    <strong>TOTAL ({computedRows.length})</strong>
                  </td>
                )}
                {visibleCols.sales && (
                  <td
                    style={{ textAlign: "right" }}
                    className={totalSales > 0 ? "metric-val-highlight" : ""}
                  >
                    {totalSales}
                  </td>
                )}
                {visibleCols.cpa && (
                  <td style={{ textAlign: "right" }}>
                    {totalCpa !== null ? formatMoney(totalCpa) : "N/A"}
                  </td>
                )}
                {visibleCols.spend && (
                  <td style={{ textAlign: "right" }}>
                    {formatMoney(totalSpend)}
                  </td>
                )}
                {visibleCols.revenue && (
                  <td style={{ textAlign: "right" }}>
                    {formatMoney(totalRevenue)}
                  </td>
                )}
                {visibleCols.profit && (
                  <td
                    style={{ textAlign: "right" }}
                    className={
                      totalProfit > 0
                        ? "metric-val-positive"
                        : totalProfit < 0
                          ? "metric-val-negative"
                          : ""
                    }
                  >
                    {formatMoney(totalProfit)}
                  </td>
                )}
                {visibleCols.roas && (
                  <td
                    style={{ textAlign: "right" }}
                    className={
                      totalRoas !== null && totalRoas >= 1.5
                        ? "metric-val-positive"
                        : totalRoas !== null && totalRoas < 1
                          ? "metric-val-negative"
                          : ""
                    }
                  >
                    {totalRoas !== null ? `${totalRoas.toFixed(2)}x` : "0.00x"}
                  </td>
                )}
                {visibleCols.margin && (
                  <td
                    style={{ textAlign: "right" }}
                    className={
                      totalMargin !== null && totalMargin > 0
                        ? "metric-val-positive"
                        : totalMargin !== null && totalMargin < 0
                          ? "metric-val-negative"
                          : ""
                    }
                  >
                    {totalMargin !== null ? `${totalMargin.toFixed(1)}%` : "N/A"}
                  </td>
                )}
                {visibleCols.roi && (
                  <td
                    style={{ textAlign: "right" }}
                    className={
                      totalRoi !== null && totalRoi > 0
                        ? "metric-val-positive"
                        : totalRoi !== null && totalRoi < 0
                          ? "metric-val-negative"
                          : ""
                    }
                  >
                    {totalRoi !== null ? `${totalRoi.toFixed(1)}%` : "N/A"}
                  </td>
                )}
                {visibleCols.cpc && (
                  <td style={{ textAlign: "right" }}>
                    {totalCpc !== null ? formatMoney(totalCpc) : "N/A"}
                  </td>
                )}
                {visibleCols.ctr && (
                  <td style={{ textAlign: "right" }}>
                    {totalCtr !== null ? `${totalCtr.toFixed(2)}%` : "0.00%"}
                  </td>
                )}
                {visibleCols.cpm && (
                  <td style={{ textAlign: "right" }}>
                    {totalCpm !== null ? formatMoney(totalCpm) : "N/A"}
                  </td>
                )}
                {visibleCols.clicks && (
                  <td style={{ textAlign: "right" }}>
                    {new Intl.NumberFormat("pt-BR").format(totalClicks)}
                  </td>
                )}
                {visibleCols.impressions && (
                  <td style={{ textAlign: "right" }}>
                    {new Intl.NumberFormat("pt-BR").format(totalImpressions)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div style={{ padding: "40px 20px" }}>
          <Empty
            icon={MousePointer2}
            title={
              entities.length
                ? "Nenhum resultado neste filtro"
                : "Seus anúncios entram em cena aqui."
            }
            description="Conecte uma conta Meta e sincronize para ver campanhas, conjuntos e anúncios com todas as métricas detalhadas."
            action={
              <button className="button" onClick={connect}>
                Ir para integrações <ArrowRight size={15} />
              </button>
            }
          />
        </div>
      )}
    </section>
  );
}

function Empty({
  icon: Icon = MousePointer2,
  title,
  description,
  action,
}: {
  icon?: typeof MousePointer2;
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
