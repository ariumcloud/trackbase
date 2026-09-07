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
} from "lucide-react";
import type { Entity, InsightRow, SaleRow, Integration } from "@/lib/types";

export type ColumnKey =
  | "status"
  | "name"
  | "sales"
  | "spend"
  | "revenue"
  | "cpa"
  | "profit"
  | "roas"
  | "margin"
  | "roi"
  | "cpc"
  | "ctr"
  | "clicks"
  | "impressions";

export const DEFAULT_COLUMNS: Record<
  ColumnKey,
  { label: string; defaultVisible: boolean }
> = {
  status: { label: "Status", defaultVisible: true },
  name: { label: "Identificação", defaultVisible: true },
  sales: { label: "Vendas", defaultVisible: true },
  cpa: { label: "CPA", defaultVisible: true },
  spend: { label: "Gastos", defaultVisible: true },
  revenue: { label: "Faturamento", defaultVisible: true },
  profit: { label: "Lucro", defaultVisible: true },
  roas: { label: "ROAS", defaultVisible: true },
  margin: { label: "Margem", defaultVisible: true },
  roi: { label: "ROI", defaultVisible: true },
  cpc: { label: "CPC", defaultVisible: true },
  ctr: { label: "CTR", defaultVisible: true },
  clicks: { label: "Cliques", defaultVisible: false },
  impressions: { label: "Impressões", defaultVisible: false },
};

export function CampaignsView({
  entities,
  insights = [],
  sales = [],
  integrations = [],
  currency = "BRL",
  workspace,
  pending,
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
  run: (fn: () => Promise<unknown>) => void;
  request: (path: string, data: unknown) => Promise<unknown>;
  connect: () => void;
}) {
  const [kind, setKind] = useState<"campaign" | "adset" | "ad">("campaign");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIntegration, setSelectedIntegration] = useState("all");
  const [showColPicker, setShowColPicker] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("trackbase_campaign_cols");
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
          localStorage.setItem("trackbase_campaign_cols", JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

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
  const rows = entities.filter((e) => {
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

  // Totais agregados no rodapé
  let totalSales = 0;
  let totalSpend = 0;
  let totalRevenue = 0;
  let totalClicks = 0;
  let totalImpressions = 0;

  for (const row of rows) {
    const ins = insightsMap.get(row.external_id) || {
      spend: 0,
      clicks: 0,
      impressions: 0,
    };
    const sls = salesMap.get(row.external_id) || { count: 0, revenue: 0 };
    totalSales += sls.count;
    totalSpend += ins.spend;
    totalRevenue += sls.revenue;
    totalClicks += ins.clicks;
    totalImpressions += ins.impressions;
  }

  const totalProfit = totalRevenue - totalSpend;
  const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const totalCpa = totalSales > 0 ? totalSpend / totalSales : null;
  const totalMargin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;
  const totalRoi =
    totalSpend > 0 ? (totalProfit / totalSpend) * 100 : null;
  const totalCpc = totalClicks > 0 ? totalSpend / totalClicks : null;
  const totalCtr =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
    }).format(val);
  };

  const kindCounts = {
    campaign: entities.filter((e) => e.kind === "campaign").length,
    adset: entities.filter((e) => e.kind === "adset").length,
    ad: entities.filter((e) => e.kind === "ad").length,
  };

  return (
    <section className="campaigns-container">
      {/* Abas Superiores Estilizadas */}
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
              <Icon size={16} />
              <span>{tab.label}</span>
              <span className="badge-count">{kindCounts[tab.key]}</span>
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros e Ferramentas */}
      <div className="campaign-toolbar">
        <div className="campaign-search-box">
          <Search size={16} />
          <input
            aria-label="Buscar campanha, conjunto ou anúncio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou ID..."
          />
        </div>

        <div className="campaign-toolbar-actions">
          {/* Filtro de Status */}
          <select
            className="campaign-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar por status"
          >
            <option value="all">Status: Qualquer</option>
            <option value="ACTIVE">Ativo</option>
            <option value="PAUSED">Pausado</option>
          </select>

          {/* Filtro de Contas / Integrações Meta se houver mais de uma */}
          {integrations.filter((i) => i.provider === "meta").length > 1 && (
            <select
              className="campaign-select"
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
          )}

          {/* Botão de Personalização de Colunas */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="campaign-btn-tool"
              onClick={() => setShowColPicker(!showColPicker)}
            >
              <Columns size={15} />
              <span>Personalizar Colunas</span>
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

      {/* Tabela de Dados com Rolagem Horizontal Suave */}
      {rows.length > 0 ? (
        <div className="campaign-table-wrapper">
          <table className="campaign-table">
            <thead>
              <tr>
                {visibleCols.status && (
                  <th style={{ width: "70px", textAlign: "center" }}>Status</th>
                )}
                {visibleCols.name && (
                  <th className="col-sticky-name">
                    {kind === "campaign"
                      ? "Campanha"
                      : kind === "adset"
                        ? "Conjunto"
                        : "Anúncio"}
                  </th>
                )}
                {visibleCols.sales && <th style={{ textAlign: "right" }}>Vendas</th>}
                {visibleCols.cpa && <th style={{ textAlign: "right" }}>CPA</th>}
                {visibleCols.spend && <th style={{ textAlign: "right" }}>Gastos</th>}
                {visibleCols.revenue && (
                  <th style={{ textAlign: "right" }}>Faturamento</th>
                )}
                {visibleCols.profit && <th style={{ textAlign: "right" }}>Lucro</th>}
                {visibleCols.roas && <th style={{ textAlign: "right" }}>ROAS</th>}
                {visibleCols.margin && <th style={{ textAlign: "right" }}>Margem</th>}
                {visibleCols.roi && <th style={{ textAlign: "right" }}>ROI</th>}
                {visibleCols.cpc && <th style={{ textAlign: "right" }}>CPC</th>}
                {visibleCols.ctr && <th style={{ textAlign: "right" }}>CTR</th>}
                {visibleCols.clicks && <th style={{ textAlign: "right" }}>Cliques</th>}
                {visibleCols.impressions && (
                  <th style={{ textAlign: "right" }}>Impressões</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const ins = insightsMap.get(e.external_id) || {
                  spend: 0,
                  clicks: 0,
                  impressions: 0,
                };
                const sls = salesMap.get(e.external_id) || {
                  count: 0,
                  revenue: 0,
                };

                const profit = sls.revenue - ins.spend;
                const roas = ins.spend > 0 ? sls.revenue / ins.spend : null;
                const cpa = sls.count > 0 ? ins.spend / sls.count : null;
                const margin =
                  sls.revenue > 0 ? (profit / sls.revenue) * 100 : null;
                const roi = ins.spend > 0 ? (profit / ins.spend) * 100 : null;
                const cpc = ins.clicks > 0 ? ins.spend / ins.clicks : null;
                const ctr =
                  ins.impressions > 0
                    ? (ins.clicks / ins.impressions) * 100
                    : null;

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
                        className={sls.count > 0 ? "metric-val-highlight" : ""}
                      >
                        {sls.count}
                      </td>
                    )}

                    {visibleCols.cpa && (
                      <td style={{ textAlign: "right" }}>
                        {cpa !== null ? formatMoney(cpa) : "N/A"}
                      </td>
                    )}

                    {visibleCols.spend && (
                      <td style={{ textAlign: "right" }}>
                        {formatMoney(ins.spend)}
                      </td>
                    )}

                    {visibleCols.revenue && (
                      <td style={{ textAlign: "right" }}>
                        {formatMoney(sls.revenue)}
                      </td>
                    )}

                    {visibleCols.profit && (
                      <td
                        style={{ textAlign: "right" }}
                        className={
                          profit > 0
                            ? "metric-val-positive"
                            : profit < 0
                              ? "metric-val-negative"
                              : "metric-val-neutral"
                        }
                      >
                        {formatMoney(profit)}
                      </td>
                    )}

                    {visibleCols.roas && (
                      <td
                        style={{ textAlign: "right" }}
                        className={
                          roas !== null && roas >= 1.5
                            ? "metric-val-positive"
                            : roas !== null && roas < 1
                              ? "metric-val-negative"
                              : ""
                        }
                      >
                        {roas !== null ? `${roas.toFixed(2)}x` : "0.00x"}
                      </td>
                    )}

                    {visibleCols.margin && (
                      <td
                        style={{ textAlign: "right" }}
                        className={
                          margin !== null && margin > 0
                            ? "metric-val-positive"
                            : margin !== null && margin < 0
                              ? "metric-val-negative"
                              : ""
                        }
                      >
                        {margin !== null ? `${margin.toFixed(1)}%` : "N/A"}
                      </td>
                    )}

                    {visibleCols.roi && (
                      <td
                        style={{ textAlign: "right" }}
                        className={
                          roi !== null && roi > 0
                            ? "metric-val-positive"
                            : roi !== null && roi < 0
                              ? "metric-val-negative"
                              : ""
                        }
                      >
                        {roi !== null ? `${roi.toFixed(1)}%` : "N/A"}
                      </td>
                    )}

                    {visibleCols.cpc && (
                      <td style={{ textAlign: "right" }}>
                        {cpc !== null ? formatMoney(cpc) : "N/A"}
                      </td>
                    )}

                    {visibleCols.ctr && (
                      <td style={{ textAlign: "right" }}>
                        {ctr !== null ? `${ctr.toFixed(2)}%` : "0.00%"}
                      </td>
                    )}

                    {visibleCols.clicks && (
                      <td style={{ textAlign: "right" }}>
                        {new Intl.NumberFormat("pt-BR").format(ins.clicks)}
                      </td>
                    )}

                    {visibleCols.impressions && (
                      <td style={{ textAlign: "right" }}>
                        {new Intl.NumberFormat("pt-BR").format(ins.impressions)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>

            {/* Linha de Totalização Agregada */}
            <tfoot>
              <tr>
                {visibleCols.status && (
                  <td style={{ textAlign: "center" }}>-</td>
                )}
                {visibleCols.name && (
                  <td className="col-sticky-name">
                    <strong>TOTAL ({rows.length})</strong>
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
