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
    { label: "🔄 Como configurar a CAPI?", query: "Como a CAPI server-side do Trackbase funciona e evita eventos duplicados?" },
    { label: "🛒 Aumentar Ticket com Order Bump", query: "Como estruturar um Order Bump eficiente na minha esteira de produtos?" },
    { label: "⚡ Como usar o Clonador", query: "Como funciona o Clonador de Funil do Trackbase com injeção de tracking?" },
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

  const answerQuery = (userQuery: string): string => {
    const q = userQuery.toLowerCase().trim();

    // 1. ROAS, Lucro, Receita
    if (q.includes("roas") || q.includes("lucro") || q.includes("receita") || q.includes("faturamento")) {
      const roasVal = metrics.roas ? `${metrics.roas.toFixed(2)}x` : "Indisponível";
      const marginVal = metrics.netMargin ? `${metrics.netMargin.toFixed(1)}%` : "—";
      const statusProf =
        metrics.operatingProfit !== null && metrics.operatingProfit > 0
          ? "✅ Sua operação está no **azul** (lucrativa)."
          : metrics.operatingProfit !== null && metrics.operatingProfit < 0
          ? "⚠️ Sua operação está no **vermelho** (prejuízo no período)."
          : "ℹ️ Operação sem custo de tráfego computado.";

      return `### 📊 Análise Financeira Consolidada:

- **Receita Bruta:** ${money(metrics.grossRevenue)} (${metrics.purchases} pedidos aprovados)
- **Taxas de Gateway:** ${money(metrics.platformFees)}
- **Receita Líquida:** ${money(metrics.netRevenue)}
- **Investimento em Mídia:** ${money(metrics.spend)}
- **Lucro Operacional:** ${money(metrics.operatingProfit)} (Margem Líquida: ${marginVal})
- **ROAS Real:** **${roasVal}**

${statusProf}

> **Recomendação Tática:** ${
        metrics.roas && metrics.roas >= 2.5
          ? "Com ROAS acima de 2.5x, você tem margem para escalar 15% a 20% do orçamento diário nos conjuntos campeões a cada 48 horas."
          : metrics.roas && metrics.roas >= 1.5
          ? "Seu ROAS está na faixa de sustentação. Recomendamos adicionar 1 ou 2 Order Bumps no checkout (ex: garantia estendida ou material complementar) para elevar o ticket médio e destravar margem."
          : "Cuidado com o CPA atual. Faça uma auditoria nos anúncios que gastaram mais de 2x o seu CPA alvo sem gerar vendas e pause-os imediatamente."
      }`;
    }

    // 2. Gargalos e perdas no funil
    if (q.includes("gargalo") || q.includes("perdendo dinheiro") || q.includes("funil") || q.includes("perda")) {
      const pvRate = metrics.clicks > 0 ? (metrics.pageviews / metrics.clicks) * 100 : 0;
      const ctaRate = metrics.pageviews > 0 ? (metrics.ctas / metrics.pageviews) * 100 : 0;
      const chkRate = metrics.ctas > 0 ? (metrics.checkouts / metrics.ctas) * 100 : 0;
      const saleRate = metrics.checkouts > 0 ? (metrics.purchases / metrics.checkouts) * 100 : 0;

      let topBottleneck = "Não foram detectados gargalos severos no momento.";
      let estLoss = "R$ 0,00";

      if (diagnostics && diagnostics.length > 0) {
        const d = diagnostics[0];
        const bList = Array.isArray(d.bottlenecks)
          ? (d.bottlenecks as Array<{ message?: string; estimated_loss_brl?: number }>)
          : [];
        if (bList.length > 0) {
          topBottleneck = bList[0].message || "Gargalo no funil de conversão";
          estLoss = `R$ ${Number(bList[0].estimated_loss_brl || 0).toFixed(2)}`;
        }
      } else if (metrics.clicks > 0 && pvRate < 70) {
        topBottleneck = `Perda de tráfego entre cliques da Meta (${metrics.clicks}) e visitas carregadas (${metrics.pageviews}) — retenção de apenas ${pvRate.toFixed(1)}%.`;
        estLoss = money((metrics.spend || 0) * ((75 - pvRate) / 100));
      } else if (chkRate > 0 && saleRate < 10) {
        topBottleneck = `Queda brusca no checkout: de ${metrics.checkouts} checkouts iniciados, apenas ${metrics.purchases} compras foram aprovadas (${saleRate.toFixed(1)}%).`;
        estLoss = money(metrics.checkouts * 0.15 * (metrics.averageTicket || 97));
      }

      return `### 🛑 Auditoria de Gargalos do Funil:

1. **Taxa de Carregamento (Meta → Página):** ${pvRate > 0 ? `${pvRate.toFixed(1)}%` : "Aguardando cliques"}
   ${pvRate < 75 ? "⚠️ *Página lenta ou carregamento pesado faz o lead desistir antes de abrir.*" : "✅ *Retenção saudável.*"}

2. **Engajamento com o CTA (Visita → Botão):** ${ctaRate > 0 ? `${ctaRate.toFixed(1)}%` : "—"}
   ${ctaRate < 15 ? "⚠️ *Oferta ou VSL fraca. A maioria dos visitantes não desce até o botão de compra.*" : "✅ *Bom engajamento.*"}

3. **Conversão do Checkout (Checkout → Compra):** ${saleRate > 0 ? `${saleRate.toFixed(1)}%` : "—"}
   ${saleRate < 20 ? "⚠️ *Abandono de checkout alto. Verifique meios de pagamento (PIX em 1 clique), taxas de parcelamento e opções de frete.*" : "✅ *Conversão sólida.*"}

> **Gargalo Principal Identificado:**
> **${topBottleneck}**
> 💸 **Impacto financeiro estimado:** ~${estLoss}/período.

**Ação prática:** Acesse a aba **Diagnóstico de Funil** no menu lateral para rodar a auditoria profunda de copy, velocidade e mobile.`;
    }

    // 3. Pausar ou Escalar Campanhas
    if (q.includes("pausar") || q.includes("escalar") || q.includes("campanha") || q.includes("anuncio") || q.includes("cpa")) {
      const entityMap = new Map(entities.map((e) => [e.external_id, e.name]));
      const campAgg = new Map<string, { spend: number; clicks: number; imp: number }>();

      for (const inst of insights) {
        const cur = campAgg.get(inst.campaign_id) || { spend: 0, clicks: 0, imp: 0 };
        cur.spend += Number(inst.spend || 0);
        cur.clicks += Number(inst.clicks || 0);
        cur.imp += Number(inst.impressions || 0);
        campAgg.set(inst.campaign_id, cur);
      }

      const campList = Array.from(campAgg.entries()).map(([id, data]) => ({
        id,
        name: entityMap.get(id) || id,
        ...data,
      }));

      campList.sort((a, b) => b.spend - a.spend);

      if (campList.length === 0) {
        return `### 🎯 Diretrizes de Escala & Pausa (Meta Ads):

Você ainda não sincronizou campanhas da Meta Ads neste workspace ou não houve gasto no período selecionado.

**Regras de Ouro Trackbase para Direct Response:**
1. **Regra de Pausa:** Se um conjunto de anúncios gastar **1.5x a 2x o seu CPA alvo** sem gerar nenhuma venda aprovada, **pause imediatamente**.
2. **Regra de Escala Vertical:** Se o conjunto estiver com **ROAS acima de 2.2x** e com pelo menos 5 vendas nos últimos 3 dias, aumente o orçamento em **15% a 20%** ao meio-dia.
3. **Regra de Escala Horizontal:** Duplique o criativo vencedor para um novo público lookalike ou aberto (broad) com criativos variações de gancho (hook).`;
      }

      const topSpend = campList.slice(0, 3);
      const campAnalysis = topSpend
        .map(
          (c) =>
            `- **${c.name}:** Gasto: R$ ${c.spend.toFixed(2)} | Cliques: ${c.clicks} | CPC Médio: R$ ${(c.clicks > 0 ? c.spend / c.clicks : 0).toFixed(2)}`,
        )
        .join("\n");

      return `### 🎯 Análise das Principais Campanhas Ativas:

${campAnalysis}

**Recomendações Práticas:**
- **Campanhas com CPC acima da média:** Se o CTR estiver abaixo de 1.2%, troque os primeiros 3 segundos do criativo (gancho/headline) para baixar o CPC.
- **Campanhas com alto volume de cliques e sem venda:** O problema está na promessa da página ou no preço de entrada. Alinhe a comunicação do anúncio diretamente com a Headline da página clonada.`;
    }

    // 4. Meta CAPI e Deduplicação
    if (q.includes("capi") || q.includes("pixel") || q.includes("deduplica") || q.includes("conversions api")) {
      return `### 🔄 Como o Trackbase implementa Meta CAPI sem duplicar eventos:

O Trackbase utiliza a arquitetura recomendada oficialmente pela Meta para máxima nota de correspondência (EMQ):

1. **Mesmo Event ID:** Tanto o script do navegador quanto o servidor backend usam exatamente o mesmo \`event_id\` para o mesmo evento de PageView, InitiateCheckout ou Purchase.
2. **Deduplicação Automática na Meta:** A Meta recebe o evento do navegador via Pixel JS e o evento do servidor via Graph API. Por terem o mesmo \`event_id\`, ela descarta o duplicado e aproveita os parâmetros enriquecidos.
3. **Hashing SHA-256 Estrito em Dados Sensíveis:** E-mail e telefone são normalizados (minúsculas, trim, E.164) e recebem hash SHA-256 no backend.
4. **Preservação de FBP, FBC, IP e User-Agent:** Estes valores NÃO recebem hash, pois a Meta exige os cookies \`_fbp\` e \`_fbc\` brutos para atribuição precisa em iOS 14.5+.
5. **Criptografia AES-256-GCM:** Seu token de acesso da CAPI fica gravado no banco de dados com criptografia de ponta e nunca vaza no front-end.`;
    }

    // 5. Order Bump e Esteira
    if (q.includes("order bump") || q.includes("upsell") || q.includes("ticket") || q.includes("esteira")) {
      return `### 🛒 Estratégia de Order Bump & Aumento de LTV:

O Trackbase rastreia order bumps e upsells separadamente para não inflar a contagem de clientes únicos:

**3 Tipos de Order Bump que mais convertem em Direct Response:**
1. **Garantia Estendida / Blindagem:** "Garantia em dobro (60 dias) por apenas R$ 19,90" (converte entre 35% e 55%).
2. **Acelerador de Resultados / Template:** "Planilha/Templates prontos para copiar e colar por R$ 27,00" (ótimo para infoprodutos).
3. **Acesso Vitalício / Conteúdo VIP:** "Acesso sem expiração + grupo de networking por R$ 37,00".

> **Dica Trackbase:** O preço do order bump deve ser entre **15% e 35% do valor do produto principal**. Nunca coloque um bump mais caro que a oferta base.`;
    }

    // 6. Clonador de Funil
    if (q.includes("clona") || q.includes("clonador") || q.includes("pagina") || q.includes("autonomo")) {
      return `### ⚡ Como usar o Clonador de Funil Trackbase:

1. Acesse a aba **Clonador de Funil** no menu lateral.
2. Insira a URL da página que você possui autorização para operar.
3. O Trackbase extrai a estrutura, remove scripts e pixels de terceiros (para evitar que você envie tráfego com o pixel do concorrente).
4. No editor visual de blocos, você ajusta a headline, VSL e substitui os links de checkout pelos seus links de afiliado/produtor.
5. O Trackbase injeta o script de rastreamento oficial e permite:
   - **Download do HTML Autônomo:** Suba diretamente na sua VPS, Hostinger ou Vercel.
   - **Exportar JSON:** Para versionamento e duplicações rápidas.`;
    }

    // Default Fallback
    return `### 💡 Análise Estratégica Trackbase:

Entendi sua pergunta sobre "${userQuery}".

Com base nos dados atuais da sua operação:
- **Receita Bruta:** ${money(metrics.grossRevenue)}
- **Investimento Meta:** ${money(metrics.spend)}
- **Lucro Operacional:** ${money(metrics.operatingProfit)}
- **ROAS:** ${metrics.roas ? `${metrics.roas.toFixed(2)}x` : "—"}
- **Total de Compras:** ${metrics.purchases} vendas aprovadas

Para otimizar essa métrica específica, certifique-se de que:
1. Todos os links de checkout estão decorados com as UTMs corretas (\`utm_source=meta\`, \`utm_campaign={{campaign.name}}\`).
2. O webhook do seu gateway (Hotmart, Cakto, Kiwify, etc.) está ativo para atualizar o status das transações em tempo real.
3. Você está monitorando a taxa de conversão da página com o **Diagnóstico de Funil** para não queimar verba de tráfego em páginas com alta taxa de rejeição.

Quer que eu aprofunde algum ponto específico?`;
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

    setTimeout(() => {
      const responseText = answerQuery(q);
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: "assistant",
        text: responseText,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
      setLoading(false);
    }, 400);
  };

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 210px)",
        minHeight: "560px",
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1rem 1.25rem",
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
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#5B34EA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(91, 52, 234, 0.5)",
            }}
          >
            <Bot size={20} color="#FFF" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <strong style={{ fontSize: "1.05rem" }}>Assistente Trackbase IA</strong>
              <span
                style={{
                  fontSize: "0.7rem",
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
            <small style={{ color: "#CBD5E1", fontSize: "0.8rem" }}>
              Especialista em tráfego direto, métricas em tempo real e CRO
            </small>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClear}
          title="Limpar conversa"
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
                style={{
                  background: isBot ? "#FFFFFF" : "#5B34EA",
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
                  style={{
                    display: "flex",
                    justifyContent: isBot ? "space-between" : "flex-end",
                    alignItems: "center",
                    marginTop: "0.5rem",
                    paddingTop: "0.35rem",
                    borderTop: isBot ? "1px solid #F1F5F9" : "1px solid rgba(255,255,255,0.2)",
                    fontSize: "0.72rem",
                    color: isBot ? "#94A3B8" : "rgba(255,255,255,0.75)",
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
        style={{
          padding: "0.6rem 1.25rem",
          background: "#FFFFFF",
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
            className="button small ghost"
            onClick={() => handleSend(p.query)}
            style={{
              fontSize: "0.78rem",
              padding: "0.3rem 0.7rem",
              borderRadius: "20px",
              borderColor: "var(--line, #E2E8F0)",
              background: "#F8FAFC",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: "0.85rem 1.25rem",
          background: "#FFFFFF",
          borderTop: "1px solid var(--line, #E2E8F0)",
          display: "flex",
          gap: "0.6rem",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Pergunte sobre seu ROAS, campanhas, gargalos ou estratégias..."
          style={{
            flex: 1,
            padding: "0.65rem 1rem",
            borderRadius: "8px",
            border: "1px solid var(--line, #CBD5E1)",
            fontSize: "0.9rem",
            outline: "none",
          }}
        />
        <button
          type="button"
          className="button primary"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          style={{
            padding: "0.65rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <Send size={15} />
          <span>Enviar</span>
        </button>
      </div>
    </div>
  );
}

export { AssistenteTrackbase as AssistenteKirofy };
