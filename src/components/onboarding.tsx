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
  Radio,
  ShieldCheck,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { GuideModal } from "./guide-modal";

interface OnboardingProps {
  hasPaymentGateway: boolean;
  hasTrackerActivity: boolean;
  linksCount: number;
  hasMetaConnected: boolean;
  hasShieldConfigured?: boolean;
  salesCount: number;
  onNavigateTab: (tabId: string) => void;
}

export function OnboardingChecklist({
  hasPaymentGateway,
  hasTrackerActivity,
  linksCount,
  hasMetaConnected,
  hasShieldConfigured = false,
  salesCount,
  onNavigateTab,
}: OnboardingProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideInitialTab, setGuideInitialTab] = useState<
    "radar" | "shield" | "utm" | "gateway" | "capi" | "alertas"
  >("radar");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("trackbase_onboarding_hidden");
      if (saved === "true") setDismissed(true);

      const savedCollapsed = localStorage.getItem("trackbase_onboarding_collapsed");
      if (savedCollapsed === "true") setCollapsed(true);
      else if (savedCollapsed === "false") setCollapsed(false);
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

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("trackbase_onboarding_collapsed", String(next));
    } catch {
      // ignore
    }
  };

  function openGuide(
    tab: "radar" | "shield" | "utm" | "gateway" | "capi" | "alertas",
  ) {
    setGuideInitialTab(tab);
    setGuideOpen(true);
  }

  const steps = [
    {
      id: "step-gateway",
      title: "1. Conectar gateway e webhooks",
      description:
        "Conecte Hotmart, Kiwify, Cakto e outros para receber vendas em tempo real.",
      done: hasPaymentGateway,
      icon: Plug,
      actionLabel: "Conectar",
      action: () => onNavigateTab("integracoes"),
      guideTab: "gateway" as const,
    },
    {
      id: "step-tracker",
      title: "2. Instalar tracker na landing page",
      description:
        "Script ultra-leve para rastrear visitas, UTMs, sessões e cliques sem lentidão.",
      done: hasTrackerActivity,
      icon: Code2,
      actionLabel: "Copiar script",
      action: () => onNavigateTab("links"),
      guideTab: "radar" as const,
    },
    {
      id: "step-radar",
      title: "3. Monitorar no Radar de Leads",
      description:
        "Veja visitantes ao vivo no mapa de calor de rolagem e recupere desistências.",
      done: hasTrackerActivity,
      icon: Radio,
      actionLabel: "Ver Radar",
      action: () => onNavigateTab("radar"),
      guideTab: "radar" as const,
    },
    {
      id: "step-shield",
      title: "4. Blindar campanhas com o Shield",
      description:
        "Cloaker inteligente contra revisores da Meta/Google, espiões e domínio CNAME.",
      done: hasShieldConfigured,
      icon: ShieldCheck,
      actionLabel: "Ativar Shield",
      action: () => onNavigateTab("shield"),
      guideTab: "shield" as const,
    },
    {
      id: "step-links",
      title: "5. Gerar links UTM em 1 clique",
      description:
        "Links com parâmetros oficiais da Meta (URL separada), Google e TikTok.",
      done: linksCount > 0,
      icon: Link2,
      actionLabel: "Criar link",
      action: () => onNavigateTab("links"),
      guideTab: "utm" as const,
    },
    {
      id: "step-sales",
      title: "6. Meta Ads & Validar Vendas",
      description:
        "Sincronize gastos e valide o envio automático pelo CAPI.",
      done: salesCount > 0 || hasMetaConnected,
      icon: ShoppingBag,
      actionLabel: "Ver métricas",
      action: () => onNavigateTab("visao"),
      guideTab: "capi" as const,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const isAllComplete = completedCount === steps.length;

  return (
    <>
      {!dismissed && (
        <div
          className="panel"
          style={{
            marginBottom: "1.25rem",
            border: isAllComplete
              ? "1px solid #10B981"
              : "1px solid var(--line)",
            background: isAllComplete
              ? "rgba(16, 185, 129, 0.04)"
              : "var(--surface)",
            borderRadius: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
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
                  flexShrink: 0,
                }}
              >
                {isAllComplete ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <Sparkles size={20} />
                )}
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  {isAllComplete
                    ? "🎉 Operação 100% pronta para escalar com lucro!"
                    : "Passo a Passo: Deixe seu Rastreamento Pronto"}
                </h3>
                <p
                  style={{
                    margin: "0.15rem 0 0",
                    color: "var(--muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  {isAllComplete
                    ? "Gateway, tracker, Shield, Radar e Meta CAPI sincronizados com sucesso."
                    : `${completedCount} de ${steps.length} etapas concluídas · ${progressPercent}% pronto`}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="button small"
                onClick={() => openGuide("radar")}
                style={{
                  background: "linear-gradient(135deg, #5B34EA, #7C3AED)",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "0.35rem 0.75rem",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  boxShadow: "0 2px 6px rgba(91, 52, 234, 0.3)",
                }}
              >
                <BookOpen size={14} />
                Guia Passo a Passo Completo
              </button>

              <button
                type="button"
                className="button small ghost"
                onClick={toggleCollapse}
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
                background: isAllComplete
                  ? "#10B981"
                  : "linear-gradient(90deg, #5B34EA, #7C3AED)",
                borderRadius: 3,
                transition: "width 0.4s ease",
              }}
            />
          </div>

          {!collapsed && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
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
                      borderRadius: "10px",
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.35rem",
                        }}
                      >
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

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginLeft: "1.4rem",
                        marginTop: "4px",
                      }}
                    >
                      {!step.done && (
                        <button
                          type="button"
                          className="button small primary"
                          onClick={step.action}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.25rem 0.6rem",
                          }}
                        >
                          <Icon size={12} style={{ marginRight: 4 }} />
                          {step.actionLabel}
                        </button>
                      )}
                      <button
                        type="button"
                        className="button small ghost"
                        onClick={() => openGuide(step.guideTab)}
                        style={{
                          fontSize: "0.72rem",
                          padding: "0.25rem 0.5rem",
                          color: "var(--brand-accent, #5B34EA)",
                        }}
                        title="Ver como funciona este passo"
                      >
                        <HelpCircle size={12} style={{ marginRight: 3 }} />
                        Como usar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <GuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        initialTab={guideInitialTab}
        onNavigateTab={onNavigateTab}
      />
    </>
  );
}
