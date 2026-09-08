"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  Plug,
  Code2,
  Link2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
} from "lucide-react";

interface OnboardingProps {
  hasPaymentGateway: boolean;
  hasTrackerActivity: boolean;
  linksCount: number;
  hasMetaConnected: boolean;
  salesCount: number;
  onNavigateTab: (tabId: string) => void;
}

export function OnboardingChecklist({
  hasPaymentGateway,
  hasTrackerActivity,
  linksCount,
  hasMetaConnected,
  salesCount,
  onNavigateTab,
}: OnboardingProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem("trackbase_onboarding_hidden") ||
        localStorage.getItem("kirofy_onboarding_hidden");
      if (saved === "true") setDismissed(true);
    } catch {
      // ignore
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("trackbase_onboarding_hidden", "true");
    } catch {
      // ignore
    }
  };

  const steps = [
    {
      id: "step-gateway",
      title: "1. Conectar gateway e importar produtos",
      description: "Conecte Hotmart, Kiwify ou Cakto. Seus produtos entram automaticamente.",
      done: hasPaymentGateway,
      icon: Plug,
      actionLabel: "Conectar gateway",
      action: () => onNavigateTab("integracoes"),
    },
    {
      id: "step-tracker",
      title: "2. Instalar o tracker na landing page",
      description: "Adicione o script da Trackbase para rastrear visitas, cliques e checkouts em tempo real.",
      done: hasTrackerActivity,
      icon: Code2,
      actionLabel: "Copiar script",
      action: () => onNavigateTab("links"),
    },
    {
      id: "step-links",
      title: "3. Conectar Meta Ads ou criar link UTM",
      description: "Gere links com parâmetros dinâmicos ou sincronize seus anúncios da Meta.",
      done: linksCount > 0 || hasMetaConnected,
      icon: Link2,
      actionLabel: "Criar link",
      action: () => onNavigateTab("links"),
    },
    {
      id: "step-sales",
      title: "4. Validar sua primeira venda",
      description: "Faça uma venda de teste ou envie uma transação para validar o fluxo ponta a ponta.",
      done: salesCount > 0,
      icon: ShoppingBag,
      actionLabel: "Ver vendas",
      action: () => onNavigateTab("visao"),
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const isAllComplete = completedCount === steps.length;

  if (dismissed) return null;

  return (
    <div
      className="panel"
      style={{
        marginBottom: "1.25rem",
        border: isAllComplete ? "1px solid #10B981" : "1px solid var(--line)",
        background: isAllComplete ? "rgba(16, 185, 129, 0.04)" : "var(--surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: isAllComplete ? "#10B981" : "#5B34EA",
              color: "#FFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isAllComplete ? <CheckCircle2 size={20} /> : <Sparkles size={20} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>
              {isAllComplete
                ? "🎉 Parabéns! Sua operação está 100% pronta para escalar."
                : "Deixe seu rastreamento pronto"}
            </h3>
            <p style={{ margin: "0.15rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
              {isAllComplete
                ? "Gateway, tracker, atribuição e vendas estão recebendo dados."
                : `${completedCount} de ${steps.length} etapas concluídas · ${progressPercent}% pronto`}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            className="button small ghost"
            onClick={() => setCollapsed(!collapsed)}
            style={{ padding: "0.3rem 0.6rem" }}
          >
            {collapsed ? (
              <>
                Expandir <ChevronDown size={14} />
              </>
            ) : (
              <>
                Recolher <ChevronUp size={14} />
              </>
            )}
          </button>
          <button
            type="button"
            className="button small ghost"
            onClick={handleDismiss}
            title="Fechar checklist"
            style={{ padding: "0.3rem 0.5rem", color: "var(--muted)" }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: "100%",
          height: 6,
          background: "var(--line)",
          borderRadius: 3,
          margin: "0.85rem 0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: "100%",
            background: isAllComplete ? "#10B981" : "linear-gradient(90deg, #5B34EA, #7C3AED)",
            borderRadius: 3,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {!collapsed && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "0.75rem",
            marginTop: "0.75rem",
          }}
        >
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className="onboarding-step"
                style={{
                  padding: "0.85rem",
                  borderRadius: "8px",
                  border: step.done
                    ? "1px solid rgba(16, 185, 129, 0.4)"
                    : "1px solid var(--line)",
                  background: step.done
                    ? "rgba(16, 185, 129, 0.05)"
                    : "var(--surface-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                    {step.done ? (
                      <CheckCircle2 size={16} color="#10B981" />
                    ) : (
                      <Circle size={16} color="var(--muted)" />
                    )}
                    <strong
                      className="onboarding-step-title"
                      style={{
                        fontSize: "0.88rem",
                        color: step.done ? "#10B981" : "var(--ink)",
                      }}
                    >
                      {step.title}
                    </strong>
                  </div>
                  <p
                    className="onboarding-step-description"
                    style={{
                      margin: "0 0 0.5rem 1.4rem",
                      fontSize: "0.78rem",
                      color: "var(--muted)",
                      lineHeight: "1.35",
                    }}
                  >
                    {step.description}
                  </p>
                </div>
                {!step.done && (
                  <button
                    type="button"
                    className="button small primary"
                    onClick={step.action}
                    style={{
                      alignSelf: "flex-start",
                      marginLeft: "1.4rem",
                      fontSize: "0.75rem",
                      padding: "0.25rem 0.6rem",
                    }}
                  >
                    <Icon size={12} style={{ marginRight: 4 }} />
                    {step.actionLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
