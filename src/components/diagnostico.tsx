"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Radio,
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
  scrollRetention,
  metricsByOffer = {},
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
  // Real per-session scroll-depth counts from the Radar de Leads pipeline.
  // Without this, the retention analysis below falls back to a guessed
  // percentage of pageviews instead of what visitors actually did.
  scrollRetention?: {
    scroll25Count: number;
    scroll50Count: number;
    scroll75Count: number;
    ctaViewCount: number;
  };
  // Per-offer breakdown so picking one offer below actually scopes the
  // audit to it, instead of quietly analyzing the whole workspace while
  // only labeling the saved snapshot with that offer_id. Meta spend/clicks
  // can't be attributed to a single offer (they live on the ad account),
  // so those come back unset for any specific offer rather than showing a
  // workspace-wide number as if it were this offer's own.
  metricsByOffer?: Record<
    string,
    {
      revenue: number;
      purchases: number;
      refundedCount: number;
      pageviews: number;
      ctas: number;
      checkouts: number;
      scroll25Count: number;
      scroll50Count: number;
      scroll75Count: number;
      ctaViewCount: number;
    }
  >;
}) {
  const [selectedOffer, setSelectedOffer] = useState<string>("all");
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isSaving, startSaving] = useTransition();

  const resolveInputFor = (offerId: string) => {
    if (offerId === "all") {
      return {
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
        scroll25Count: scrollRetention?.scroll25Count,
        scroll50Count: scrollRetention?.scroll50Count,
        scroll75Count: scrollRetention?.scroll75Count,
        ctaViewCount: scrollRetention?.ctaViewCount,
      };
    }
    const scoped = metricsByOffer[offerId];
    return {
      metaClicks: 0,
      pageviews: scoped?.pageviews ?? 0,
      ctas: scoped?.ctas ?? 0,
      checkouts: scoped?.checkouts ?? 0,
      purchases: scoped?.purchases ?? 0,
      metaSpend: 0,
      grossRevenue: scoped?.revenue ?? 0,
      refunds: scoped?.refundedCount ?? 0,
      currency,
      hasCapi,
      scroll25Count: scoped?.scroll25Count,
      scroll50Count: scoped?.scroll50Count,
      scroll75Count: scoped?.scroll75Count,
      ctaViewCount: scoped?.ctaViewCount,
    };
  };

  // Executa diagnóstico com base nas métricas reais do workspace ou oferta
  const [currentResult, setCurrentResult] = useState<FunnelDiagnosticResult>(() =>
    runFunnelDiagnostic(resolveInputFor("all")),
  );

  const handleRunDiagnostic = () => {
    setAnalyzing(true);
    setTimeout(() => {
      const res = runFunnelDiagnostic(resolveInputFor(selectedOffer));
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
      const leak = currentResult.retentionAnalysis?.primaryLeak;
      const steps = currentResult.retentionAnalysis?.steps || [];
      const queryPrompt = `Interprete este diagnóstico de funil integrado com os dados de rolagem do Radar de Leads (Scroll Depth):
- Passagem de Tráfego (Clique -> PageView): ${formatRate(currentResult.metricsSnapshot.pvRate)}
- Retenção Dobra 1 (25%): ${steps[1]?.rate ? steps[1].rate.toFixed(1) + "%" : "—"}
- Retenção VSL / Meio (50%): ${steps[2]?.rate ? steps[2].rate.toFixed(1) + "%" : "—"}
- Retenção Oferta & Preço (75%): ${steps[3]?.rate ? steps[3].rate.toFixed(1) + "%" : "—"}
- Visualização do Botão de Compra (CTA View): ${steps[4]?.rate ? steps[4].rate.toFixed(1) + "%" : "—"}
- Taxa de Clique no Checkout: ${formatRate(currentResult.metricsSnapshot.checkoutRate)}
- Conversão de Venda no Checkout: ${formatRate(currentResult.metricsSnapshot.purchaseRate)}
- Ponto de Maior Vazamento Detectado: ${leak?.label || "Funil Equilibrado"}

Aja como um estrategista veterano de direct response e CRO. Responda em tópicos diretos e objetivos:
1. 🎯 VEREDITO DO GARGALO: Aponte com certeza cirúrgica se a falha crítica está no CRIATIVO / ANÚNCIO, na VSL / CONTEÚDO, na OFERTA / PREÇO ou no CHECKOUT.
2. 🔍 DIAGNÓSTICO DO MOTIVO: Por que o lead está travando exatamente nessa etapa da página com base nos dados?
3. ⚡ PLANO DE AÇÃO 24 HORAS: 3 passos práticos para o gestor destravar o ROI imediatamente.
4. 🧪 TESTE A/B PRIORITÁRIO: Qual teste específico (copy, criativo, ancoragem de preço ou checkout) deve ir para o ar primeiro.`;

      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace,
          query: queryPrompt,
          context: {
            metrics,
            currency,
            selectedOffer,
            retentionFunnel: currentResult.retentionAnalysis,
            diagnostic: currentResult,
            recentDiagnostics: diagnostics.slice(0, 5),
          },
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
        ? "#F59E0B"
        : "#EF4444";

  return (
    <div className="diagnostico-view" style={{ display: "grid", gap: "1.25rem" }}>
      {/* 1. Cabeçalho e Seletor */}
      <section className="panel">
        <div className="diagnostico-controls" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--ink)" }}>Diagnóstico de Funil</h2>
            <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
              Métricas observadas, hipóteses verificáveis e recomendações determinísticas do funil.
            </p>
            {selectedOffer !== "all" && (
              <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.78rem" }}>
                Gasto, cliques e ROAS do Meta não aparecem numa auditoria por oferta específica —
                esses dados são por conta de anúncio, não por oferta.
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={selectedOffer}
              onChange={(e) => setSelectedOffer(e.target.value)}
              style={{ minWidth: "180px" }}
              aria-label="Selecionar oferta"
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
            {selectTab && (
              <button
                className="button secondary"
                onClick={() => selectTab("radar")}
                title="Abrir Radar de Leads em Tempo Real"
              >
                <Radio size={15} /> Radar de Leads
              </button>
            )}
          </div>
        </div>
      </section>

      {aiAnalysis && (
        <section
          className="panel"
          style={{
            borderLeft: "4px solid #5B34EA",
            background: "var(--surface-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Sparkles size={18} color="#5B34EA" />
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--ink)" }}>Leitura estratégica da IA</h2>
          </div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, color: "var(--ink)", fontSize: "0.9rem" }}>{aiAnalysis}</div>
        </section>
      )}

      {/* 2. Placar Principal: Score Global + Frase de Impacto (Responsivo) */}
      <div className="diagnostico-hero-grid">
        {/* Score Gauge Card */}
        <section
          className="panel"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "1.75rem 1.25rem",
          }}
        >
          <span className="tag" style={{ marginBottom: "0.5rem" }}>
            {currentResult.sampleStatus === "sufficient" ? "NOTA DETERMINÍSTICA" : "NOTA PRELIMINAR"}
          </span>
          <div
            style={{
              width: "105px",
              height: "105px",
              borderRadius: "50%",
              border: `6px solid ${scoreColor}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              margin: "0.75rem 0",
              boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
            }}
          >
            <strong style={{ fontSize: "2.3rem", lineHeight: 1, color: scoreColor }}>
              {currentResult.overallScore}
            </strong>
            <small style={{ fontSize: "0.75rem", color: "var(--muted)" }}>de 100</small>
          </div>
          <span
            className="chip"
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              background: currentResult.overallScore >= 80 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
              color: currentResult.overallScore >= 80 ? "#10B981" : "#EF4444",
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
            <small style={{ marginTop: "0.65rem", color: "var(--muted)", fontSize: "0.75rem" }}>
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
                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, var(--surface) 100%)"
                : "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, var(--surface) 100%)",
            borderLeft: `5px solid ${scoreColor}`,
            padding: "1.75rem 1.5rem",
          }}
        >
          <span
            className="tag"
            style={{
              color: currentResult.overallScore >= 80 ? "#10B981" : "#EF4444",
              fontWeight: 700,
              width: "fit-content",
            }}
          >
            PRINCIPAL ACHADO DO DIAGNÓSTICO
          </span>
          <h2 style={{ fontSize: "1.35rem", marginTop: "0.5rem", marginBottom: "0.5rem", color: "var(--ink)", lineHeight: 1.3 }}>
            “{currentResult.primaryHeadline}”
          </h2>
          <p style={{ color: "var(--muted)", maxWidth: "700px", fontSize: "0.9rem", margin: "0.25rem 0 0" }}>
            <strong style={{ color: "var(--ink)" }}>Fato observado:</strong> {currentResult.bottlenecks[0]?.observed || "Sem dados suficientes para apontar anomalia estatística."}
          </p>
        </section>
      </div>

      {/* 2.5. Card do Radar de Retenção & Diagnóstico de Vazamento */}
      {currentResult.retentionAnalysis && (
        <section className="panel" style={{ padding: "1.5rem" }}>
          <div className="diagnostico-retention-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Radio size={18} color="#5B34EA" />
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--ink)" }}>
                  Radar de Retenção & Diagnóstico de Vazamento (Scroll Depth)
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                  Taxa de sobrevivência dos leads do clique no anúncio até a compra final. Identifica se a falha é no criativo, VSL, oferta ou checkout.
                </p>
              </div>
            </div>

            {selectTab && (
              <button
                className="button secondary small"
                onClick={() => selectTab("radar")}
                style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 650 }}
              >
                <Radio size={14} /> Inspecionar no Radar de Leads <ArrowRight size={13} />
              </button>
            )}
          </div>

          {/* Funil Visual Progressivo dos Marcos de Rolagem */}
          <div
            className="diagnostico-funnel-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            {currentResult.retentionAnalysis.steps.map((step) => {
              const stepColor =
                step.status === "good"
                  ? "#10B981"
                  : step.status === "warning"
                  ? "#F59E0B"
                  : "#EF4444";
              return (
                <div
                  key={step.stage}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--line)",
                    borderTop: `4px solid ${stepColor}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)" }}>
                    {step.label}
                  </span>
                  <strong style={{ fontSize: "1.2rem", fontWeight: 800, color: stepColor }}>
                    {step.rate.toFixed(1)}%
                  </strong>
                  <span style={{ fontSize: "0.72rem", color: "var(--ink)", fontWeight: 600 }}>
                    {step.name}
                  </span>
                  <small style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                    {step.count} leads
                  </small>
                </div>
              );
            })}
          </div>

          {/* Veredito Cirúrgico de Causa Raiz */}
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: "12px",
              background:
                currentResult.retentionAnalysis.primaryLeak.stage === "criativo"
                  ? "rgba(239, 68, 68, 0.08)"
                  : currentResult.retentionAnalysis.primaryLeak.stage === "vsl"
                  ? "rgba(245, 158, 11, 0.08)"
                  : currentResult.retentionAnalysis.primaryLeak.stage === "oferta"
                  ? "rgba(139, 92, 246, 0.08)"
                  : currentResult.retentionAnalysis.primaryLeak.stage === "checkout"
                  ? "rgba(239, 68, 68, 0.08)"
                  : "rgba(16, 185, 129, 0.08)",
              border: `1px solid ${
                currentResult.retentionAnalysis.primaryLeak.stage === "saudavel" ? "#10B981" : "#EF4444"
              }`,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: currentResult.retentionAnalysis.primaryLeak.stage === "saudavel" ? "#10B981" : "#EF4444",
                  color: "#FFF",
                  textTransform: "uppercase",
                }}
              >
                Veredito do Radar
              </span>
              <strong style={{ fontSize: "0.95rem", color: "var(--ink)" }}>
                {currentResult.retentionAnalysis.primaryLeak.label}
              </strong>
            </div>

            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink)", lineHeight: 1.4 }}>
              {currentResult.retentionAnalysis.primaryLeak.description}
            </p>

            <div style={{ marginTop: "4px", fontSize: "0.8rem", color: "var(--muted)" }}>
              <strong style={{ color: "var(--ink)" }}>Ação Imediata Recomendada:</strong>{" "}
              {currentResult.retentionAnalysis.primaryLeak.suggestedAction}
            </div>
          </div>
        </section>
      )}

      {/* 3. Notas por Categoria */}
      <div className="diagnostico-category-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.85rem" }}>
        {currentResult.categoryScores.map((cat) => (
          <section key={cat.category} className="panel" style={{ padding: "1.1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.88rem", color: "var(--ink)" }}>{cat.name}</strong>
              <span
                className="chip"
                style={{
                  fontWeight: 700,
                  color: cat.score >= 80 ? "#10B981" : cat.score >= 60 ? "#F59E0B" : "#EF4444",
                }}
              >
                {cat.score}/100
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.4rem", lineHeight: "1.35" }}>
              {cat.details}
            </p>
          </section>
        ))}
      </div>

      {/* 4. Waterfall do Funil (Cliques Meta -> PageViews -> CTAs -> Checkouts -> Vendas) */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2 style={{ margin: 0, fontSize: "1.15rem", color: "var(--ink)" }}>Queda por Etapa do Funil</h2>
            <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
              Acompanhe o volume absoluto e a taxa de retenção entre cada momento do comprador
            </p>
          </div>
        </div>

        <div
          className="diagnostico-waterfall-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "0.75rem",
            marginTop: "1rem",
            textAlign: "center",
          }}
        >
          {/* Etapa 1: Cliques Meta */}
          <div style={{ padding: "1rem 0.75rem", background: "var(--surface-subtle)", border: "1px solid var(--line)", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block" }}>
              1. Cliques Anúncio
            </span>
            <strong style={{ fontSize: "1.35rem", color: "var(--ink)", display: "block", margin: "0.2rem 0" }}>
              {currentResult.metricsSnapshot.metaClicks}
            </strong>
            <small style={{ display: "block", color: "var(--muted)", fontSize: "0.72rem" }}>
              Base de tráfego
            </small>
          </div>

          {/* Etapa 2: PageViews */}
          <div style={{ padding: "1rem 0.75rem", background: "var(--surface-subtle)", border: "1px solid var(--line)", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block" }}>
              2. PageViews
            </span>
            <strong style={{ fontSize: "1.35rem", color: "var(--ink)", display: "block", margin: "0.2rem 0" }}>
              {currentResult.metricsSnapshot.pageviews}
            </strong>
            <small
              style={{
                display: "block",
                color: isBelow(currentResult.metricsSnapshot.pvRate, 70) ? "#EF4444" : "#10B981",
                fontWeight: 600,
                fontSize: "0.72rem",
              }}
            >
              {formatRate(currentResult.metricsSnapshot.pvRate)} do clique
            </small>
          </div>

          {/* Etapa 3: Cliques no CTA */}
          <div style={{ padding: "1rem 0.75rem", background: "var(--surface-subtle)", border: "1px solid var(--line)", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block" }}>
              3. Cliques no Botão
            </span>
            <strong style={{ fontSize: "1.35rem", color: "var(--ink)", display: "block", margin: "0.2rem 0" }}>
              {currentResult.metricsSnapshot.ctas}
            </strong>
            <small
              style={{
                display: "block",
                color: isBelow(currentResult.metricsSnapshot.ctaRate, 10) ? "#EF4444" : "#10B981",
                fontWeight: 600,
                fontSize: "0.72rem",
              }}
            >
              {formatRate(currentResult.metricsSnapshot.ctaRate)} da página
            </small>
          </div>

          {/* Etapa 4: Checkouts Iniciados */}
          <div style={{ padding: "1rem 0.75rem", background: "var(--surface-subtle)", border: "1px solid var(--line)", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block" }}>
              4. Checkouts
            </span>
            <strong style={{ fontSize: "1.35rem", color: "var(--ink)", display: "block", margin: "0.2rem 0" }}>
              {currentResult.metricsSnapshot.checkouts}
            </strong>
            <small
              style={{
                display: "block",
                color: isBelow(currentResult.metricsSnapshot.checkoutRate, 25) ? "#EF4444" : "#10B981",
                fontWeight: 600,
                fontSize: "0.72rem",
              }}
            >
              {formatRate(currentResult.metricsSnapshot.checkoutRate)} dos CTAs
            </small>
          </div>

          {/* Etapa 5: Vendas Aprovadas */}
          <div style={{ padding: "1rem 0.75rem", background: "var(--surface-subtle)", border: "1px solid var(--line)", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block" }}>
              5. Compras Aprovadas
            </span>
            <strong style={{ fontSize: "1.35rem", color: "#10B981", display: "block", margin: "0.2rem 0" }}>
              {currentResult.metricsSnapshot.purchases}
            </strong>
            <small
              style={{
                display: "block",
                color: isBelow(currentResult.metricsSnapshot.purchaseRate, 15) ? "#EF4444" : "#10B981",
                fontWeight: 600,
                fontSize: "0.72rem",
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
            <h2 style={{ margin: 0, fontSize: "1.15rem", color: "var(--ink)" }}>Gargalos Identificados e Recomendações</h2>
            <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
              Ações prioritárias para estancar perdas e destravar o ROAS da oferta
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.85rem", marginTop: "1rem" }}>
          {currentResult.bottlenecks.map((b) => {
            const isCrit = b.severity === "critical";
            const isHigh = b.severity === "high";
            const isGood = b.severity === "good";

            return (
              <div
                key={b.id}
                style={{
                  padding: "1.15rem",
                  borderRadius: "10px",
                  border: isCrit
                    ? "1px solid rgba(239, 68, 68, 0.35)"
                    : isHigh
                      ? "1px solid rgba(245, 158, 11, 0.35)"
                      : isGood
                        ? "1px solid rgba(16, 185, 129, 0.35)"
                        : "1px solid var(--line)",
                  background: isCrit
                    ? "rgba(239, 68, 68, 0.05)"
                    : isHigh
                      ? "rgba(245, 158, 11, 0.05)"
                      : isGood
                        ? "rgba(16, 185, 129, 0.05)"
                        : "var(--surface-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <span
                      className="chip"
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: isCrit ? "rgba(239, 68, 68, 0.12)" : isHigh ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
                        color: isCrit ? "#EF4444" : isHigh ? "#F59E0B" : "#10B981",
                      }}
                    >
                      {isCrit ? "CRÍTICO" : isHigh ? "ALTA PRIORIDADE" : isGood ? "POSITIVO" : "OPORTUNIDADE"}
                    </span>
                    <h3 style={{ marginTop: "0.4rem", fontSize: "1.08rem", color: "var(--ink)", fontWeight: 700 }}>
                      {b.headline}
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                      <strong style={{ color: "var(--ink)" }}>Fato observado:</strong> {b.observed}
                    </p>
                    <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                      <strong style={{ color: "var(--ink)" }}>Hipótese do gargalo:</strong> {b.hypothesis}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "0.75rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <p style={{ fontSize: "0.85rem", color: "var(--ink)", margin: 0 }}>
                    💡 <strong>Recomendação:</strong> {b.recommendation}
                  </p>
                  {b.actionTab && (
                    <button
                      type="button"
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
              <h2 style={{ margin: 0, fontSize: "1.15rem", color: "var(--ink)" }}>Histórico de Diagnósticos</h2>
              <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                Auditorias anteriores registradas no workspace
              </p>
            </div>
            {isSaving && (
              <span className="chip" style={{ color: "var(--brand-accent, #5B34EA)" }}>
                <RefreshCw size={12} className="spin" /> Salvando diagnóstico...
              </span>
            )}
          </div>
          <div style={{ display: "grid", gap: "0.6rem", marginTop: "1rem" }}>
            {diagnostics.slice(0, 5).map((d) => (
              <div
                key={d.id}
                style={{
                  padding: "0.75rem 1rem",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--surface-subtle)",
                }}
              >
                <div>
                  <strong style={{ color: "var(--ink)", fontSize: "0.88rem" }}>Score {d.score}/100</strong> ·{" "}
                  <small style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    {new Date(d.created_at).toLocaleString("pt-BR")}
                  </small>
                </div>
                <span className="chip" style={{ fontSize: "0.72rem" }}>
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
