"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { Offer, DiagnosticRow } from "@/lib/types";
import { runFunnelDiagnostic, type FunnelDiagnosticResult } from "@/lib/funnel-diagnostic";
import { saveDiagnosticAction } from "@/app/actions";

export function DiagnosticoView({
  workspace,
  offers = [],
  metrics,
  hasCapi = false,
  diagnostics = [],
  currency = "BRL",
  selectTab,
}: {
  workspace: string;
  offers: Offer[];
  metrics: {
    revenue: number;
    purchases: number;
    spend: number | null;
    clicks: number;
    pageviews: number;
    ctas: number;
    checkouts: number;
    refundedCount: number;
  };
  hasCapi?: boolean;
  diagnostics: DiagnosticRow[];
  currency: string;
  selectTab: (tab: string) => void;
}) {
  const [selectedOffer, setSelectedOffer] = useState<string>("all");
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isSaving, startSaving] = useTransition();

  // Executa diagnóstico com base nas métricas reais do workspace ou oferta
  const [currentResult, setCurrentResult] = useState<FunnelDiagnosticResult>(() =>
    runFunnelDiagnostic({
      metaClicks: metrics.clicks,
      pageviews: metrics.pageviews,
      ctas: metrics.ctas,
      checkouts: metrics.checkouts,
      purchases: metrics.purchases,
      metaSpend: metrics.spend || 0,
      grossRevenue: metrics.revenue,
      refunds: metrics.refundedCount,
      currency,
      hasCapi,
    }),
  );

  const handleRunDiagnostic = () => {
    setAnalyzing(true);
    setTimeout(() => {
      const res = runFunnelDiagnostic({
        metaClicks: metrics.clicks,
        pageviews: metrics.pageviews,
        ctas: metrics.ctas,
        checkouts: metrics.checkouts,
        purchases: metrics.purchases,
        metaSpend: metrics.spend || 0,
        grossRevenue: metrics.revenue,
        refunds: metrics.refundedCount,
        currency,
        hasCapi,
      });
      setCurrentResult(res);
      setAnalyzing(false);

      startSaving(async () => {
        await saveDiagnosticAction(workspace, {
          offer_id: selectedOffer !== "all" ? selectedOffer : null,
          score: res.overallScore,
          category_scores: res.categoryScores,
          bottlenecks: res.bottlenecks,
          recommendations: res.bottlenecks.map((b) => b.recommendation),
          metrics_snapshot: res.metricsSnapshot,
        });
      });
    }, 600);
  };

  const handleAiAnalysis = async () => {
    if (aiAnalyzing) return;
    setAiAnalyzing(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace,
          query: "Interprete este diagnóstico de funil como um estrategista de direct response. Entregue: (1) leitura executiva, (2) gargalo prioritário e por que, (3) ação nas próximas 24 horas, (4) teste recomendado para copy, criativo ou checkout, (5) o que ainda não dá para afirmar. Não invente dados e não recomende escalar sem volume suficiente.",
          context: { metrics, currency, selectedOffer, diagnostic: currentResult, recentDiagnostics: diagnostics.slice(0, 5) },
        }),
      });
      const data = await response.json();
      setAiAnalysis(data.text || data.error || "Não foi possível interpretar o diagnóstico agora.");
    } catch {
      setAiAnalysis("Não foi possível consultar a IA agora. Tente novamente em instantes.");
    } finally {
      setAiAnalyzing(false);
    }
  };

  const formatRate = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
  const isBelow = (value: number | null, threshold: number) => value !== null && value < threshold;

  const scoreColor =
    currentResult.overallScore >= 80
      ? "var(--positive, #10B981)"
      : currentResult.overallScore >= 60
        ? "var(--yellow, #F59E0B)"
        : "var(--red, #EF3340)";

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* 1. Cabeçalho e Seletor */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2>Diagnóstico de Funil</h2>
            <p>
              Métricas observadas, hipóteses verificáveis e recomendações determinísticas do funil.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <select
              value={selectedOffer}
              onChange={(e) => setSelectedOffer(e.target.value)}
              style={{ minWidth: "180px" }}
            >
              <option value="all">Todas as ofertas (Workspace)</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button className="button primary" disabled={analyzing} onClick={handleRunDiagnostic}>
              {analyzing ? (
                <>
                  <RefreshCw size={15} className="spin" /> Auditando...
                </>
              ) : (
                <>
                  <Activity size={15} /> Rodar Auditoria
                </>
              )}
            </button>
            <button className="button ghost" disabled={aiAnalyzing} onClick={handleAiAnalysis}>
              <Sparkles size={15} /> {aiAnalyzing ? "Interpretando..." : "Interpretar com IA"}
            </button>
          </div>
        </div>
      </section>

      {aiAnalysis && (
        <section className="panel" style={{ borderLeft: "4px solid #5B34EA", background: "linear-gradient(135deg, #F5F3FF 0%, #FFFFFF 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Sparkles size={18} color="#5B34EA" />
            <h2 style={{ margin: 0 }}>Leitura estratégica da IA</h2>
          </div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, color: "#334155" }}>{aiAnalysis}</div>
        </section>
      )}

      {/* 2. Placar Principal: Score Global + Frase de Impacto */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "1.5rem" }}>
        {/* Score Gauge Card */}
        <section
          className="panel"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "2rem 1.5rem",
          }}
        >
          <span className="tag" style={{ marginBottom: "0.5rem" }}>
            {currentResult.sampleStatus === "sufficient" ? "NOTA DETERMINÍSTICA" : "NOTA PRELIMINAR"}
          </span>
          <div
            style={{
              width: "110px",
              height: "110px",
              borderRadius: "50%",
              border: `7px solid ${scoreColor}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              margin: "0.75rem 0",
              boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
            }}
          >
            <strong style={{ fontSize: "2.5rem", lineHeight: 1, color: scoreColor }}>
              {currentResult.overallScore}
            </strong>
            <small style={{ fontSize: "0.75rem", color: "var(--muted, #64748B)" }}>de 100</small>
          </div>
          <span
            className="chip"
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              background: currentResult.overallScore >= 80 ? "#ECFDF5" : "#FEF2F2",
              color: currentResult.overallScore >= 80 ? "#065F46" : "#991B1B",
            }}
          >
            Grau {currentResult.overallGrade} ·{" "}
            {currentResult.overallScore >= 80
              ? "Excelente"
              : currentResult.overallScore >= 60
                ? "Atenção"
                : "Crítico"}
          </span>
          {currentResult.sampleNotice && (
            <small style={{ marginTop: "0.65rem", color: "var(--muted, #64748B)" }}>
              {currentResult.sampleNotice}
            </small>
          )}
        </section>

        {/* Frase de Gargalo Principal */}
        <section
          className="panel"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background:
              currentResult.overallScore >= 80
                ? "linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)"
                : "linear-gradient(135deg, #FFF1F2 0%, #FFFFFF 100%)",
            borderLeft: `5px solid ${scoreColor}`,
          }}
        >
          <span
            className="tag"
            style={{
              color: currentResult.overallScore >= 80 ? "#059669" : "#DC2626",
              fontWeight: 700,
            }}
          >
            PRINCIPAL ACHADO DO DIAGNÓSTICO
          </span>
          <h2 style={{ fontSize: "1.45rem", marginTop: "0.4rem", marginBottom: "0.5rem" }}>
            “{currentResult.primaryHeadline}”
          </h2>
          <p style={{ color: "var(--muted, #64748B)", maxWidth: "700px" }}>
            <strong>Fato observado:</strong> {currentResult.bottlenecks[0]?.observed || "Sem dados suficientes."}
          </p>
        </section>
      </div>

      {/* 3. Notas por Categoria */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {currentResult.categoryScores.map((cat) => (
          <section key={cat.category} className="panel" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.9rem" }}>{cat.name}</strong>
              <span
                className="chip"
                style={{
                  fontWeight: 700,
                  color: cat.score >= 80 ? "#10B981" : cat.score >= 60 ? "#F59E0B" : "#EF3340",
                }}
              >
                {cat.score}/100
              </span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--muted, #64748B)", marginTop: "0.5rem" }}>
              {cat.details}
            </p>
          </section>
        ))}
      </div>

      {/* 4. Waterfall do Funil (Cliques Meta -> PageViews -> CTAs -> Checkouts -> Vendas) */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Queda por Etapa do Funil</h2>
            <p>Acompanhe o volume absoluto e a taxa de retenção entre cada momento do comprador</p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "0.75rem",
            marginTop: "1rem",
            textAlign: "center",
          }}
        >
          {/* Etapa 1: Cliques Meta */}
          <div style={{ padding: "1rem", background: "var(--surface-subtle, #F8FAFC)", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--muted, #64748B)", display: "block" }}>
              1. Cliques Anúncio
            </span>
            <strong style={{ fontSize: "1.4rem" }}>{currentResult.metricsSnapshot.metaClicks}</strong>
            <small style={{ display: "block", color: "var(--muted, #64748B)", marginTop: "0.25rem" }}>
              Base de tráfego
            </small>
          </div>

          {/* Etapa 2: PageViews */}
          <div style={{ padding: "1rem", background: "var(--surface-subtle, #F8FAFC)", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--muted, #64748B)", display: "block" }}>
              2. PageViews
            </span>
            <strong style={{ fontSize: "1.4rem" }}>{currentResult.metricsSnapshot.pageviews}</strong>
            <small
              style={{
                display: "block",
                color: isBelow(currentResult.metricsSnapshot.pvRate, 70) ? "var(--red, #EF3340)" : "var(--positive, #10B981)",
                fontWeight: 600,
                marginTop: "0.25rem",
              }}
            >
              {formatRate(currentResult.metricsSnapshot.pvRate)} do clique
            </small>
          </div>

          {/* Etapa 3: Cliques no CTA */}
          <div style={{ padding: "1rem", background: "var(--surface-subtle, #F8FAFC)", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--muted, #64748B)", display: "block" }}>
              3. Cliques no Botão
            </span>
            <strong style={{ fontSize: "1.4rem" }}>{currentResult.metricsSnapshot.ctas}</strong>
            <small
              style={{
                display: "block",
                color: isBelow(currentResult.metricsSnapshot.ctaRate, 10) ? "var(--red, #EF3340)" : "var(--positive, #10B981)",
                fontWeight: 600,
                marginTop: "0.25rem",
              }}
            >
              {formatRate(currentResult.metricsSnapshot.ctaRate)} da página
            </small>
          </div>

          {/* Etapa 4: Checkouts Iniciados */}
          <div style={{ padding: "1rem", background: "var(--surface-subtle, #F8FAFC)", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--muted, #64748B)", display: "block" }}>
              4. Checkouts
            </span>
            <strong style={{ fontSize: "1.4rem" }}>{currentResult.metricsSnapshot.checkouts}</strong>
            <small
              style={{
                display: "block",
                color: isBelow(currentResult.metricsSnapshot.checkoutRate, 25) ? "var(--red, #EF3340)" : "var(--positive, #10B981)",
                fontWeight: 600,
                marginTop: "0.25rem",
              }}
            >
              {formatRate(currentResult.metricsSnapshot.checkoutRate)} dos CTAs
            </small>
          </div>

          {/* Etapa 5: Vendas Aprovadas */}
          <div style={{ padding: "1rem", background: "var(--surface-subtle, #F8FAFC)", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--muted, #64748B)", display: "block" }}>
              5. Compras Aprovadas
            </span>
            <strong style={{ fontSize: "1.4rem", color: "var(--positive, #10B981)" }}>
              {currentResult.metricsSnapshot.purchases}
            </strong>
            <small
              style={{
                display: "block",
                color: isBelow(currentResult.metricsSnapshot.purchaseRate, 15) ? "var(--red, #EF3340)" : "var(--positive, #10B981)",
                fontWeight: 600,
                marginTop: "0.25rem",
              }}
            >
              {formatRate(currentResult.metricsSnapshot.purchaseRate)} do checkout
            </small>
          </div>
        </div>
      </section>

      {/* 5. Lista de Gargalos & Recomendações Práticas */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Gargalos Identificados e Recomendações</h2>
            <p>Ações prioritárias para estancar perdas e destravar o ROAS da oferta</p>
          </div>
        </div>

        <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
          {currentResult.bottlenecks.map((b) => {
            const isCrit = b.severity === "critical";
            const isHigh = b.severity === "high";
            const isGood = b.severity === "good";

            return (
              <div
                key={b.id}
                style={{
                  padding: "1.25rem",
                  borderRadius: "10px",
                  border: isCrit
                    ? "1px solid #FECACA"
                    : isHigh
                      ? "1px solid #FED7AA"
                      : isGood
                        ? "1px solid #BBF7D0"
                        : "1px solid #E2E8F0",
                  background: isCrit
                    ? "#FEF2F2"
                    : isHigh
                      ? "#FFF7ED"
                      : isGood
                        ? "#F0FDF4"
                        : "#FFFFFF",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <span
                      className="chip"
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: isCrit ? "#FEE2E2" : isHigh ? "#FFEDD5" : "#DCFCE7",
                        color: isCrit ? "#B91C1C" : isHigh ? "#C2410C" : "#15803D",
                      }}
                    >
                      {isCrit ? "CRÍTICO" : isHigh ? "ALTA PRIORIDADE" : isGood ? "POSITIVO" : "OPORTUNIDADE"}
                    </span>
                    <h3 style={{ marginTop: "0.4rem", fontSize: "1.15rem" }}>{b.headline}</h3>
                    <p style={{ fontSize: "0.9rem", color: "#475569", marginTop: "0.25rem" }}>
                      <strong>Fato observado:</strong> {b.observed}
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "#64748B", marginTop: "0.2rem" }}>
                      <strong>Hipótese:</strong> {b.hypothesis}
                    </p>
                  </div>

                </div>

                <div
                  style={{
                    marginTop: "0.75rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px dashed rgba(0,0,0,0.1)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <p style={{ fontSize: "0.85rem", color: "#1E293B" }}>
                    💡 <strong>Recomendação:</strong> {b.recommendation}
                  </p>
                  {b.actionTab && (
                    <button
                      className="button small primary"
                      onClick={() => selectTab(b.actionTab || "ofertas")}
                    >
                      {b.actionLabel || "Corrigir na Trackbase"} <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Histórico de Auditorias Salvas */}
      {diagnostics.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Histórico de Diagnósticos</h2>
              <p>Auditorias anteriores registradas no workspace</p>
            </div>
            {isSaving && (
              <span className="chip" style={{ color: "var(--brand-accent, #5B34EA)" }}>
                <RefreshCw size={12} className="spin" /> Salvando diagnóstico...
              </span>
            )}
          </div>
          <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
            {diagnostics.slice(0, 5).map((d) => (
              <div
                key={d.id}
                style={{
                  padding: "0.85rem 1rem",
                  border: "1px solid var(--line, #E2E8F0)",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#FFFFFF",
                }}
              >
                <div>
                  <strong>Score {d.score}/100</strong> ·{" "}
                  <small style={{ color: "var(--muted, #64748B)" }}>
                    {new Date(d.created_at).toLocaleString("pt-BR")}
                  </small>
                </div>
                <span className="chip" style={{ fontSize: "0.75rem" }}>
                  {Array.isArray(d.bottlenecks) ? `${d.bottlenecks.length} apontamentos` : "Auditoria concluída"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
