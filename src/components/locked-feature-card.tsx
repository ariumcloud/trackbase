"use client";

import React from "react";
import {
  Lock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Radio,
  TrendingDown,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";

interface LockedFeatureCardProps {
  feature: "shield" | "diagnostico" | "radar";
}

const FEATURE_CONFIGS = {
  shield: {
    title: "Shield Anti-Bloqueio & Cloaker Inteligente",
    subtitle: "Proteja sua oferta contra analistas da Meta e concorrentes do AdHeart",
    icon: ShieldCheck,
    badge: "EXCLUSIVO PLANO PREMIUM",
    tagline:
      "Evite bloqueios repentinos em contas de anúncio e impeça que concorrentes espionem ou copiem suas páginas de vendas.",
    benefits: [
      "Tripla Proteção: White Page (Robôs), Black Page (Leads reais) e Gray Page (Espiões).",
      "Apontamento de CNAME no seu próprio domínio (Cloudflare, Registro.br, Hostinger).",
      "Detecção automática de revisores de anúncios da Meta, Google e ferramentas de spy.",
      "Tokens de sessão HMAC criptografados com expiração e proteção contra reutilização.",
      "Logs em tempo real de acessos bloqueados e liberados por IP, dispositivo e país.",
    ],
    upgradeUrl: "https://buy.stripe.com/4gMeVfeB86sRbV3cAP9IQ04", // Link Stripe Premium
    planName: "Plano Premium",
  },
  diagnostico: {
    title: "Diagnóstico de Gargalos & Auditoria Financeira",
    subtitle: "Descubra exatamente onde seu funil vaza dinheiro todo mês",
    icon: TrendingDown,
    badge: "PLANOS BÁSICO & PREMIUM",
    tagline:
      "Não fique no escuro: saiba em qual etapa do funil você está perdendo vendas e quantos Reais estão escorrendo pelo ralo.",
    benefits: [
      "Auditoria automática das 4 etapas: Cliques Meta → PageViews → Cliques CTA → Checkout → Compras.",
      "Cálculo exato de perda financeira estimada em R$ por lentidão ou abandono.",
      "Pontuação geral de saúde da operação (Score de 0 a 100).",
      "Recomendações práticas e imediatas para estancar o sangramento do tráfego.",
      "Comparativo de taxas de conversão de criativos e páginas.",
    ],
    upgradeUrl: "https://buy.stripe.com/aFa5kF3Wu8AZaQZ0S79IQ03", // Link Stripe Básico
    planName: "Plano Básico ou Premium",
  },
  radar: {
    title: "Radar de Leads & Mapa de Calor ao Vivo",
    subtitle: "Monitore visitantes na página em tempo real e recupere desistências",
    icon: Radio,
    badge: "PLANOS BÁSICO & PREMIUM",
    tagline:
      "Acompanhe o comportamento ao vivo dos visitantes: veja até qual dobra eles rolam a página e recupere quem desistiu no checkout.",
    benefits: [
      "Sessões ativas em tempo real com identificação de dispositivo, UTMs e tempo de permanência.",
      "Mapa de Calor de Rolagem (Dobra 0-25% Topo, 25-50% Vídeo, 50-75% Oferta, 75-100% Checkout).",
      "Simulador visual para testar o comportamento do lead antes de subir o tráfego.",
      "Script ultra-leve com carregamento assíncrono (não afeta o PageSpeed da sua landing).",
      "Filtros instantâneos por criativo e campanha para encontrar o melhor público.",
    ],
    upgradeUrl: "https://buy.stripe.com/aFa5kF3Wu8AZaQZ0S79IQ03", // Link Stripe Básico
    planName: "Plano Básico ou Premium",
  },
};

export function LockedFeatureCard({ feature }: LockedFeatureCardProps) {
  const config = FEATURE_CONFIGS[feature];
  const Icon = config.icon;

  return (
    <div
      style={{
        maxWidth: "880px",
        margin: "1.5rem auto",
        padding: "2.5rem 2rem",
        background: "var(--card-bg, #FFFFFF)",
        border: "1px solid var(--line, #E2E8F0)",
        borderRadius: "16px",
        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.06)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "5px",
          background: "linear-gradient(90deg, #5B34EA 0%, #3B82F6 50%, #10B981 100%)",
          borderTopLeftRadius: "15px",
          borderTopRightRadius: "15px",
        }}
      />

      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, rgba(91, 52, 234, 0.12), rgba(59, 130, 246, 0.12))",
            color: "var(--brand-accent, #5B34EA)",
            marginBottom: "1rem",
            border: "1px solid rgba(91, 52, 234, 0.2)",
          }}
        >
          <Lock size={30} />
        </div>

        <div style={{ marginBottom: "0.5rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "0.3rem 0.75rem",
              borderRadius: "999px",
              background: "rgba(91, 52, 234, 0.1)",
              color: "var(--brand-accent, #5B34EA)",
              textTransform: "uppercase",
            }}
          >
            <Sparkles size={13} /> {config.badge}
          </span>
        </div>

        <h2
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "var(--foreground, #0F172A)",
            margin: "0.5rem 0",
            letterSpacing: "-0.02em",
          }}
        >
          {config.title}
        </h2>
        <p
          style={{
            fontSize: "1rem",
            color: "var(--muted, #64748B)",
            maxWidth: "600px",
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {config.subtitle}
        </p>
      </div>

      <div
        style={{
          background: "var(--bg-elevated, #F8FAFC)",
          border: "1px solid var(--line, #E2E8F0)",
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <p
          style={{
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--foreground, #1E293B)",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Icon size={18} color="var(--brand-accent, #5B34EA)" />
          O que você desbloqueia nesta funcionalidade:
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {config.benefits.map((b, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                fontSize: "0.88rem",
                color: "var(--foreground, #334155)",
                lineHeight: 1.4,
              }}
            >
              <CheckCircle2
                size={16}
                style={{
                  color: "#10B981",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              />
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          borderTop: "1px solid var(--line, #E2E8F0)",
          paddingTop: "1.75rem",
        }}
      >
        <a
          href={config.upgradeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="button primary"
          style={{
            padding: "0.8rem 1.75rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 14px rgba(91, 52, 234, 0.3)",
          }}
        >
          <span>Fazer Upgrade para {config.planName}</span>
          <ArrowRight size={17} />
        </a>

        <a
          href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Estou%20no%20Trackbase%20e%20gostaria%20de%20testar%20as%20fun%C3%A7%C3%B5es%20de%20Shield%20e%20Radar%20de%20Leads"
          target="_blank"
          rel="noopener noreferrer"
          className="button ghost"
          style={{
            padding: "0.8rem 1.5rem",
            fontSize: "0.9rem",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            borderColor: "var(--line, #CBD5E1)",
          }}
        >
          <MessageCircle size={16} color="#10B981" />
          <span>Solicitar Teste VIP no WhatsApp</span>
        </a>
      </div>

      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <small style={{ color: "var(--muted, #94A3B8)", fontSize: "0.8rem" }}>
          Disponível no {config.planName} · Sem fidelidade · Cancele quando quiser
        </small>
      </div>
    </div>
  );
}