"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
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
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import type { Entity, InsightRow, SaleRow, Integration, Offer, TrackingEvent } from "@/lib/types";
import { isApprovedSaleStatus } from "@/lib/sale-status";
import { convertCurrencyAmount } from "@/lib/currency";
import { resolveSaleAttribution } from "@/lib/attribution";

type EntityStatusTone = "success" | "muted" | "warning" | "info" | "danger";

type EntityStatusMeta = {
  label: string;
  tone: EntityStatusTone;
  color: string;
  description: string;
  toggleable: boolean;
};

type CampaignEntityKind = "campaign" | "adset" | "ad";

const ENTITY_STATUS_META: Record<string, EntityStatusMeta> = {
  ACTIVE: {
    label: "Veiculando",
    tone: "success",
    color: "#10B981",
    description: "Ativo na Meta e elegível para entrega.",
    toggleable: true,
  },
  PAUSED: {
    label: "Pausado",
    tone: "muted",
    color: "#94A3B8",
    description: "Pausado manualmente na Meta.",
    toggleable: true,
  },
  PENDING: {
    label: "Programado",
    tone: "info",
    color: "#3B82F6",
    description: "A Meta ainda não iniciou a veiculação.",
    toggleable: false,
  },
  SCHEDULED: {
    label: "Programado",
    tone: "info",
    color: "#3B82F6",
    description: "A data de início configurada na Meta ainda não chegou.",
    toggleable: false,
  },
  PENDING_REVIEW: {
    label: "Em análise",
    tone: "warning",
    color: "#F59E0B",
    description: "A Meta está revisando este anúncio.",
    toggleable: false,
  },
  IN_PROCESS: {
    label: "Processando",
    tone: "info",
    color: "#3B82F6",
    description: "A Meta está processando alterações.",
    toggleable: false,
  },
  PREAPPROVED: {
    label: "Aprovado",
    tone: "info",
    color: "#3B82F6",
    description: "Aprovado, aguardando as condições para entrega.",
    toggleable: false,
  },
  LEARNING: {
    label: "Em aprendizado",
    tone: "info",
    color: "#3B82F6",
    description: "A Meta ainda está aprendendo a otimizar a entrega.",
    toggleable: false,
  },
  LEARNING_LIMITED: {
    label: "Aprendizado limitado",
    tone: "warning",
    color: "#F59E0B",
    description: "A entrega está ativa, mas com aprendizado limitado.",
    toggleable: false,
  },
  CAMPAIGN_PAUSED: {
    label: "Campanha pausada",
    tone: "warning",
    color: "#F59E0B",
    description: "A campanha acima deste item está pausada.",
    toggleable: false,
  },
  ADSET_PAUSED: {
    label: "Conjunto pausado",
    tone: "warning",
    color: "#F59E0B",
    description: "O conjunto acima deste anúncio está pausado.",
    toggleable: false,
  },
  WITH_ISSUES: {
    label: "Com problemas",
    tone: "danger",
    color: "#EF4444",
    description: "A Meta sinalizou problemas que impedem a entrega.",
    toggleable: false,
  },
  DISAPPROVED: {
    label: "Reprovado",
    tone: "danger",
    color: "#EF4444",
    description: "Reprovado pela política da Meta.",
    toggleable: false,
  },
  PENDING_BILLING_INFO: {
    label: "Aguardando pagamento",
    tone: "warning",
    color: "#F59E0B",
    description: "A Meta aguarda informações de cobrança.",
    toggleable: false,
  },
  COMPLETED: {
    label: "Concluído",
    tone: "muted",
    color: "#64748B",
    description: "A veiculação foi concluída.",
    toggleable: false,
  },
  ARCHIVED: {
    label: "Arquivado",
    tone: "muted",
    color: "#64748B",
    description: "Arquivado na Meta.",
    toggleable: false,
  },
  DELETED: {
    label: "Excluído",
    tone: "danger",
    color: "#EF4444",
    description: "Excluído na Meta.",
    toggleable: false,
  },
  DISABLED: {
    label: "Desativado",
    tone: "muted",
    color: "#64748B",
    description: "Desativado na Meta.",
    toggleable: false,
  },
  ERROR: {
    label: "Erro",
    tone: "danger",
    color: "#EF4444",
    description: "A Meta retornou um erro para este item.",
    toggleable: false,
  },
};

function getEntityStatusMeta(status: string): EntityStatusMeta {
  const normalized = status.trim().toUpperCase();
  return ENTITY_STATUS_META[normalized] ?? {
    label: normalized
      ? normalized.replaceAll("_", " ").toLocaleLowerCase("pt-BR")
      : "Sem status",
    tone: "muted",
    color: "#94A3B8",
    description: "Status informado pela Meta, sem ação disponível no painel.",
    toggleable: false,
  };
}

function maskMetaId(id: string): string {
  if (id.length <= 6) return "••••";
  return `${id.slice(0, 3)}••••${id.slice(-4)}`;
}

function isEntityDelivering(status: string): boolean {
  return ["ACTIVE", "LEARNING", "LEARNING_LIMITED"].includes(status.trim().toUpperCase());
}

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
  ic: { label: "IC", defaultVisible: true, numeric: true, tooltip: "Inícios de checkout reportados pela Meta; cargas antigas usam o tracker." },
  profit: { label: "Lucro", defaultVisible: true, numeric: true, tooltip: "Comissão líquida menos gastos em anúncios" },
  cpi: { label: "CPI", defaultVisible: true, numeric: true, tooltip: "Custo por Início de Checkout" },
  roas: { label: "ROAS", defaultVisible: true, numeric: true, tooltip: "Retorno sobre o investimento em anúncios" },
  margin: { label: "Margem", defaultVisible: false, numeric: true, tooltip: "Margem de lucro líquida" },
  roi: { label: "ROI", defaultVisible: false, numeric: true, tooltip: "Retorno sobre o investimento total" },
  cpc: { label: "CPC", defaultVisible: false, numeric: true, tooltip: "Custo médio por clique" },
  ctr: { label: "CTR", defaultVisible: false, numeric: true, tooltip: "Taxa de cliques no anúncio" },
  cpm: { label: "CPM", defaultVisible: false, numeric: true, tooltip: "Custo por mil impressões" },
  clicks: { label: "Cliques no link", defaultVisible: false, numeric: true, tooltip: "Cliques no link registrados pela Meta; não inclui cliques totais em curtidas, comentários ou no perfil." },
  impressions: { label: "Impressões", defaultVisible: false, numeric: true },
};

export const COLUMN_PRESETS: Record<
  string,
  { label: string; icon: string; cols: Partial<Record<ColumnKey, boolean>> }
> = {
  desempenho: {
    label: "Desempenho",
    icon: "🎯",
    cols: {
      status: true,
      name: true,
      budget: true,
      sales: true,
      cpa: true,
      spend: true,
      revenue: true,
      roas: true,
      profit: true,
      ic: false,
      cpi: false,
      margin: false,
      roi: false,
      cpc: false,
      ctr: false,
      cpm: false,
      clicks: false,
      impressions: false,
    },
  },
  financeiro: {
    label: "Financeiro",
    icon: "💰",
    cols: {
      status: true,
      name: true,
      budget: false,
      spend: true,
      revenue: true,
      profit: true,
      margin: true,
      roi: true,
      roas: true,
      sales: true,
      cpa: true,
      ic: false,
      cpi: false,
      cpc: false,
      ctr: false,
      cpm: false,
      clicks: false,
      impressions: false,
    },
  },
  trafego: {
    label: "Tráfego & Anúncios",
    icon: "📊",
    cols: {
      status: true,
      name: true,
      budget: true,
      spend: true,
      impressions: true,
      clicks: true,
      ctr: true,
      cpc: true,
      cpm: true,
      ic: true,
      sales: true,
      cpa: true,
      revenue: false,
      profit: false,
      roas: false,
      margin: false,
      roi: false,
      cpi: false,
    },
  },
  completo: {
    label: "Todas as Colunas",
    icon: "✨",
    cols: {
      status: true,
      name: true,
      budget: true,
      sales: true,
      cpa: true,
      spend: true,
      revenue: true,
      ic: true,
      profit: true,
      cpi: true,
      roas: true,
      margin: true,
      roi: true,
      cpc: true,
      ctr: true,
      cpm: true,
      clicks: true,
      impressions: true,
    },
  },
};

export function CampaignsView({
  workspace,
  entities,
  insights = [],
  sales = [],
  events = [],
  offers = [],
  integrations = [],
  currency = "BRL",
  offerFilter = "all",
  changeCurrency,
  pending,
  period = "7",
  changePeriod,
  run,
  request,
  onRefresh,
  connect,
}: {
  workspace: string;
  entities: Entity[];
  insights?: InsightRow[];
  sales?: SaleRow[];
  events?: TrackingEvent[];
  offers?: Offer[];
  integrations?: Integration[];
  currency?: string;
  offerFilter?: string;
  changeCurrency?: (val: string) => void;
  pending: boolean;
  period?: string;
  changePeriod?: (val: string) => void;
  run: (fn: () => Promise<unknown>) => void;
  request: (path: string, data: unknown) => Promise<unknown>;
  onRefresh?: () => void;
  connect: () => void;
}) {
  const [kind, setKind] = useState<CampaignEntityKind>("campaign");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIntegration, setSelectedIntegration] = useState("all");
  const [selectedOffer, setSelectedOffer] = useState(offerFilter || "all");
  const [selectedCurrency, setSelectedCurrency] = useState<string>(currency || "BRL");
  const [selectedByKind, setSelectedByKind] = useState<Record<CampaignEntityKind, Set<string>>>(() => ({
    campaign: new Set<string>(),
    adset: new Set<string>(),
    ad: new Set<string>(),
  }));
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [showColPicker, setShowColPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [budgetEditor, setBudgetEditor] = useState<{ integration: string; id: string; kind: "campaign" | "adset"; name: string; amount: number | null; currency: string; type: "daily" | "lifetime" | null } | null>(null);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);
  const [activeModel, setActiveModel] = useState<string>("desempenho");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [autoRefreshStatus, setAutoRefreshStatus] = useState<"idle" | "syncing" | "error">("idle");
  const autoRefreshInFlight = useRef(false);
  const requestRef = useRef(request);
  const refreshRef = useRef(onRefresh);
  const pendingRef = useRef(pending);
  const selectedIds = selectedByKind[kind];
  const selectedCampaignIds = selectedByKind.campaign;
  const selectedAdsetIds = selectedByKind.adset;
  const latestMetaSync = integrations
    .filter((integration) => integration.provider === "meta" && integration.last_synced_at)
    .sort((a, b) => new Date(b.last_synced_at!).getTime() - new Date(a.last_synced_at!).getTime())[0]?.last_synced_at;

  useEffect(() => {
    if (currency) setSelectedCurrency(currency);
  }, [currency]);

  useEffect(() => {
    setSelectedOffer(offerFilter || "all");
  }, [offerFilter]);

  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Meta data changes throughout the day. Keep this view fresh while it is
  // open, but only sync a visible tab and never overlap a manual refresh.
  // The API limits each integration to two syncs per minute, so two minutes
  // gives a useful cadence without turning every open tab into a Meta poller.
  useEffect(() => {
    const metaTargets = integrations.filter(
      (integration) =>
        integration.provider === "meta" &&
        integration.status !== "token_expired" &&
        (selectedIntegration === "all" || integration.id === selectedIntegration),
    );
    if (!workspace || metaTargets.length === 0) return;

    let disposed = false;
    const syncInBackground = async () => {
      if (
        disposed ||
        document.visibilityState !== "visible" ||
        pendingRef.current ||
        autoRefreshInFlight.current
      ) {
        return;
      }

      autoRefreshInFlight.current = true;
      setAutoRefreshStatus("syncing");
      try {
        await Promise.all(
          metaTargets.map((integration) =>
            requestRef.current("/api/meta/sync", {
              workspace,
              integration: integration.id,
            }),
          ),
        );
        if (!disposed) {
          setAutoRefreshStatus("idle");
          refreshRef.current?.();
        }
      } catch {
        // Keep the last known snapshot on transient Meta/rate-limit failures;
        // the manual button remains available and exposes the real error.
        if (!disposed) setAutoRefreshStatus("error");
      } finally {
        autoRefreshInFlight.current = false;
      }
    };

    const interval = window.setInterval(syncInBackground, 120_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncInBackground();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [integrations, selectedIntegration, workspace]);

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
    const initial: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(DEFAULT_COLUMNS)) {
      initial[k] = v.defaultVisible;
    }
    return initial as Record<ColumnKey, boolean>;
  });

  // Carrega configuração de colunas e modelo salvo no navegador do usuário
  useEffect(() => {
    try {
      const savedCols = localStorage.getItem("trackbase_campaign_cols_v4");
      const savedModel = localStorage.getItem("trackbase_campaign_model_v4");
      if (savedCols) {
        const parsed = JSON.parse(savedCols);
        if (parsed && typeof parsed === "object") {
          setVisibleCols(parsed);
        }
      }
      if (savedModel) {
        setActiveModel(savedModel);
      }
    } catch {}
  }, []);

  const applyModel = (modelKey: string) => {
    setActiveModel(modelKey);
    let newCols: Record<ColumnKey, boolean>;

    if (modelKey === "custom") {
      try {
        const savedCustom = localStorage.getItem("trackbase_campaign_user_custom_cols");
        if (savedCustom) {
          newCols = JSON.parse(savedCustom);
        } else {
          newCols = { ...visibleCols };
        }
      } catch {
        newCols = { ...visibleCols };
      }
    } else if (COLUMN_PRESETS[modelKey]) {
      const preset = COLUMN_PRESETS[modelKey].cols;
      newCols = {} as Record<ColumnKey, boolean>;
      for (const colKey of Object.keys(DEFAULT_COLUMNS) as ColumnKey[]) {
        newCols[colKey] = Boolean(preset[colKey]);
      }
    } else {
      return;
    }

    setVisibleCols(newCols);
    try {
      localStorage.setItem("trackbase_campaign_cols_v4", JSON.stringify(newCols));
      localStorage.setItem("trackbase_campaign_model_v4", modelKey);
    } catch {}
  };

  const saveAsCustomModel = () => {
    try {
      localStorage.setItem("trackbase_campaign_user_custom_cols", JSON.stringify(visibleCols));
      localStorage.setItem("trackbase_campaign_cols_v4", JSON.stringify(visibleCols));
      localStorage.setItem("trackbase_campaign_model_v4", "custom");
      setActiveModel("custom");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2200);
    } catch {}
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleCols((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      setActiveModel("custom");
      try {
        localStorage.setItem("trackbase_campaign_cols_v4", JSON.stringify(next));
        localStorage.setItem("trackbase_campaign_model_v4", "custom");
      } catch {}
      return next;
    });
  };

  const setAllColumns = (val: boolean) => {
    const next = {} as Record<ColumnKey, boolean>;
    for (const k of Object.keys(DEFAULT_COLUMNS) as ColumnKey[]) {
      next[k] = val;
    }
    setVisibleCols(next);
    setActiveModel(val ? "completo" : "custom");
    try {
      localStorage.setItem("trackbase_campaign_cols_v4", JSON.stringify(next));
      localStorage.setItem("trackbase_campaign_model_v4", val ? "completo" : "custom");
    } catch {}
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

  const metricCurrency = selectedCurrency || "USD";

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
    const map = new Map<string, { spend: number; clicks: number; impressions: number; metaInitiateCheckouts: number | null }>();
    for (const ins of insights) {
      if (selectedIntegration !== "all" && ins.integration_id !== selectedIntegration) continue;
      const targetId =
        kind === "campaign"
          ? ins.campaign_id
          : kind === "adset"
          ? ins.adset_id
          : ins.ad_id;
      if (!targetId) continue;
      const key = `${ins.integration_id || ""}:${targetId}`;
      const current = map.get(key) || { spend: 0, clicks: 0, impressions: 0, metaInitiateCheckouts: null };
      current.spend +=
        convertCurrencyAmount(
          Number(ins.spend || 0),
          ins.currency,
          selectedCurrency,
          exchangeRates,
        ) ?? 0;
      current.clicks += Number(ins.clicks || 0);
      current.impressions += Number(ins.impressions || 0);
      if (ins.meta_initiate_checkouts !== null && ins.meta_initiate_checkouts !== undefined) {
        current.metaInitiateCheckouts =
          (current.metaInitiateCheckouts ?? 0) + Number(ins.meta_initiate_checkouts || 0);
      }
      map.set(key, current);
    }
    return map;
  }, [insights, kind, selectedCurrency, selectedIntegration, exchangeRates]);

  // A Hotmart pode entregar a venda sem UTMs, mas o checkout rastreado carrega
  // o SCK/XCOD da sessão. Reconstitui a atribuição somente quando existe um
  // vínculo determinístico; nunca atribui uma venda ao último checkout por
  // proximidade de horário.
  const resolvedSales = useMemo(() => {
    return sales.map((sale) => ({
      sale,
      attribution: resolveSaleAttribution(sale.attribution, events, sale.offer_id),
    }));
  }, [sales, events]);

  // 2. Agregação de vendas aprovadas e rastreadas pelas UTMs
  const salesMap = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number; netRevenue: number }>();
    for (const { sale, attribution } of resolvedSales) {
      if (sale.is_test || !isApprovedSaleStatus(sale.status)) continue;
      if (selectedOffer !== "all" && sale.offer_id !== selectedOffer) continue;
      const saleCurrency = (sale.currency || offers.find((offer) => offer.id === sale.offer_id)?.currency || "").toUpperCase();
      const targetId =
        kind === "campaign"
          ? attribution.utm_campaign
          : kind === "adset"
          ? attribution.utm_term
          : attribution.utm_content;
      if (!targetId) continue;
      const current = map.get(targetId) || { count: 0, revenue: 0, netRevenue: 0 };
      current.count += 1;
      current.revenue +=
        convertCurrencyAmount(
          Number(sale.gross_amount ?? sale.amount ?? 0),
          saleCurrency,
          selectedCurrency,
          exchangeRates,
        ) ?? 0;
      current.netRevenue +=
        convertCurrencyAmount(
          Number(sale.net_amount ?? sale.gross_amount ?? sale.amount ?? 0),
          sale.net_currency ?? saleCurrency,
          selectedCurrency,
          exchangeRates,
        ) ?? 0;
      map.set(targetId, current);
    }
    return map;
  }, [resolvedSales, kind, selectedOffer, selectedCurrency, offers, exchangeRates]);

  const unattributedSalesSummary = useMemo(() => {
    let count = 0;
    let revenue = 0;
    let netRevenue = 0;
    for (const { sale, attribution } of resolvedSales) {
      if (
        sale.is_test ||
        !isApprovedSaleStatus(sale.status) ||
        (selectedOffer !== "all" && sale.offer_id !== selectedOffer) ||
        attribution.utm_campaign ||
        attribution.utm_term ||
        attribution.utm_content
      ) {
        continue;
      }
      const saleCurrency = (sale.currency || offers.find((offer) => offer.id === sale.offer_id)?.currency || "").toUpperCase();
      count += 1;
      revenue += convertCurrencyAmount(
        Number(sale.gross_amount ?? sale.amount ?? 0),
        saleCurrency,
        selectedCurrency,
        exchangeRates,
      ) ?? 0;
      netRevenue += convertCurrencyAmount(
        Number(sale.net_amount ?? sale.gross_amount ?? sale.amount ?? 0),
        (sale.net_currency ?? saleCurrency).toUpperCase(),
        selectedCurrency,
        exchangeRates,
      ) ?? 0;
    }
    return { count, revenue, netRevenue };
  }, [resolvedSales, selectedOffer, offers, selectedCurrency, exchangeRates]);

  // Checkouts precisam ser eventos reais atribuídos ao mesmo identificador
  // usado pela entidade Meta. Nunca estime IC a partir de cliques: isso faz
  // o total da campanha divergir da soma dos anúncios.
  const checkoutMap = useMemo(() => {
    const map = new Map<string, number>();
    const countedSessions = new Set<string>();
    for (const event of events) {
      if (event.event_type !== "checkout") continue;
      if (selectedOffer !== "all" && event.offer_id !== selectedOffer) continue;
      const attr = event.attribution || {};
      const rawTargetId =
        kind === "campaign"
          ? attr.utm_campaign
          : kind === "adset"
            ? attr.utm_term
            : attr.utm_content;
      const targetId = typeof rawTargetId === "string" ? rawTargetId.trim() : "";
      if (!targetId || targetId.includes("{{")) continue;
      const sessionKey = event.session_id || event.id;
      if (countedSessions.has(sessionKey)) continue;
      countedSessions.add(sessionKey);
      map.set(targetId, (map.get(targetId) || 0) + 1);
    }
    return map;
  }, [events, kind, selectedOffer]);

  // A Meta mantém a árvore campanha → conjunto → anúncio. As seleções ficam
  // separadas por nível para que a seleção da campanha continue ativa ao
  // alternar para os filhos, sem misturar IDs de tipos diferentes.
  const adsetsForSelectedCampaigns = useMemo(() => {
    if (selectedCampaignIds.size === 0) return new Set<string>();
    return new Set(
      entities
        .filter(
          (entity) =>
            entity.kind === "adset" &&
            Boolean(entity.parent_id) &&
            selectedCampaignIds.has(entity.parent_id as string),
        )
        .map((entity) => entity.external_id),
    );
  }, [entities, selectedCampaignIds]);

  // 3. Filtragem das entidades
  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      if (e.kind !== kind) return false;
      if (selectedIntegration !== "all" && e.integration_id !== selectedIntegration)
        return false;
      if (
        kind === "adset" &&
        selectedCampaignIds.size > 0 &&
        !selectedCampaignIds.has(e.parent_id ?? "")
      )
        return false;
      if (
        kind === "ad" &&
        selectedAdsetIds.size > 0 &&
        !selectedAdsetIds.has(e.parent_id ?? "")
      )
        return false;
      if (
        kind === "ad" &&
        selectedAdsetIds.size === 0 &&
        selectedCampaignIds.size > 0 &&
        !adsetsForSelectedCampaigns.has(e.parent_id ?? "")
      )
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
  }, [
    entities,
    kind,
    selectedIntegration,
    selectedCampaignIds,
    selectedAdsetIds,
    adsetsForSelectedCampaigns,
    statusFilter,
    search,
  ]);

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
      const ins = insightsMap.get(`${e.integration_id}:${e.external_id}`) || insightsMap.get(`:${e.external_id}`) || {
        spend: 0,
        clicks: 0,
        impressions: 0,
        metaInitiateCheckouts: null,
      };
      const sls = salesMap.get(e.external_id) || { count: 0, revenue: 0, netRevenue: 0 };
      const profit = sls.netRevenue - ins.spend;
      const roas = ins.spend > 0 ? sls.revenue / ins.spend : null;
      const cpa = sls.count > 0 ? ins.spend / sls.count : null;
      const margin = sls.revenue > 0 ? (profit / sls.revenue) * 100 : null;
      const roi = ins.spend > 0 ? (profit / ins.spend) * 100 : null;
      const cpc = ins.clicks > 0 ? ins.spend / ins.clicks : null;
      const ctr =
        ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : null;
      const cpm =
        ins.impressions > 0 ? (ins.spend / ins.impressions) * 1000 : null;

      // Prefer the real InitiateCheckout action from Meta. Older insight rows
      // predate this field, so keep the tracked checkout as a compatibility
      // fallback until the next complete synchronization.
      const ic = ins.metaInitiateCheckouts !== null
        ? ins.metaInitiateCheckouts
        : checkoutMap.get(e.external_id) || 0;
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
  }, [filteredEntities, insightsMap, salesMap, checkoutMap, integrations]);

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

  // Mantém a venda visível nos totais mesmo quando a plataforma não enviou
  // nenhum identificador que permita colocá-la em uma campanha/anúncio.
  totalSales += unattributedSalesSummary.count;
  totalRevenue += unattributedSalesSummary.revenue;

  const totalNetRevenue = sortedRows.reduce((sum, row) => {
    const salesForRow = salesMap.get(row.entity.external_id);
    return sum + (salesForRow?.netRevenue || 0);
  }, unattributedSalesSummary.netRevenue);
  const totalProfit = totalNetRevenue - totalSpend;
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

  const toggleSelectRow = (id: string) => {
    setSelectedByKind((previous) => {
      const next = new Set(previous[kind]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (kind === "campaign") {
        return { ...previous, campaign: next, adset: new Set<string>(), ad: new Set<string>() };
      }
      if (kind === "adset") {
        return { ...previous, adset: next, ad: new Set<string>() };
      }
      return { ...previous, ad: next };
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedRows.length) {
      setSelectedByKind((previous) => {
        if (kind === "campaign") {
          return { ...previous, campaign: new Set<string>(), adset: new Set<string>(), ad: new Set<string>() };
        }
        if (kind === "adset") {
          return { ...previous, adset: new Set<string>(), ad: new Set<string>() };
        }
        return { ...previous, ad: new Set<string>() };
      });
    } else {
      const next = new Set(sortedRows.map((r) => r.entity.external_id));
      setSelectedByKind((previous) => {
        if (kind === "campaign") {
          return { ...previous, campaign: next, adset: new Set<string>(), ad: new Set<string>() };
        }
        if (kind === "adset") {
          return { ...previous, adset: next, ad: new Set<string>() };
        }
        return { ...previous, ad: next };
      });
    }
  };

  const toggleEntityStatus = (entity: Entity) => {
    const currentStatus = getEntityStatusMeta(entity.status);
    if (!currentStatus.toggleable) return;
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
            {selectedCampaignIds.size > 0 && kind === "campaign" && (
              <span
                className="utmify-selected-badge"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedByKind((previous) => ({
                    ...previous,
                    campaign: new Set<string>(),
                    adset: new Set<string>(),
                    ad: new Set<string>(),
                  }));
                }}
                title="Limpar seleção"
              >
                {selectedCampaignIds.size} selecionados <X size={11} />
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
              {selectedCampaignIds.size > 0
                ? `Conjuntos para ${selectedCampaignIds.size} ${selectedCampaignIds.size === 1 ? "campanha" : "campanhas"}`
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
              {selectedAdsetIds.size > 0
                ? `Anúncios para ${selectedAdsetIds.size} ${selectedAdsetIds.size === 1 ? "conjunto" : "conjuntos"}`
                : selectedCampaignIds.size > 0
                ? `Anúncios para ${selectedCampaignIds.size} ${selectedCampaignIds.size === 1 ? "campanha" : "campanhas"}`
                : `Anúncios`}
            </span>
            <span className="badge-count">{kindCounts.ad}</span>
          </button>
        </div>
      </div>

      {unattributedSalesSummary.count > 0 && (
        <div
          role="status"
          style={{
            margin: "0.75rem 0",
            padding: "0.75rem 0.9rem",
            border: "1px solid #FCD34D",
            borderRadius: "10px",
            background: "#FFFBEB",
            color: "#92400E",
            fontSize: "0.82rem",
          }}
        >
          <strong>{unattributedSalesSummary.count} venda(s) aprovada(s) sem atribuição de campanha.</strong>{" "}
          A plataforma recebeu a venda, mas o webhook não trouxe UTM/SCK/XCOD. Ela não é colocada em um criativo por aproximação para evitar atribuição falsa; quando o vínculo existir, a venda aparecerá no anúncio exato.
        </div>
      )}

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
                {/* Cabeçalho */}
                <div className="columns-picker-title">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Settings size={14} color="#2563EB" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--ink)" }}>
                      Modelos de Colunas
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowColPicker(false)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Fechar"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Seletor de Modelos / Presets */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "4px 0 8px" }}>
                  {Object.entries(COLUMN_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyModel(key)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "0.73rem",
                        fontWeight: 700,
                        border: activeModel === key ? "1px solid #2563EB" : "1px solid var(--line)",
                        background: activeModel === key ? "#2563EB" : "var(--surface-muted, #F8FAFC)",
                        color: activeModel === key ? "#FFFFFF" : "var(--ink)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {preset.icon} {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => applyModel("custom")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      fontSize: "0.73rem",
                      fontWeight: 700,
                      border: activeModel === "custom" ? "1px solid #5B34EA" : "1px solid var(--line)",
                      background: activeModel === "custom" ? "#5B34EA" : "var(--surface-muted, #F8FAFC)",
                      color: activeModel === "custom" ? "#FFFFFF" : "var(--ink)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    ⭐ Meu Modelo
                  </button>
                </div>

                {/* Sub-barra de Ações Rápidas */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", color: "var(--muted)", padding: "2px 2px 6px" }}>
                  <span>{Object.values(visibleCols).filter(Boolean).length} colunas ativas</span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => setAllColumns(true)}
                      style={{ background: "none", border: "none", color: "#2563EB", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: "0.72rem" }}
                    >
                      Marcar todas
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setAllColumns(false)}
                      style={{ background: "none", border: "none", color: "var(--muted)", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: "0.72rem" }}
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                {/* Lista de Colunas em Grid Elegante com Checkboxes */}
                <div className="columns-picker-list">
                  {(Object.keys(DEFAULT_COLUMNS) as ColumnKey[]).map((colKey) => {
                    const isChecked = Boolean(visibleCols[colKey]);
                    return (
                      <label
                        key={colKey}
                        className="columns-picker-item"
                        style={{
                          background: isChecked ? "rgba(37, 99, 235, 0.05)" : "transparent",
                          border: isChecked ? "1px solid rgba(37, 99, 235, 0.2)" : "1px solid transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleColumn(colKey)}
                        />
                        <span style={{ fontWeight: isChecked ? 700 : 500 }}>
                          {DEFAULT_COLUMNS[colKey].label}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Rodapé: Salvar Meu Modelo Padrão */}
                <div style={{ marginTop: "6px", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
                  <button
                    type="button"
                    onClick={saveAsCustomModel}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: saveSuccess ? "#10B981" : "#2563EB",
                      color: "#FFFFFF",
                      border: "none",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
                    }}
                  >
                    {saveSuccess ? <Check size={14} /> : <CheckCircle2 size={14} />}
                    <span>{saveSuccess ? "Modelo salvo como seu padrão!" : "Salvar como meu modelo padrão"}</span>
                  </button>
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
          <span
            className={`utmify-auto-refresh-status ${autoRefreshStatus}`}
            title="Enquanto esta aba estiver aberta, as campanhas são sincronizadas automaticamente a cada 2 minutos."
          >
            <span aria-hidden="true" className="utmify-auto-refresh-dot" />
            {autoRefreshStatus === "syncing"
              ? "Sincronizando..."
              : autoRefreshStatus === "error"
                ? "Auto indisponível"
                : "Auto · 2 min"}
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
            <option value="ACTIVE">Veiculando</option>
            <option value="PAUSED">Pausados</option>
            <option value="SCHEDULED">Programados</option>
            <option value="PENDING_REVIEW">Em análise</option>
            <option value="WITH_ISSUES">Com problemas</option>
            <option value="DISAPPROVED">Reprovados</option>
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
      {sortedRows.length > 0 ? (
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
                    className="campaign-status-cell th-sortable"
                    style={{ textAlign: "center" }}
                    onClick={() => handleSort("status")}
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
                      <span>Cliques no link</span>
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
                const statusMeta = getEntityStatusMeta(row.entity.status);
                const isIdRevealed = revealedIds.has(row.entity.external_id);
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
                      <td className="campaign-status-cell">
                        <div className="campaign-status-control">
                        <label
                          className={`utmify-toggle ${statusMeta.toggleable ? "" : "is-disabled"}`}
                          title={`${statusMeta.label}: ${statusMeta.description}`}
                        >
                          <input
                            type="checkbox"
                            checked={isEntityDelivering(row.entity.status)}
                            disabled={!statusMeta.toggleable || pending}
                            onChange={() => toggleEntityStatus(row.entity)}
                            aria-label={`${statusMeta.label}. ${statusMeta.toggleable ? "Alternar status" : "Status somente leitura"}`}
                          />
                          <span className="utmify-toggle-slider" />
                        </label>
                          <span
                            className={`campaign-status-badge campaign-status-${statusMeta.tone}`}
                            title={statusMeta.description}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Nome com Indicador de Status Colorido */}
                    {visibleCols.name && (
                      <td className="col-sticky-name">
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span
                            className="utmify-entity-indicator"
                            style={{
                              background: statusMeta.color,
                            }}
                            title={`${statusMeta.label}: ${statusMeta.description}`}
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
                            <div className="campaign-id-row">
                              <small
                                style={{
                                  color: "var(--muted, #9CA3AF)",
                                  fontSize: "0.72rem",
                                }}
                              >
                                ID: {isIdRevealed ? row.entity.external_id : maskMetaId(row.entity.external_id)}
                              </small>
                              <button
                                type="button"
                                className="campaign-id-toggle"
                                onClick={() => {
                                  setRevealedIds((previous) => {
                                    const next = new Set(previous);
                                    if (next.has(row.entity.external_id)) next.delete(row.entity.external_id);
                                    else next.add(row.entity.external_id);
                                    return next;
                                  });
                                }}
                                aria-label={isIdRevealed ? "Ocultar ID da Meta" : "Mostrar ID da Meta"}
                                title={isIdRevealed ? "Ocultar ID da Meta" : "Mostrar ID da Meta"}
                              >
                                {isIdRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>
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

                    {/* Cliques no link (não cliques totais) */}
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
