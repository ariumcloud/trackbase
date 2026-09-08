"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  Layers,
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
  offersCount: number;
  hasPaymentGateway: boolean;
  hasTrackerActivity: boolean;
  linksCount: number;
  hasMetaConnected: boolean;
  salesCount: number;
  onNavigateTab: (tabId: string) => void;
  onOpenCreateOffer?: () => void;
}

export function OnboardingChecklist({
  offersCount,
  hasPaymentGateway,
  hasTrackerActivity,
  linksCount,
  hasMetaConnected,
  salesCount,
  onNavigateTab,
  onOpenCreateOffer,
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
      id: "step-offer",
      title: "1. Cadastrar sua primeira Oferta",
      description: "Crie a oferta principal com o nome e preço do seu produto.",
      done: offersCount > 0,
      icon: Layers,
      actionLabel: "Cadastrar oferta",
      action: () => (onOpenCreateOffer ? onOpenCreateOffer() : onNavigateTab("ofertas")),
    },
    {
      id: "step-gateway",
      title: "2. Conectar Gateway de Pagamento",
      description: "Conecte Hotmart, Kiwify, Cakto, Eduzz ou Kirvano via webhook seguro.",
      done: hasPaymentGateway,
      icon: Plug,
      actionLabel: "Ver integrações",
      action: () => onNavigateTab("integracoes"),
    },
    {
      id: "step-tracker",
      title: "3. Instalar o Tracker na Landing Page",
      description: "Adicione o script da Trackbase para rastrear visitas, cliques e checkouts em tempo real.",
      done: hasTrackerActivity,
      icon: Code2,
      actionLabel: "Copiar script",
      action: () => onNavigateTab("links"),
    },
    {
      id: "step-links",
      title: "4. Criar Link UTM ou Conectar Meta Ads",
      description: "Gere links com parâmetros dinâmicos ou sincronize seus anúncios da Meta.",
      done: linksCount > 0 || hasMetaConnected,
      icon: Link2,
      actionLabel: "Criar link",
      action: () => onNavigateTab("links"),
    },
    {
      id: "step-sales",
      title: "5. Realizar ou Testar a Primeira Venda",
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
        border: isAllComplete ? "1px solid #10B981" : "1px solid #C7D2FE",
        background: isAllComplete ? "rgba(16, 185, 129, 0.03)" : "rgba(91, 52, 234, 0.02)",
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
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>
              {isAllComplete
                ? "🎉 Parabéns! Sua operação está 100% pronta para escalar."
                : "Checklist de Ativação Trackbase"}
            </h3>
            <p style={{ margin: "0.15rem 0 0", color: "var(--muted, #64748B)", fontSize: "0.85rem" }}>
              {isAllComplete
                ? "Todos os pilares de tracking, pagamentos e atribuição estão funcionando perfeitamente."
                : `${completedCount} de ${steps.length} etapas concluídas (${progressPercent}%)`}
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
            style={{ padding: "0.3rem 0.5rem", color: "var(--muted, #94A3B8)" }}
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
          background: "var(--line, #E2E8F0)",
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
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
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
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: step.done ? "1px solid #D1FAE5" : "1px solid var(--line, #E2E8F0)",
                  background: step.done ? "#F0FDF4" : "#FFFFFF",
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
                      <Circle size={16} color="#94A3B8" />
                    )}
                    <strong
                      className="onboarding-step-title"
                      style={{
                        fontSize: "0.9rem",
                        color: step.done ? "#065F46" : "var(--ink, #0F172A)",
                      }}
                    >
                      {step.title}
                    </strong>
                  </div>
                  <p
                    className="onboarding-step-description"
                    style={{
                      margin: "0 0 0.5rem 1.4rem",
                      fontSize: "0.8rem",
                      color: "var(--muted, #64748B)",
                      lineHeight: "1.3",
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
