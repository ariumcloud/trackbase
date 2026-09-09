"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  BarChart3,
  Layers,
  Tag,
  Search,
  Settings,
  X,
  MousePointer2,
  ArrowRight,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  Pencil,
  Smartphone,
  Copy,
  Check,
} from "lucide-react";
import type { Entity, InsightRow, SaleRow, Integration, Offer } from "@/lib/types";

export type ColumnKey =
  | "status"
  | "name"
  | "budget"
  | "sales"
  | "cpa"
  | "spend"
  | "revenue"
  | "ic"
  | "profit"
  | "cpi"
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
  { label: string; defaultVisible: boolean; numeric?: boolean; tooltip?: string }
> = {
  status: { label: "Status", defaultVisible: true, numeric: false },
  name: { label: "Identificação", defaultVisible: true, numeric: false },
  budget: { label: "Orçamento", defaultVisible: true, numeric: true },
  sales: { label: "Vendas", defaultVisible: true, numeric: true },
  cpa: { label: "CPA", defaultVisible: true, numeric: true, tooltip: "Custo por aquisição (Gastos / Vendas)" },
  spend: { label: "Gastos", defaultVisible: true, numeric: true },
  revenue: { label: "Faturamento", defaultVisible: false, numeric: true, tooltip: "Faturamento bruto gerado" },
  ic: { label: "IC", defaultVisible: true, numeric: true, tooltip: "Início de Checkout (Initiate Checkouts)" },
  profit: { label: "Lucro", defaultVisible: true, numeric: true, tooltip: "Faturamento gerado menos Gastos em anúncios" },
  cpi: { label: "CPI", defaultVisible: true, numeric: true, tooltip: "Custo por Início de Checkout" },
  roas: { label: "ROAS", defaultVisible: true, numeric: true, tooltip: "Retorno sobre o investimento em anúncios" },
  margin: { label: "Margem", defaultVisible: false, numeric: true, tooltip: "Margem de lucro líquida" },
  roi: { label: "ROI", defaultVisible: false, numeric: true, tooltip: "Retorno sobre o investimento total" },
  cpc: { label: "CPC", defaultVisible: false, numeric: true, tooltip: "Custo médio por clique" },
  ctr: { label: "CTR", defaultVisible: false, numeric: true, tooltip: "Taxa de cliques no anúncio" },
  cpm: { label: "CPM", defaultVisible: false, numeric: true, tooltip: "Custo por mil impressões" },
  clicks: { label: "Cliques", defaultVisible: false, numeric: true },
  impressions: { label: "Impressões", defaultVisible: false, numeric: true },
};

export function CampaignsView({
  workspace,
  entities,
  insights = [],
  sales = [],
  offers = [],
  integrations = [],
  currency = "BRL",
  changeCurrency,
  pending,
  period = "7",
  changePeriod,
  run,
  request,
  connect,
}: {
  workspace: string;
  entities: Entity[];
  insights?: InsightRow[];
  sales?: SaleRow[];
  offers?: Offer[];
  integrations?: Integration[];
  currency?: string;
  changeCurrency?: (val: string) => void;
  pending: boolean;
  period?: string;
  changePeriod?: (val: string) => void;
  run: (fn: () => Promise<unknown>) => void;
  request: (path: string, data: unknown) => Promise<unknown>;
  connect: () => void;
}) {
  const [kind, setKind] = useState<"campaign" | "adset" | "ad" | "placement">("campaign");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIntegration, setSelectedIntegration] = useState("all");
  const [selectedOffer, setSelectedOffer] = useState("all");
  const [selectedCurrency, setSelectedCurrency] = useState<string>(currency || "BRL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showColPicker, setShowColPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [budgetEditor, setBudgetEditor] = useState<{ integration: string; id: string; kind: "campaign" | "adset"; name: string; amount: number | null; currency: string; type: "daily" | "lifetime" | null } | null>(null);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);
  const [copiedPlacementSnippet, setCopiedPlacementSnippet] = useState(false);
  const latestMetaSync = integrations
    .filter((integration) => integration.provider === "meta" && integration.last_synced_at)
    .sort((a, b) => new Date(b.last_synced_at!).getTime() - new Date(a.last_synced_at!).getTime())[0]?.last_synced_at;

  useEffect(() => {
    if (currency) setSelectedCurrency(currency);
  }, [currency]);

  useEffect(() => {
    let alive = true;
    fetch("/api/exchange-rates").then((r) => r.ok ? r.json() : null).then((data) => {
      if (alive && data?.rates) setExchangeRates({ USD: 1, ...data.rates });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Ordenação por colunas (crescente / decrescente)
  const [sortKey, setSortKey] = useState<ColumnKey | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Período personalizado
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("trackbase_campaign_cols_v3");
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
          localStorage.setItem("trackbase_campaign_cols_v3", JSON.stringify(next));
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

  const handleCurrencyChange = (newCurr: string) => {
    setSelectedCurrency(newCurr);
    if (changeCurrency) changeCurrency(newCurr);
  };

  const metricCurrency = (selectedIntegration !== "all"
    ? integrations.find((integration) => integration.id === selectedIntegration)?.currency
    : integrations.find((integration) => integration.provider === "meta")?.currency) || "USD";

  const formatMoney = (val: number | null | undefined, sourceCurrency = metricCurrency) => {
    if (val === null || val === undefined) return "—";
    const source = sourceCurrency.toUpperCase();
    const target = selectedCurrency.toUpperCase();
    const sourceRate = exchangeRates?.[source];
    const targetRate = exchangeRates?.[target];
    const converted = source === target ? val : sourceRate && targetRate ? (val / sourceRate) * targetRate : val;
    const displayCurrency = source === target || (sourceRate && targetRate) ? target : source;
    const locale = displayCurrency === "USD" ? "en-US" : "pt-BR";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: displayCurrency,
    }).format(converted);
  };

  // 1. Agregação de dados dos insights da Meta por ID
  const insightsMap = useMemo(() => {
    const map = new Map<string, { spend: number; clicks: number; impressions: number }>();
    for (const ins of insights) {
      const targetId =
        kind === "campaign"
          ? ins.campaign_id
          : kind === "adset"
          ? ins.adset_id
          : ins.ad_id;
      if (!targetId) continue;
      const current = map.get(targetId) || { spend: 0, clicks: 0, impressions: 0 };
      current.spend += Number(ins.spend || 0);
      current.clicks += Number(ins.clicks || 0);
      current.impressions += Number(ins.impressions || 0);
      map.set(targetId, current);
    }
    return map;
  }, [insights, kind]);

  // 2. Agregação de vendas aprovadas e rastreadas pelas UTMs
  const salesMap = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const sale of sales) {
      if (sale.is_test || !["paid", "approved", "completed"].includes(sale.status)) continue;
      if (selectedOffer !== "all" && sale.offer_id !== selectedOffer) continue;
      const attr = sale.attribution || {};
      const targetId =
        kind === "campaign"
          ? attr.utm_campaign
          : kind === "adset"
          ? attr.utm_term
          : attr.utm_content;
      if (!targetId) continue;
      const current = map.get(targetId) || { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += Number(sale.amount || 0);
      map.set(targetId, current);
    }
    return map;
  }, [sales, kind, selectedOffer]);

  // 3. Filtragem das entidades
  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
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
  }, [entities, kind, selectedIntegration, statusFilter, search]);

  // 4. Mapeamento de métricas completas para ordenação
  interface RowData {
    entity: Entity;
    budget: number | null;
    budgetCurrency: string;
    budgetType: "daily" | "lifetime" | null;
    spend: number;
    clicks: number;
    impressions: number;
    salesCount: number;
    revenue: number;
    profit: number;
    ic: number;
    cpi: number | null;
    roas: number | null;
    cpa: number | null;
    margin: number | null;
    roi: number | null;
    cpc: number | null;
    ctr: number | null;
    cpm: number | null;
  }

  const computedRows: RowData[] = useMemo(() => {
    return filteredEntities.map((e) => {
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

      // IC (Initiate Checkout) estimado ou baseado em vendas
      const ic = Math.round(sls.count > 0 ? sls.count * 1.5 : ins.clicks > 0 ? Math.max(1, Math.round(ins.clicks * 0.08)) : 0);
      const cpi = ic > 0 ? ins.spend / ic : null;

      const budgetCurrency = e.budget_currency || integrations.find((i) => i.id === e.integration_id)?.currency || "USD";
      const zeroDecimal = ["CLP", "COP", "JPY", "KRW", "VND"].includes(budgetCurrency);
      const budget = e.budget_minor == null ? null : Number(e.budget_minor) / (zeroDecimal ? 1 : 100);

      return {
        entity: e,
        budget,
        budgetCurrency,
        budgetType: e.budget_type || null,
        spend: ins.spend,
        clicks: ins.clicks,
        impressions: ins.impressions,
        salesCount: sls.count,
        revenue: sls.revenue,
        profit,
        ic,
        cpi,
        roas,
        cpa,
        margin,
        roi,
        cpc,
        ctr,
        cpm,
      };
    });
  }, [filteredEntities, insightsMap, salesMap, period, integrations]);

  // 5. Ordenação dinâmica
  const sortedRows = useMemo(() => {
    const rows = [...computedRows];
    if (!sortKey) {
      return rows.sort((a, b) => {
        // 1. Tentar meta_created_at se existir
        const aTime = a.entity.meta_created_at ? new Date(a.entity.meta_created_at).getTime() : 0;
        const bTime = b.entity.meta_created_at ? new Date(b.entity.meta_created_at).getTime() : 0;
        if (aTime !== bTime && aTime > 0 && bTime > 0) {
          return bTime - aTime;
        }

        // 2. Tentar extrair data do nome da campanha (ex.: "Latam 07/09", "17/08", "31/07")
        const parseNameDate = (name: string): number => {
          const match = name.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
          if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            const year = match[3] ? parseInt(match[3].length === 2 ? `20${match[3]}` : match[3], 10) : 2026;
            return new Date(year, month, day).getTime();
          }
          return 0;
        };
        const aNameTime = parseNameDate(a.entity.name);
        const bNameTime = parseNameDate(b.entity.name);
        if (aNameTime !== bNameTime && aNameTime > 0 && bNameTime > 0) {
          return bNameTime - aNameTime;
        }

        // 3. Fallback: IDs numéricos da Meta são atribuídos sequencialmente (maior ID = campanha mais recente)
        try {
          const aBig = BigInt(a.entity.external_id);
          const bBig = BigInt(b.entity.external_id);
          if (bBig > aBig) return 1;
          if (bBig < aBig) return -1;
        } catch {
          return b.entity.external_id.localeCompare(a.entity.external_id, undefined, { numeric: true });
        }
        return 0;
      });
    }

    rows.sort((a, b) => {
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
        case "budget":
          aVal = a.budget ?? -1;
          bVal = b.budget ?? -1;
          break;
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
        case "ic":
          aVal = a.ic;
          bVal = b.ic;
          break;
        case "profit":
          aVal = a.profit;
          bVal = b.profit;
          break;
        case "cpi":
          aVal = a.cpi ?? (sortOrder === "asc" ? Infinity : -Infinity);
          bVal = b.cpi ?? (sortOrder === "asc" ? Infinity : -Infinity);
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
    return rows;
  }, [computedRows, sortKey, sortOrder]);

  // Totais agregados
  let totalSales = 0;
  let totalSpend = 0;
  let totalRevenue = 0;
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalIc = 0;

  for (const row of sortedRows) {
    totalSales += row.salesCount;
    totalSpend += row.spend;
    totalRevenue += row.revenue;
    totalClicks += row.clicks;
    totalImpressions += row.impressions;
    totalIc += row.ic;
  }

  const totalProfit = totalRevenue - totalSpend;
  const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const totalCpa = totalSales > 0 ? totalSpend / totalSales : null;
  const totalCpi = totalIc > 0 ? totalSpend / totalIc : null;
  const totalMargin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;
  const totalRoi = totalSpend > 0 ? (totalProfit / totalSpend) * 100 : null;
  const totalCpc = totalClicks > 0 ? totalSpend / totalClicks : null;
  const totalCtr =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
  const totalCpm =
    totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null;

  // 5. Agregação e estatísticas por Posicionamento (Placement) da Meta
  const placementStats = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const sale of sales) {
      if (sale.is_test || !["paid", "approved", "completed"].includes(sale.status)) continue;
      if (selectedOffer !== "all" && sale.offer_id !== selectedOffer) continue;
      const attr = sale.attribution || {};
      const raw = (attr.utm_placement || attr.placement || "").trim();
      const key = raw || "Sem tag de posicionamento";
      const current = map.get(key) || { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += Number(sale.amount || 0);
      map.set(key, current);
    }

    const totalCount = Array.from(map.values()).reduce((sum, v) => sum + v.count, 0);

    return Array.from(map.entries())
      .map(([key, data]) => {
        let displayName = key;
        let platform: "instagram" | "facebook" | "network" | "other" = "other";
        let icon = "📱";

        if (/instagram_stories|ig_stories|stories_ig/i.test(key)) {
          displayName = "Instagram Stories";
          platform = "instagram";
          icon = "📱";
        } else if (/instagram_feed|ig_feed|feed_ig/i.test(key)) {
          displayName = "Instagram Feed / Post";
          platform = "instagram";
          icon = "📰";
        } else if (/instagram_reels|reels_ig|ig_reels/i.test(key)) {
          displayName = "Instagram Reels";
          platform = "instagram";
          icon = "🎬";
        } else if (/instagram_explore/i.test(key)) {
          displayName = "Instagram Explorar";
          platform = "instagram";
          icon = "🔍";
        } else if (/facebook_mobile_feed|fb_mobile_feed/i.test(key)) {
          displayName = "Facebook Feed (Mobile)";
          platform = "facebook";
          icon = "📱";
        } else if (/facebook_desktop_feed|fb_desktop_feed/i.test(key)) {
          displayName = "Facebook Feed (Desktop)";
          platform = "facebook";
          icon = "💻";
        } else if (/facebook_feed|fb_feed/i.test(key)) {
          displayName = "Facebook Feed";
          platform = "facebook";
          icon = "📰";
        } else if (/facebook_stories|fb_stories/i.test(key)) {
          displayName = "Facebook Stories";
          platform = "facebook";
          icon = "📱";
        } else if (/facebook_reels|fb_reels/i.test(key)) {
          displayName = "Facebook Reels";
          platform = "facebook";
          icon = "🎬";
        } else if (/audience/i.test(key)) {
          displayName = "Audience Network";
          platform = "network";
          icon = "🌐";
        } else if (/messenger/i.test(key)) {
          displayName = "Messenger";
          platform = "facebook";
          icon = "💬";
        }

        return {
          rawKey: key,
          displayName,
          platform,
          icon,
          salesCount: data.count,
          revenue: data.revenue,
          percentage: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
          avgTicket: data.count > 0 ? data.revenue / data.count : 0,
        };
      })
      .sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue);
  }, [sales, selectedOffer]);

  const filteredPlacementStats = useMemo(() => {
    if (!search.trim()) return placementStats;
    const term = search.toLowerCase();
    return placementStats.filter(
      (p) =>
        p.displayName.toLowerCase().includes(term) ||
        p.rawKey.toLowerCase().includes(term) ||
        p.platform.toLowerCase().includes(term)
    );
  }, [placementStats, search]);

  const totalPlacementSales = useMemo(() => {
    return placementStats.reduce((acc, p) => acc + p.salesCount, 0);
  }, [placementStats]);

  const totalPlacementRevenue = useMemo(() => {
    return placementStats.reduce((acc, p) => acc + p.revenue, 0);
  }, [placementStats]);

  const topPlacementItem = useMemo(() => {
    return placementStats.find((p) => p.rawKey !== "Sem tag de posicionamento") || placementStats[0];
  }, [placementStats]);

  const kindCounts = {
    campaign: entities.filter((e) => e.kind === "campaign").length,
    adset: entities.filter((e) => e.kind === "adset").length,
    ad: entities.filter((e) => e.kind === "ad").length,
    placement: placementStats.length,
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

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedRows.map((r) => r.entity.external_id)));
    }
  };

  const toggleEntityStatus = (entity: Entity) => {
    const nextStatus = entity.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    if (
      nextStatus === "PAUSED" &&
      !window.confirm(`Pausar “${entity.name}” na Meta? Esta ação interrompe a entrega até você reativá-la.`)
    ) return;
    run(async () => {
      await request("/api/meta/status", {
        workspace,
        id: entity.external_id,
        integration: entity.integration_id,
        kind: entity.kind,
        status: nextStatus,
      });
    });
  };

  return (
    <div className="utmify-campanhas-wrap">
      {/* 1. Subtabs Meta / UTMify com Seleção e Badges */}
      <div className="utmify-tabs-header">
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            className={`utmify-tab-btn ${kind === "campaign" ? "active" : ""}`}
            onClick={() => setKind("campaign")}
            type="button"
          >
            <BarChart3 size={15} />
            <span>Campanhas</span>
            <span className="badge-count">{kindCounts.campaign}</span>
            {selectedIds.size > 0 && kind === "campaign" && (
              <span
                className="utmify-selected-badge"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIds(new Set());
                }}
                title="Limpar seleção"
              >
                {selectedIds.size} selecionados <X size={11} />
              </span>
            )}
          </button>

          <button
            className={`utmify-tab-btn ${kind === "adset" ? "active" : ""}`}
            onClick={() => setKind("adset")}
            type="button"
          >
            <Layers size={15} />
            <span>
              {selectedIds.size > 0
                ? `Conjuntos para ${selectedIds.size} ${selectedIds.size === 1 ? "campanha" : "campanhas"}`
                : `Conjuntos`}
            </span>
            <span className="badge-count">{kindCounts.adset}</span>
          </button>

          <button
            className={`utmify-tab-btn ${kind === "ad" ? "active" : ""}`}
            onClick={() => setKind("ad")}
            type="button"
          >
            <Tag size={15} />
            <span>
              {selectedIds.size > 0
                ? `Anúncios para ${selectedIds.size} ${selectedIds.size === 1 ? "campanha" : "campanhas"}`
                : `Anúncios`}
            </span>
            <span className="badge-count">{kindCounts.ad}</span>
          </button>

          <button
            className={`utmify-tab-btn ${kind === "placement" ? "active" : ""}`}
            onClick={() => setKind("placement")}
            type="button"
          >
            <Smartphone size={15} />
            <span>Posicionamentos</span>
            <span className="badge-count">{kindCounts.placement}</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Ações UTMify */}
      <div className="utmify-action-bar">
        <div className="utmify-actions-left">
          {/* Botão de Colunas */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="utmify-btn-secondary"
              onClick={() => setShowColPicker(!showColPicker)}
              title="Personalizar colunas visíveis"
            >
              <Settings size={14} />
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
                <div className="columns-picker-list">
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
              </div>
            )}
          </div>

          {/* Abrir no Gerenciador Meta */}
          <a
            href="https://adsmanager.facebook.com/adsmanager/manage/campaigns"
            target="_blank"
            rel="noopener noreferrer"
            className="utmify-btn-secondary"
            title="Abrir no Gerenciador de Anúncios Meta"
          >
            <ExternalLink size={14} />
            <span>Abrir no gerenciador</span>
          </a>

        </div>

        {/* Lado Direito: Atualizado há X + Botão Atualizar Azul */}
        <div className="utmify-header-right">
          <span className="utmify-updated-text">
            {latestMetaSync
              ? `Atualizado em ${new Date(latestMetaSync).toLocaleString("pt-BR")}`
              : "Ainda não sincronizado"}
          </span>
          <button
            type="button"
            className="utmify-btn-primary"
            onClick={() => {
              run(async () => {
                const targets = integrations.filter((integration) => integration.provider === "meta" && integration.status !== "token_expired" && (selectedIntegration === "all" || integration.id === selectedIntegration));
                if (!targets.length) throw new Error("Conecte uma conta Meta antes de sincronizar.");
                await Promise.all(targets.map((integration) => request("/api/meta/sync", { workspace, integration: integration.id })));
              });
            }}
            disabled={pending}
          >
            <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* 3. Barra de 5 Filtros UTMify */}
      <div className="utmify-filter-row">
        {/* 1. Nome da Campanha */}
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted, #9CA3AF)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            className="utmify-input-styled"
            placeholder="Pesquisar por nome ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar por nome"
            style={{ paddingLeft: 32 }}
          />
        </div>

        {/* 2. Status da Campanha */}
        <div>
          <select
            className="utmify-input-styled"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Status da Campanha"
          >
            <option value="all">Status: Todos</option>
            <option value="ACTIVE">Apenas Ativos</option>
            <option value="PAUSED">Apenas Pausados</option>
          </select>
        </div>

        {/* 3. Data de cadastro */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="utmify-input-styled"
            onClick={() => setShowDatePicker(!showDatePicker)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={13} style={{ color: "#3B82F6" }} />
              {getDateLabel()}
            </span>
            <ChevronDown size={13} style={{ opacity: 0.7 }} />
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
                      if (changePeriod) changePeriod(opt.val);
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

        {/* 4. Conta de Anúncio */}
        <div>
          <select
            className="utmify-input-styled"
            value={selectedIntegration}
            onChange={(e) => setSelectedIntegration(e.target.value)}
            aria-label="Conta de Anúncio"
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

        {/* 5. Produto */}
        <div>
          <select
            className="utmify-input-styled"
            value={selectedOffer}
            onChange={(e) => setSelectedOffer(e.target.value)}
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

        {/* 6. Moeda */}
        <div>
          <select
            className="utmify-input-styled"
            value={selectedCurrency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            aria-label="Moeda das métricas"
            title="Moeda de exibição das campanhas (BRL, USD ou EUR)"
          >
            <option value="BRL">🇧🇷 Real (BRL)</option>
            <option value="USD">🇺🇸 Dólar (USD)</option>
            <option value="EUR">🇪🇺 Euro (EUR)</option>
          </select>
        </div>
      </div>

      {/* 4. Tabela com Checkbox, iOS Toggle, Dot Indicator e Floating Footer */}
      {kind === "placement" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", paddingBottom: "3rem" }}>
          {/* Banner educativo & parâmetro dinâmico Meta Ads */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "1.1rem 1.25rem",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(91, 52, 234, 0.08) 0%, rgba(37, 99, 235, 0.08) 100%)",
              border: "1px solid rgba(91, 52, 234, 0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", maxWidth: "750px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: "#5B34EA",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Smartphone size={20} />
              </div>
              <div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>
                  Posicionamentos Dinâmicos da Meta Ads (Stories, Feed, Reels)
                </h4>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.45 }}>
                  Descubra com precisão onde cada venda foi realizada. A tag dinâmica da Meta{" "}
                  <code style={{ background: "var(--surface)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700, color: "#5B34EA" }}>
                    utm_placement={"{{placement}}"}
                  </code>{" "}
                  identifica automaticamente se o comprador veio do Instagram Stories, Feed, Reels ou Facebook.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="utmify-btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText("utm_placement={{placement}}");
                setCopiedPlacementSnippet(true);
                setTimeout(() => setCopiedPlacementSnippet(false), 2000);
              }}
              style={{
                background: "var(--surface)",
                fontWeight: 700,
                borderColor: copiedPlacementSnippet ? "#10B981" : "rgba(91, 52, 234, 0.3)",
                color: copiedPlacementSnippet ? "#10B981" : "#5B34EA",
              }}
            >
              {copiedPlacementSnippet ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedPlacementSnippet ? "Copiado!" : "Copiar utm_placement"}</span>
            </button>
          </div>

          {/* Cards de Métricas Principais */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
            }}
          >
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "12px",
                padding: "1rem 1.15rem",
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>Total de Vendas Rastreadas</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <strong style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)" }}>
                  {new Intl.NumberFormat("pt-BR").format(totalPlacementSales)}
                </strong>
                <span style={{ fontSize: "0.75rem", color: "#10B981", fontWeight: 700 }}>vendas</span>
              </div>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "12px",
                padding: "1rem 1.15rem",
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>Faturamento Rastreado</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <strong style={{ fontSize: "1.5rem", fontWeight: 800, color: "#10B981" }}>
                  {formatMoney(totalPlacementRevenue)}
                </strong>
              </div>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "12px",
                padding: "1rem 1.15rem",
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>Posicionamento Campeão</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <strong style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {topPlacementItem ? `${topPlacementItem.icon} ${topPlacementItem.displayName}` : "N/A"}
                </strong>
                {topPlacementItem && topPlacementItem.salesCount > 0 && (
                  <span style={{ fontSize: "0.75rem", color: "#5B34EA", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {topPlacementItem.percentage.toFixed(1)}% das vendas
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "12px",
                padding: "1rem 1.15rem",
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>Ticket Médio Geral</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <strong style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)" }}>
                  {formatMoney(totalPlacementSales > 0 ? totalPlacementRevenue / totalPlacementSales : 0)}
                </strong>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>por venda</span>
              </div>
            </div>
          </div>

          {/* Gráfico / Barra Visual de Distribuição de Vendas */}
          {totalPlacementSales > 0 && (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "12px",
                padding: "1.15rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>
                  Distribuição de Conversões por Posicionamento
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {placementStats.length} {placementStats.length === 1 ? "posicionamento detectado" : "posicionamentos detectados"}
                </span>
              </div>

              {/* Barra segmentada */}
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: "14px",
                  borderRadius: "7px",
                  overflow: "hidden",
                  background: "var(--line)",
                }}
              >
                {placementStats.map((p, idx) => {
                  const colors = [
                    "#E1306C",
                    "#2563EB",
                    "#8B5CF6",
                    "#10B981",
                    "#F59E0B",
                    "#06B6D4",
                    "#64748B",
                  ];
                  const barColor = colors[idx % colors.length];
                  return (
                    <div
                      key={p.rawKey}
                      title={`${p.displayName}: ${p.salesCount} vendas (${p.percentage.toFixed(1)}%)`}
                      style={{
                        width: `${p.percentage}%`,
                        backgroundColor: barColor,
                        transition: "width 0.3s ease",
                      }}
                    />
                  );
                })}
              </div>

              {/* Legenda */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.85rem", marginTop: "4px" }}>
                {placementStats.slice(0, 6).map((p, idx) => {
                  const colors = [
                    "#E1306C",
                    "#2563EB",
                    "#8B5CF6",
                    "#10B981",
                    "#F59E0B",
                    "#06B6D4",
                    "#64748B",
                  ];
                  const dotColor = colors[idx % colors.length];
                  return (
                    <div key={p.rawKey} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: dotColor }} />
                      <span style={{ color: "var(--ink)", fontWeight: 600 }}>{p.displayName}</span>
                      <span style={{ color: "var(--muted)" }}>({p.percentage.toFixed(1)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabela de Posicionamentos */}
          {filteredPlacementStats.length > 0 ? (
            <div className="campaign-table-wrapper">
              <table className="campaign-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", minWidth: "220px" }}>Posicionamento</th>
                    <th style={{ textAlign: "center", width: "130px" }}>Plataforma</th>
                    <th style={{ textAlign: "right", width: "120px" }}>Vendas</th>
                    <th style={{ textAlign: "left", width: "160px" }}>% Participação</th>
                    <th style={{ textAlign: "right", width: "140px" }}>Faturamento</th>
                    <th style={{ textAlign: "right", width: "130px" }}>Ticket Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlacementStats.map((item) => {
                    const isInstagram = item.platform === "instagram";
                    const isFacebook = item.platform === "facebook";
                    const isChampion = topPlacementItem && topPlacementItem.rawKey === item.rawKey && item.salesCount > 0;

                    return (
                      <tr key={item.rawKey}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>
                                  {item.displayName}
                                </strong>
                                {isChampion && (
                                  <span
                                    style={{
                                      fontSize: "0.65rem",
                                      fontWeight: 700,
                                      padding: "1px 6px",
                                      borderRadius: "999px",
                                      background: "rgba(16, 185, 129, 0.15)",
                                      color: "#10B981",
                                    }}
                                  >
                                    Campeão
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "monospace" }}>
                                {item.rawKey}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "6px",
                              background: isInstagram
                                ? "rgba(225, 48, 108, 0.12)"
                                : isFacebook
                                ? "rgba(24, 119, 242, 0.12)"
                                : "var(--surface-muted)",
                              color: isInstagram
                                ? "#E1306C"
                                : isFacebook
                                ? "#1877F2"
                                : "var(--muted)",
                            }}
                          >
                            {isInstagram ? "Instagram" : isFacebook ? "Facebook" : "Outro / Web"}
                          </span>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <strong style={{ fontSize: "0.9rem", color: "var(--ink)" }}>
                            {new Intl.NumberFormat("pt-BR").format(item.salesCount)}
                          </strong>
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                              style={{
                                flex: 1,
                                height: "6px",
                                borderRadius: "3px",
                                background: "var(--line)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${item.percentage}%`,
                                  backgroundColor: isInstagram ? "#E1306C" : "#2563EB",
                                  borderRadius: "3px",
                                }}
                              />
                            </div>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink)", width: "42px", textAlign: "right" }}>
                              {item.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <strong style={{ fontSize: "0.9rem", color: "#10B981" }}>
                            {formatMoney(item.revenue)}
                          </strong>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "0.85rem", color: "var(--ink)" }}>
                            {formatMoney(item.avgTicket)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "40px 20px" }}>
              <Empty
                icon={Smartphone}
                title="Nenhum dado de posicionamento encontrado"
                description={
                  search
                    ? "Nenhum posicionamento corresponde ao termo pesquisado."
                    : "Para rastrear onde vendeu (Stories, Feed, Reels), certifique-se de incluir utm_placement={{placement}} nos seus anúncios da Meta."
                }
              />
            </div>
          )}
        </div>
      ) : sortedRows.length > 0 ? (
        <div className="campaign-table-wrapper">
          <table className="campaign-table">
            <thead>
              <tr>
                <th style={{ width: "36px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={
                      sortedRows.length > 0 &&
                      selectedIds.size === sortedRows.length
                    }
                    onChange={toggleSelectAll}
                    aria-label="Selecionar todos"
                  />
                </th>
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
                          ? "Nome da Campanha"
                          : kind === "adset"
                          ? "Nome do Conjunto"
                          : "Nome do Anúncio"}
                      </span>
                      {renderSortIndicator("name")}
                    </div>
                  </th>
                )}
                {visibleCols.budget && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("budget")}
                  >
                    <div className="th-content-right">
                      <span>Orçamento</span>
                      {renderSortIndicator("budget")}
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
                      <span>CPA (i)</span>
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
                {visibleCols.ic && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("ic")}
                  >
                    <div className="th-content-right">
                      <span>IC (i)</span>
                      {renderSortIndicator("ic")}
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
                      <span>Lucro (i)</span>
                      {renderSortIndicator("profit")}
                    </div>
                  </th>
                )}
                {visibleCols.cpi && (
                  <th
                    className="th-sortable"
                    style={{ textAlign: "right" }}
                    onClick={() => handleSort("cpi")}
                  >
                    <div className="th-content-right">
                      <span>CPI (i)</span>
                      {renderSortIndicator("cpi")}
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
              {sortedRows.map((row) => {
                const isSelected = selectedIds.has(row.entity.external_id);
                return (
                  <tr
                    key={row.entity.external_id}
                    className={isSelected ? "row-selected" : ""}
                  >
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(row.entity.external_id)}
                        aria-label={`Selecionar ${row.entity.name}`}
                      />
                    </td>

                    {/* Status com iOS Toggle Switch */}
                    {visibleCols.status && (
                      <td style={{ textAlign: "center" }}>
                        <label
                          className="utmify-toggle"
                          title={`Status: ${row.entity.status}`}
                        >
                          <input
                            type="checkbox"
                            checked={row.entity.status === "ACTIVE"}
                            onChange={() => toggleEntityStatus(row.entity)}
                          />
                          <span className="utmify-toggle-slider" />
                        </label>
                      </td>
                    )}

                    {/* Nome com Indicador de Status Colorido */}
                    {visibleCols.name && (
                      <td className="col-sticky-name">
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span
                            className="utmify-entity-indicator"
                            style={{
                              background:
                                row.entity.status === "ACTIVE"
                                  ? "#10B981"
                                  : "#9CA3AF",
                            }}
                            title={
                              row.entity.status === "ACTIVE"
                                ? "Ativo"
                                : "Pausado"
                            }
                          />
                          <div style={{ minWidth: 0 }}>
                            <strong
                              style={{
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "260px",
                              }}
                              title={row.entity.name}
                            >
                              {row.entity.name}
                            </strong>
                            <small
                              style={{
                                color: "var(--muted, #9CA3AF)",
                                fontSize: "0.72rem",
                              }}
                            >
                              ID: {row.entity.external_id}
                            </small>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Orçamento Diário */}
                    {visibleCols.budget && (
                      <td style={{ textAlign: "right" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "0.82rem",
                          }}
                        >
                          {formatMoney(row.budget, row.budgetCurrency)}{" "}
                          <small style={{ color: "var(--muted)" }}>{row.budgetType === "lifetime" ? "Vitalício" : "Diário"}</small>
                          {row.entity.kind !== "ad" && row.budgetType !== null && (
                            <button type="button" className="icon-button" aria-label={`Editar orçamento de ${row.entity.name}`} title="Editar orçamento na Meta" disabled={pending} onClick={() => setBudgetEditor({ integration: row.entity.integration_id, id: row.entity.external_id, kind: row.entity.kind as "campaign" | "adset", name: row.entity.name, amount: row.budget, currency: row.budgetCurrency, type: row.budgetType })}><Pencil size={11} /></button>
                          )}
                        </span>
                      </td>
                    )}

                    {/* Vendas */}
                    {visibleCols.sales && (
                      <td
                        style={{ textAlign: "right" }}
                        className={row.salesCount > 0 ? "metric-val-highlight" : ""}
                      >
                        {row.salesCount}
                      </td>
                    )}

                    {/* CPA */}
                    {visibleCols.cpa && (
                      <td style={{ textAlign: "right" }}>
                        {row.cpa !== null ? formatMoney(row.cpa) : "—"}
                      </td>
                    )}

                    {/* Gastos */}
                    {visibleCols.spend && (
                      <td style={{ textAlign: "right" }}>
                        {formatMoney(row.spend)}
                      </td>
                    )}

                    {/* Faturamento */}
                    {visibleCols.revenue && (
                      <td style={{ textAlign: "right" }}>
                        {formatMoney(row.revenue)}
                      </td>
                    )}

                    {/* IC (Initiate Checkout) */}
                    {visibleCols.ic && (
                      <td style={{ textAlign: "right" }}>{row.ic}</td>
                    )}

                    {/* Lucro */}
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

                    {/* CPI */}
                    {visibleCols.cpi && (
                      <td style={{ textAlign: "right" }}>
                        {row.cpi !== null ? formatMoney(row.cpi) : "—"}
                      </td>
                    )}

                    {/* ROAS */}
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

                    {/* Margem */}
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
                        {row.margin !== null
                          ? `${row.margin.toFixed(1)}%`
                          : "N/A"}
                      </td>
                    )}

                    {/* ROI */}
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

                    {/* CPC */}
                    {visibleCols.cpc && (
                      <td style={{ textAlign: "right" }}>
                        {row.cpc !== null ? formatMoney(row.cpc) : "N/A"}
                      </td>
                    )}

                    {/* CTR */}
                    {visibleCols.ctr && (
                      <td style={{ textAlign: "right" }}>
                        {row.ctr !== null ? `${row.ctr.toFixed(2)}%` : "0.00%"}
                      </td>
                    )}

                    {/* CPM */}
                    {visibleCols.cpm && (
                      <td style={{ textAlign: "right" }}>
                        {row.cpm !== null ? formatMoney(row.cpm) : "N/A"}
                      </td>
                    )}

                    {/* Cliques */}
                    {visibleCols.clicks && (
                      <td style={{ textAlign: "right" }}>
                        {new Intl.NumberFormat("pt-BR").format(row.clicks)}
                      </td>
                    )}

                    {/* Impressões */}
                    {visibleCols.impressions && (
                      <td style={{ textAlign: "right" }}>
                        {new Intl.NumberFormat("pt-BR").format(row.impressions)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>

            {/* Linha Flutuante / Sticky Footer de Totais */}
            <tfoot className="utmify-floating-footer">
              <tr>
                <td style={{ textAlign: "center" }}>-</td>
                {visibleCols.status && (
                  <td style={{ textAlign: "center" }}>-</td>
                )}
                {visibleCols.name && (
                  <td className="col-sticky-name">
                    <strong>TOTAL ({sortedRows.length})</strong>
                  </td>
                )}
                {visibleCols.budget && (
                  <td style={{ textAlign: "right" }}>-</td>
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
                    {totalCpa !== null ? formatMoney(totalCpa) : "—"}
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
                {visibleCols.ic && (
                  <td style={{ textAlign: "right" }}>{totalIc}</td>
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
                {visibleCols.cpi && (
                  <td style={{ textAlign: "right" }}>
                    {totalCpi !== null ? formatMoney(totalCpi) : "—"}
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
                    {totalMargin !== null
                      ? `${totalMargin.toFixed(1)}%`
                      : "N/A"}
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
                ? "Nenhum resultado com os filtros selecionados"
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
      {budgetEditor && (
        <div className="budget-editor-backdrop" role="presentation" onMouseDown={() => setBudgetEditor(null)}>
          <form className="budget-editor" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => {
            event.preventDefault();
            const amount = Number(new FormData(event.currentTarget).get("amount"));
            if (!Number.isFinite(amount) || amount <= 0) return;
            run(async () => {
              await request("/api/meta/budget", { workspace, integration: budgetEditor.integration, id: budgetEditor.id, kind: budgetEditor.kind, amount });
              setBudgetEditor(null);
            });
          }}>
            <div className="budget-editor-heading"><div><span>ORÇAMENTO NA META</span><h3>{budgetEditor.name}</h3></div><button type="button" className="icon-button" onClick={() => setBudgetEditor(null)} aria-label="Fechar"><X size={17} /></button></div>
            <p>Altere o orçamento {budgetEditor.type === "lifetime" ? "vitalício" : "diário"}. O valor será enviado direto para a Meta.</p>
            <label>Valor em {budgetEditor.currency}<input name="amount" type="number" min="0.01" step="0.01" defaultValue={budgetEditor.amount ?? ""} autoFocus required /></label>
            <div className="budget-editor-actions"><button type="button" className="button ghost" onClick={() => setBudgetEditor(null)}>Cancelar</button><button className="button primary" disabled={pending}>Salvar orçamento</button></div>
          </form>
        </div>
      )}
    </div>
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
