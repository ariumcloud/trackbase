"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import type {
  InsightRow,
  Entity,
  Offer,
  LinkRow,
  DiagnosticRow,
} from "@/lib/types";

interface AssistenteProps {
  workspace: string;
  metrics: {
    grossRevenue: number;
    netRevenue: number;
    platformFees: number;
    spend: number | null;
    operatingProfit: number | null;
    netMargin?: number | null;
    roas: number | null;
    roi: number | null;
    cpa: number | null;
    purchases: number;
    uniqueBuyers: number;
    averageTicket: number | null;
    refundedCount: number;
    refundRate: number | null;
    pageviews: number;
    ctas: number;
    checkouts: number;
    clicks: number;
    impressions: number;
  };
  currency: string;
  offers: Offer[];
  links: LinkRow[];
  insights: InsightRow[];
  entities: Entity[];
  diagnostics?: DiagnosticRow[];
}

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  tags?: string[];
}

export function AssistenteTrackbase({
  workspace,
  metrics,
  currency,
  offers,
  links,
  insights,
  entities,
  diagnostics,
}: AssistenteProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const money = useCallback(
    (v: number | null) =>
      v === null
        ? "—"
        : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v),
    [currency],
  );

  // Initialize with welcome message
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      const profitText =
        metrics.operatingProfit !== null
          ? metrics.operatingProfit >= 0
            ? `Lucro de **${money(metrics.operatingProfit)}**`
            : `Prejuízo de **${money(metrics.operatingProfit)}**`
          : "Gasto de Meta Ads não configurado ou em apuração";

      const roasText =
        metrics.roas !== null
          ? `ROAS em **${metrics.roas.toFixed(2)}x**`
          : "ROAS aguardando dados de investimento";

      return [
        {
          id: "welcome",
          sender: "assistant",
          text: `Olá! Sou o **Assistente Trackbase**, seu copiloto de tráfego direto, atribuição e CRO.
          
No momento, sua operação registra:
- 💰 Receita Bruta: **${money(metrics.grossRevenue)}** (${metrics.purchases} compras)
- 📢 Investimento Meta: **${money(metrics.spend)}**
- 📈 ${profitText} · ${roasText}
- 🎯 CPA Médio: **${money(metrics.cpa)}**
- 📦 Ofertas ativas: **${offers.length}** | Links UTM: **${links.length}**

Você pode me perguntar qualquer coisa sobre os resultados da sua operação, quais campanhas escalar ou pausar, onde estão seus gargalos ou tirar dúvidas estratégicas de direct response. Como posso te ajudar agora?`,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
      ];
    });
  }, [metrics, money, offers.length, links.length]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const quickPrompts = [
    { label: "📊 Meu ROAS e Lucro", query: "Qual meu ROAS, receita líquida e lucro operacional atual?" },
    { label: "🛑 Onde estou perdendo dinheiro?", query: "Onde estão os principais gargalos e perdas de tráfego do meu funil?" },
    { label: "🎯 Pausar ou Escalar?", query: "Quais campanhas devo pausar ou escalar com base no CPA e ROAS?" },
    { label: "🔄 Envio de Vendas pro Facebook", query: "Como o envio de conversões via servidor do Trackbase protege minhas vendas do bloqueio do iOS e AdBlock?" },
    { label: "🛒 Aumentar Ticket com Order Bump", query: "Como estruturar um Order Bump eficiente na minha esteira de produtos?" },
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: "cleared",
        sender: "assistant",
        text: "Histórico limpo. Em que posso te ajudar hoje na sua operação?",
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleSend = (textToSend?: string) => {
    const q = textToSend || input;
    if (!q.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace, query: q, context: { metrics, currency, offers, links, insights, entities, diagnostics } }),
    }).then(async (res) => {
      const data = await res.json();
      const responseText = data.text || data.error || "Não consegui responder agora.";
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: "assistant",
        text: responseText,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
      setLoading(false);
    }).catch(() => {
      setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, sender: "assistant", text: "Não consegui consultar a IA agora. Tente novamente em instantes.", timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) }]);
      setLoading(false);
    });
  };

  return (
    <div
      className="panel assistente-chat-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 210px)",
        minHeight: "480px",
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="assistente-header"
        style={{
          padding: "0.9rem 1.25rem",
          background: "linear-gradient(135deg, #17152F 0%, #2D1B69 100%)",
          color: "#FFFFFF",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#5B34EA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(91, 52, 234, 0.5)",
              flexShrink: 0,
            }}
          >
            <Bot size={18} color="#FFF" />
          </div>
          <div>
            <div className="assistente-title-row" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <strong className="assistente-title" style={{ fontSize: "1rem" }}>Assistente Trackbase IA</strong>
              <span
                className="assistente-online"
                style={{
                  fontSize: "0.68rem",
                  padding: "0.15rem 0.45rem",
                  borderRadius: "10px",
                  background: "#10B981",
                  color: "#FFF",
                  fontWeight: 600,
                }}
              >
                ONLINE
              </span>
            </div>
            <small className="assistente-header-sub" style={{ color: "#CBD5E1", fontSize: "0.78rem" }}>
              Especialista em tráfego direto, métricas em tempo real e CRO
            </small>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClear}
          title="Limpar conversa"
          className="assistente-clear-button"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "#FFF",
            padding: "0.4rem 0.6rem",
            borderRadius: "6px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            fontSize: "0.8rem",
          }}
        >
          <Trash2 size={14} /> Limpar
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div
        className="assistente-messages"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          background: "var(--surface-subtle, #F8FAFC)",
        }}
      >
        {messages.map((m) => {
          const isBot = m.sender === "assistant";
          return (
            <div
              className={`assistente-message-row ${isBot ? "is-bot" : "is-user"}`}
              key={m.id}
              style={{
                display: "flex",
                gap: "0.75rem",
                alignSelf: isBot ? "flex-start" : "flex-end",
                maxWidth: "85%",
                flexDirection: isBot ? "row" : "row-reverse",
              }}
            >
              <div
                className="assistente-message-avatar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: isBot ? "#17152F" : "#5B34EA",
                  color: "#FFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "0.8rem",
                }}
              >
                {isBot ? <Bot size={17} /> : <User size={17} />}
              </div>

              <div
                className={`assistente-message-bubble ${isBot ? "is-bot" : "is-user"}`}
                style={{
                  background: isBot ? "var(--surface, #FFFFFF)" : "#5B34EA",
                  color: isBot ? "var(--ink, #0F172A)" : "#FFFFFF",
                  padding: "0.85rem 1.15rem",
                  borderRadius: isBot ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  border: isBot ? "1px solid var(--line, #E2E8F0)" : "none",
                  fontSize: "0.92rem",
                  lineHeight: "1.55",
                  position: "relative",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.text}

                <div
                  className="assistente-message-meta"
                  style={{
                    display: "flex",
                    justifyContent: isBot ? "space-between" : "flex-end",
                    alignItems: "center",
                    marginTop: "0.5rem",
                    paddingTop: "0.35rem",
                    borderTop: isBot ? "1px solid var(--line, #F1F5F9)" : "1px solid rgba(255,255,255,0.2)",
                    fontSize: "0.72rem",
                    color: isBot ? "var(--muted, #94A3B8)" : "rgba(255,255,255,0.75)",
                  }}
                >
                  <span>{m.timestamp}</span>
                  {isBot && (
                    <button
                      type="button"
                      onClick={() => handleCopy(m.id, m.text)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748B",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check size={12} color="#10B981" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copiar
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: "flex", gap: "0.75rem", alignSelf: "flex-start", alignItems: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#17152F",
                color: "#FFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bot size={17} />
            </div>
            <div
              style={{
                background: "#FFF",
                padding: "0.6rem 1rem",
                borderRadius: "4px 16px 16px 16px",
                border: "1px solid var(--line, #E2E8F0)",
                fontSize: "0.85rem",
                color: "var(--muted, #64748B)",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Sparkles size={14} className="animate-spin" color="#5B34EA" />
              <span>Analisando dados do workspace...</span>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Quick Prompts Chips */}
      <div
        className="assistente-chips-bar"
        style={{
          padding: "0.6rem 1.25rem",
          background: "var(--surface, #FFFFFF)",
          borderTop: "1px solid var(--line, #E2E8F0)",
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        {quickPrompts.map((p) => (
          <button
            key={p.label}
            type="button"
            className="button small ghost assistente-chip-btn"
            onClick={() => handleSend(p.query)}
            style={{
              fontSize: "0.78rem",
              padding: "0.3rem 0.7rem",
              borderRadius: "20px",
              borderColor: "var(--line, #E2E8F0)",
              background: "var(--surface-muted, #F8FAFC)",
              color: "var(--ink)",
              flexShrink: 0,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div
        className="assistente-input-area"
        style={{
          padding: "0.75rem 1rem",
          background: "var(--surface, #FFFFFF)",
          borderTop: "1px solid var(--line, #E2E8F0)",
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          className="assistente-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Pergunte sobre seu ROAS, campanhas, gargalos ou estratégias..."
          style={{
            flex: 1,
            padding: "0.65rem 0.9rem",
            borderRadius: "8px",
            border: "1px solid var(--line, #CBD5E1)",
            background: "var(--surface-subtle, #FFFFFF)",
            color: "var(--ink, #0F172A)",
            fontSize: "16px",
            outline: "none",
          }}
        />
        <button
          type="button"
          className="button primary assistente-send-btn"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          style={{
            padding: "0.65rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            flexShrink: 0,
          }}
        >
          <Send size={15} />
          <span className="assistente-send-text">Enviar</span>
        </button>
      </div>
    </div>
  );
}

export { AssistenteTrackbase as AssistenteKirofy };
