"use client";

import { useState, useEffect, useRef } from "react";
import {
  Smartphone,
  Eye,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Activity,
  Zap,
  ShieldCheck,
  ShoppingBag,
  Clock,
  Radio,
} from "lucide-react";

interface EventLog {
  id: string;
  time: string;
  type: string;
  label: string;
  detail: string;
  color: string;
}

export function LeadScrollVisualizer() {
  const phoneScrollRef = useRef<HTMLDivElement>(null);
  const [scrollPercent, setScrollPercent] = useState<number>(0);
  const [currentSection, setCurrentSection] = useState<string>("Topo / Dobra 1");
  const [secondsOnPage, setSecondsOnPage] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [reachedMilestones, setReachedMilestones] = useState<{
    pageview: boolean;
    scroll25: boolean;
    scroll50: boolean;
    scroll75: boolean;
    ctaView: boolean;
    checkout: boolean;
  }>({
    pageview: true,
    scroll25: false,
    scroll50: false,
    scroll75: false,
    ctaView: false,
    checkout: false,
  });

  const [logs, setLogs] = useState<EventLog[]>([
    {
      id: "init",
      time: "00:00",
      type: "PageView",
      label: "Lead acessou a página",
      detail: "UTMs e FBP capturados · Meta Pixel & CAPI acionados (EventID: ev_init)",
      color: "#3B82F6",
    },
  ]);

  // Cronômetro do tempo na página
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsOnPage((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const addLog = (type: string, label: string, detail: string, color: string) => {
    const timeStr = formatTime(secondsOnPage);
    setLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        time: timeStr,
        type,
        label,
        detail,
        color,
      },
      ...prev.slice(0, 19),
    ]);
  };

  // Trata a rolagem na tela do celular
  const handlePhoneScroll = () => {
    const el = phoneScrollRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight - el.clientHeight;
    const pct = Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100)));
    setScrollPercent(pct);

    // Identifica seção ativa
    if (pct < 20) {
      setCurrentSection("Dobra 1: Headline & VSL");
    } else if (pct < 45) {
      setCurrentSection("Seção 2: Os 3 Maiores Gargalos");
    } else if (pct < 70) {
      setCurrentSection("Seção 3: Prova Social & Resultados");
    } else if (pct < 90) {
      setCurrentSection("Seção 4: Oferta Irresistível & Preço");
    } else {
      setCurrentSection("Seção 5: Garantia 30 Dias & Checkout");
    }

    // Gatilhos de Marcos de Scroll
    if (pct >= 25 && !reachedMilestones.scroll25) {
      setReachedMilestones((prev) => ({ ...prev, scroll25: true }));
      addLog("ScrollDepth_25", "Lead passou da primeira dobra (25%)", "Superou o bounce inicial · Disparado fbq('trackCustom', 'ScrollDepth_25')", "#10B981");
    }
    if (pct >= 50 && !reachedMilestones.scroll50) {
      setReachedMilestones((prev) => ({ ...prev, scroll50: true }));
      addLog("ScrollDepth_50", "Lead consumiu metade da página (50%)", "Alto engajamento · Disparado fbq('trackCustom', 'ScrollDepth_50')", "#10B981");
    }
    if (pct >= 75 && !reachedMilestones.scroll75) {
      setReachedMilestones((prev) => ({ ...prev, scroll75: true }));
      addLog("ScrollDepth_75", "Lead chegou na Oferta e Bônus (75%)", "Público qualificado para remarketing · fbq('trackCustom', 'ScrollDepth_75')", "#F59E0B");
    }
    if (pct >= 85 && !reachedMilestones.ctaView) {
      setReachedMilestones((prev) => ({ ...prev, ctaView: true }));
      addLog("ViewCTA", "Botão de Compra visível no ecrã!", "Lead visualizou o botão de checkout · fbq('trackCustom', 'ViewCTA')", "#8B5CF6");
    }
  };

  // Simulação Automática de um Lead lendo a página
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoPlaying) {
      interval = setInterval(() => {
        const el = phoneScrollRef.current;
        if (!el) return;

        const maxScroll = el.scrollHeight - el.clientHeight;
        if (el.scrollTop >= maxScroll - 5) {
          setIsAutoPlaying(false);
          return;
        }

        // Simula pausas humanas e rolagem fluida
        el.scrollBy({ top: 35, behavior: "smooth" });
      }, 350);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handleReset = () => {
    setIsAutoPlaying(false);
    if (phoneScrollRef.current) {
      phoneScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    setScrollPercent(0);
    setCurrentSection("Dobra 1: Headline & VSL");
    setSecondsOnPage(0);
    setReachedMilestones({
      pageview: true,
      scroll25: false,
      scroll50: false,
      scroll75: false,
      ctaView: false,
      checkout: false,
    });
    setLogs([
      {
        id: "reset",
        time: "00:00",
        type: "PageView",
        label: "Nova sessão iniciada",
        detail: "Lead chegou na página de vendas · Sessão limpa e monitorando rolagem",
        color: "#3B82F6",
      },
    ]);
  };

  const handleCheckoutClick = () => {
    setReachedMilestones((prev) => ({ ...prev, checkout: true }));
    addLog(
      "InitiateCheckout",
      "Lead clicou no Botão de Compra!",
      "Redirecionando para Cakto/Kiwify com parâmetros sck, utm_source, utm_campaign injetados",
      "#EF4444"
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Top Banner Explicativo */}
      <div
        className="panel"
        style={{
          background: "linear-gradient(135deg, rgba(91, 52, 234, 0.08) 0%, rgba(56, 189, 248, 0.05) 100%)",
          border: "1px solid rgba(91, 52, 234, 0.2)",
          padding: "1.25rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 8px",
                borderRadius: "12px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10B981",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              <Radio size={12} className="spin" /> SENSOR ATIVO
            </span>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--ink)" }}>
              Visualizador de Rastreamento de Lead em Tempo Real
            </h2>
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
            Veja exatamente onde o lead está na página, quais seções ele lê, quando alcança os marcos de <strong>25%, 50%, 75%</strong> e quando visualiza o botão de compra.
          </p>
        </div>

        {/* Controles de Demonstração */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            className={`button ${isAutoPlaying ? "secondary" : "primary"}`}
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
          >
            {isAutoPlaying ? (
              <>
                <Pause size={15} /> Pausar Simulação
              </>
            ) : (
              <>
                <Play size={15} /> ▶ Simular Lead Automático
              </>
            )}
          </button>
          <button
            className="button ghost"
            onClick={handleReset}
            title="Reiniciar Simulação"
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <RotateCcw size={15} /> Reiniciar
          </button>
        </div>
      </div>

      {/* Grid Principal Lado a Lado: Celular Mockup vs Painel de Telemetria */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: "1.75rem",
          alignItems: "start",
        }}
        className="lead-visualizer-grid"
      >
        {/* COLUNA ESQUERDA: Celular Mockup Interativo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "var(--muted)" }}>
            <Smartphone size={15} />
            <span>Role a tela do celular abaixo:</span>
          </div>

          {/* Smartphone Frame (Estilo iPhone) */}
          <div
            style={{
              width: "340px",
              height: "640px",
              background: "#090D16",
              borderRadius: "44px",
              padding: "12px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 4px #1E293B, 0 0 0 8px #0F172A",
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Ilha Dinâmica / Notch do Celular */}
            <div
              style={{
                position: "absolute",
                top: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "95px",
                height: "22px",
                background: "#000000",
                borderRadius: "14px",
                zIndex: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 8px",
              }}
            >
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#111" }} />
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#1a1a2e" }} />
            </div>

            {/* Tela com Rolagem do Celular (Página de Vendas Mockup) */}
            <div
              ref={phoneScrollRef}
              onScroll={handlePhoneScroll}
              style={{
                width: "100%",
                height: "100%",
                background: "#FFFFFF",
                borderRadius: "34px",
                overflowY: "auto",
                overflowX: "hidden",
                position: "relative",
                fontFamily: "system-ui, -apple-system, sans-serif",
                color: "#0F172A",
                scrollbarWidth: "none",
              }}
            >
              {/* Barra de Status do Celular */}
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "38px",
                  background: "rgba(255, 255, 255, 0.92)",
                  backdropFilter: "blur(6px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 18px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "#0F172A",
                  zIndex: 20,
                  borderBottom: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <span>9:41</span>
                <span style={{ fontSize: "0.68rem", color: "#64748B" }}>4G · 100%</span>
              </div>

              {/* Indicador Flutuante de Scroll no Celular */}
              <div
                style={{
                  position: "sticky",
                  top: "38px",
                  left: 0,
                  right: 0,
                  height: "3px",
                  background: "#E2E8F0",
                  zIndex: 25,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${scrollPercent}%`,
                    background: "linear-gradient(90deg, #10B981, #5B34EA)",
                    transition: "width 0.1s ease-out",
                  }}
                />
              </div>

              {/* CONTEÚDO DA PÁGINA DE VENDAS ALEATÓRIA (MOCKUP REALISTA) */}
              <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* DOBRA 1 (0% a 25%) */}
                <div style={{ textAlign: "center" }}>
                  <span
                    style={{
                      background: "#FEE2E2",
                      color: "#DC2626",
                      padding: "3px 10px",
                      borderRadius: "20px",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      display: "inline-block",
                      marginBottom: "8px",
                    }}
                  >
                    🔴 NOVO MÉTODO COMPROVADO
                  </span>
                  <h1 style={{ fontSize: "1.05rem", fontWeight: 800, lineHeight: 1.3, margin: "0 0 8px" }}>
                    Como Faturar R$ 10k a 30k/Mês com Tráfego Sem Tomar Bloqueios
                  </h1>
                  <p style={{ fontSize: "0.75rem", color: "#475569", lineHeight: 1.4, margin: "0 0 12px" }}>
                    Veja o passo a passo exato para rastrear 100% das suas vendas e escalar campanhas com lucro garantido.
                  </p>

                  {/* VSL Player Mock */}
                  <div
                    style={{
                      width: "100%",
                      height: "155px",
                      background: "#0F172A",
                      borderRadius: "14px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFFFFF",
                      position: "relative",
                      overflow: "hidden",
                      boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                    }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        background: "#EF4444",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 0 20px rgba(239, 68, 68, 0.6)",
                      }}
                    >
                      <Play size={20} fill="#FFF" style={{ marginLeft: "2px" }} />
                    </div>
                    <span style={{ fontSize: "0.7rem", marginTop: "8px", fontWeight: 600 }}>
                      ▶ VSL Exclusiva (14:20)
                    </span>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 6,
                        left: 10,
                        right: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.62rem",
                        color: "#94A3B8",
                      }}
                    >
                      <span>03:45</span>
                      <span>Assista até o final</span>
                    </div>
                  </div>
                </div>

                {/* DOBRA 2 (25% a 50%) - Seção de Dores */}
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "14px 12px",
                  }}
                >
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#5B34EA", textTransform: "uppercase" }}>
                    Marco 25% · O Problema
                  </span>
                  <h3 style={{ fontSize: "0.88rem", fontWeight: 700, margin: "4px 0 8px" }}>
                    Você está jogando 40% da sua verba de anúncio no lixo!
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.72rem", color: "#334155" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ color: "#EF4444", fontWeight: 700 }}>✖</span>
                      <span>O Meta Ads não recebe as vendas dos checkouts e desotimiza suas campanhas.</span>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ color: "#EF4444", fontWeight: 700 }}>✖</span>
                      <span>Você não sabe qual criativo realmente gerou o lucro no final do dia.</span>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ color: "#EF4444", fontWeight: 700 }}>✖</span>
                      <span>Leads saem da página sem você saber onde eles pararam de ler.</span>
                    </div>
                  </div>
                </div>

                {/* DOBRA 3 (50% a 75%) - Prova Social */}
                <div
                  style={{
                    background: "linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)",
                    border: "1px solid #BBF7D0",
                    borderRadius: "14px",
                    padding: "14px 12px",
                  }}
                >
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#16A34A", textTransform: "uppercase" }}>
                    Marco 50% · Prova Social
                  </span>
                  <h3 style={{ fontSize: "0.88rem", fontWeight: 700, margin: "4px 0 8px" }}>
                    Mais de 3.420 gestores e infoprodutores escalando
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ background: "#FFF", padding: "8px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "0.7rem" }}>
                      <strong>&quot;Faturei R$ 42.000 no primeiro mês&quot;</strong>
                      <p style={{ margin: "2px 0 0", color: "#64748B", fontSize: "0.65rem" }}>
                        &quot;O rastreamento me mostrou que o lead lia até o preço e não comprava. Ajustei a oferta e explodiu!&quot; — Lucas M.
                      </p>
                    </div>
                    <div style={{ background: "#FFF", padding: "8px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "0.7rem" }}>
                      <strong>&quot;ROI de 4.8x em tráfego direto&quot;</strong>
                      <p style={{ margin: "2px 0 0", color: "#64748B", fontSize: "0.65rem" }}>
                        &quot;CAPI sincronizada na hora e remarketing só pra quem viu 75% da página.&quot; — Camila R.
                      </p>
                    </div>
                  </div>
                </div>

                {/* DOBRA 4 (75% a 90%) - Oferta & Preço */}
                <div
                  style={{
                    background: "linear-gradient(135deg, #FAF5FF 0%, #FFFFFF 100%)",
                    border: "2px solid #C084FC",
                    borderRadius: "14px",
                    padding: "14px 12px",
                    textAlign: "center",
                  }}
                >
                  <span
                    style={{
                      background: "#5B34EA",
                      color: "#FFF",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                    }}
                  >
                    🔥 OFERTA POR TEMPO LIMITADO
                  </span>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "8px 0 4px" }}>
                    Acesso Completo + 4 Bônus VIP
                  </h3>
                  <div style={{ margin: "10px 0" }}>
                    <span style={{ textDecoration: "line-through", color: "#94A3B8", fontSize: "0.75rem" }}>De R$ 997,00</span>
                    <div style={{ fontSize: "1.35rem", fontWeight: 900, color: "#16A34A", lineHeight: 1.1 }}>
                      12x de R$ 29,70
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "#64748B" }}>ou R$ 297 à vista</span>
                  </div>

                  {/* BOTÃO DE CHECKOUT (CTA) */}
                  <button
                    onClick={handleCheckoutClick}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                      color: "#FFFFFF",
                      border: "none",
                      fontWeight: 800,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "transform 0.1s ease",
                    }}
                  >
                    <ShoppingBag size={15} /> QUERO GARANTIR MINHA VAGA
                  </button>
                  <span style={{ fontSize: "0.62rem", color: "#64748B", display: "block", marginTop: "6px" }}>
                    🔒 Pagamento 100% Seguro · Acesso Imediato
                  </span>
                </div>

                {/* DOBRA 5 (90% a 100%) - Garantia & Rodapé */}
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "12px",
                    textAlign: "center",
                  }}
                >
                  <ShieldCheck size={28} color="#10B981" style={{ margin: "0 auto 4px" }} />
                  <h4 style={{ fontSize: "0.82rem", fontWeight: 700, margin: "0 0 4px" }}>
                    Garantia Incondicional de 30 Dias
                  </h4>
                  <p style={{ fontSize: "0.68rem", color: "#64748B", margin: 0, lineHeight: 1.3 }}>
                    Se você não tiver resultados reais ou não gostar do conteúdo, devolvemos cada centavo sem perguntas.
                  </p>
                </div>

                <div style={{ textAlign: "center", fontSize: "0.62rem", color: "#94A3B8", paddingBottom: "20px" }}>
                  © 2026 Método Escala Digital · Todos os direitos reservados.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Painel de Telemetria e Eventos em Tempo Real */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Card 1: Gauge de Posição do Lead */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={18} color="#5B34EA" />
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>
                  Posicionamento do Lead na Página
                </h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--muted)" }}>
                <Clock size={14} />
                <span>Tempo na tela: <strong>{formatTime(secondsOnPage)}</strong></span>
              </div>
            </div>

            {/* Barra de Progresso de Rolagem */}
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>Profundidade de Rolagem (Scroll Depth)</span>
                <strong style={{ color: "#5B34EA", fontSize: "1.1rem" }}>{scrollPercent}%</strong>
              </div>
              <div style={{ width: "100%", height: "10px", background: "var(--line)", borderRadius: "6px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${scrollPercent}%`,
                    background: "linear-gradient(90deg, #10B981 0%, #3B82F6 50%, #5B34EA 100%)",
                    transition: "width 0.15s ease",
                  }}
                />
              </div>
            </div>

            {/* Badge da Seção Atualmente Lida */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: "var(--surface-subtle)",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                fontSize: "0.85rem",
              }}
            >
              <Eye size={16} color="#10B981" />
              <span style={{ color: "var(--muted)" }}>Lendo no momento:</span>
              <strong style={{ color: "var(--ink)" }}>{currentSection}</strong>
            </div>
          </div>

          {/* Card 2: Marcos de Leitura & Gatilhos do Funil */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>
              Marcos de Retenção & Disparos ao Meta Pixel / CAPI
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {/* Marco 1: PageView */}
              <div
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: reachedMilestones.pageview ? "rgba(16, 185, 129, 0.08)" : "var(--surface-subtle)",
                  border: `1px solid ${reachedMilestones.pageview ? "#10B981" : "var(--line)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: reachedMilestones.pageview ? "#10B981" : "var(--muted)" }}>
                    0% · ENTRADA
                  </span>
                  {reachedMilestones.pageview && <CheckCircle2 size={14} color="#10B981" />}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginTop: "2px", color: "var(--ink)" }}>PageView</div>
                <small style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Disparo CAPI sincronizado</small>
              </div>

              {/* Marco 2: Scroll 25% */}
              <div
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: reachedMilestones.scroll25 ? "rgba(16, 185, 129, 0.08)" : "var(--surface-subtle)",
                  border: `1px solid ${reachedMilestones.scroll25 ? "#10B981" : "var(--line)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: reachedMilestones.scroll25 ? "#10B981" : "var(--muted)" }}>
                    25% · DOBRA 1
                  </span>
                  {reachedMilestones.scroll25 && <CheckCircle2 size={14} color="#10B981" />}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginTop: "2px", color: "var(--ink)" }}>ScrollDepth_25</div>
                <small style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Superou rejeição inicial</small>
              </div>

              {/* Marco 3: Scroll 50% */}
              <div
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: reachedMilestones.scroll50 ? "rgba(16, 185, 129, 0.08)" : "var(--surface-subtle)",
                  border: `1px solid ${reachedMilestones.scroll50 ? "#10B981" : "var(--line)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: reachedMilestones.scroll50 ? "#10B981" : "var(--muted)" }}>
                    50% · MEIO DA PÁGINA
                  </span>
                  {reachedMilestones.scroll50 && <CheckCircle2 size={14} color="#10B981" />}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginTop: "2px", color: "var(--ink)" }}>ScrollDepth_50</div>
                <small style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Consumiu a história/dor</small>
              </div>

              {/* Marco 4: Scroll 75% */}
              <div
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: reachedMilestones.scroll75 ? "rgba(245, 158, 11, 0.1)" : "var(--surface-subtle)",
                  border: `1px solid ${reachedMilestones.scroll75 ? "#F59E0B" : "var(--line)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: reachedMilestones.scroll75 ? "#F59E0B" : "var(--muted)" }}>
                    75% · OFERTA
                  </span>
                  {reachedMilestones.scroll75 && <CheckCircle2 size={14} color="#F59E0B" />}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginTop: "2px", color: "var(--ink)" }}>ScrollDepth_75</div>
                <small style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Visualizou o preço/bônus</small>
              </div>

              {/* Marco 5: CTA View */}
              <div
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: reachedMilestones.ctaView ? "rgba(139, 92, 246, 0.1)" : "var(--surface-subtle)",
                  border: `1px solid ${reachedMilestones.ctaView ? "#8B5CF6" : "var(--line)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: reachedMilestones.ctaView ? "#8B5CF6" : "var(--muted)" }}>
                    CTA VISÍVEL
                  </span>
                  {reachedMilestones.ctaView && <CheckCircle2 size={14} color="#8B5CF6" />}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginTop: "2px", color: "var(--ink)" }}>ViewCTA</div>
                <small style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Botão de compra no ecrã</small>
              </div>

              {/* Marco 6: Checkout */}
              <div
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: reachedMilestones.checkout ? "rgba(239, 68, 68, 0.1)" : "var(--surface-subtle)",
                  border: `1px solid ${reachedMilestones.checkout ? "#EF4444" : "var(--line)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: reachedMilestones.checkout ? "#EF4444" : "var(--muted)" }}>
                    CLIQUE NO CHECKOUT
                  </span>
                  {reachedMilestones.checkout && <CheckCircle2 size={14} color="#EF4444" />}
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginTop: "2px", color: "var(--ink)" }}>InitiateCheckout</div>
                <small style={{ color: "var(--muted)", fontSize: "0.72rem" }}>SCK & UTMs injetados</small>
              </div>
            </div>
          </div>

          {/* Card 3: Feed de Disparos em Tempo Real (Terminal de Eventos) */}
          <div className="panel" style={{ padding: "1.25rem", flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Zap size={16} color="#F59E0B" />
                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>
                  Feed de Eventos Disparados em Tempo Real
                </h3>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{logs.length} eventos registrados</span>
            </div>

            {/* Lista com Rolagem dos Eventos */}
            <div
              style={{
                background: "var(--surface-subtle)",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                padding: "8px 12px",
                maxHeight: "220px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    background: "var(--surface)",
                    borderLeft: `3px solid ${log.color}`,
                    fontSize: "0.8rem",
                  }}
                >
                  <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--muted)" }}>
                    [{log.time}]
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: `${log.color}15`,
                          color: log.color,
                        }}
                      >
                        {log.type}
                      </span>
                      <strong style={{ color: "var(--ink)" }}>{log.label}</strong>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>
                      {log.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
