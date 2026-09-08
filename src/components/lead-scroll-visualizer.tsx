"use client";

import { useState, useEffect, useRef } from "react";
import {
  Radio,
  Play,
  Pause,
  CheckCircle2,
  Activity,
  ShieldCheck,
  ShoppingBag,
  Clock,
  MapPin,
  Eye,
  Plus,
  Compass,
} from "lucide-react";
import type { SaleRow } from "@/lib/types";

export interface LeadSession {
  id: string;
  leadNumber: number;
  name: string;
  location: string;
  device: string;
  source: string;
  campaign: string;
  relativeTime: string;
  maxScroll: number; // 0 a 100
  timeSpentSeconds: number;
  status: "purchased" | "checkout_clicked" | "cta_viewed" | "offer_viewed" | "bounced";
  statusLabel: string;
  statusColor: string;
  amount?: number;
  events: {
    time: string;
    type: string;
    label: string;
    detail: string;
    color: string;
  }[];
}

const initialMockLeads: LeadSession[] = [
  {
    id: "lead_8491",
    leadNumber: 8491,
    name: "Lucas M.",
    location: "São Paulo, SP",
    device: "iPhone 15 Pro · iOS 18",
    source: "Instagram Stories",
    campaign: "cbo_escala_v2 · Criativo 03",
    relativeTime: "Há 2 min",
    maxScroll: 100,
    timeSpentSeconds: 215,
    status: "purchased",
    statusLabel: "Comprou R$ 297,00",
    statusColor: "#10B981",
    amount: 297,
    events: [
      {
        time: "00:00",
        type: "PageView",
        label: "Lead acessou a página de vendas",
        detail: "UTM: source=instagram, campaign=cbo_escala_v2 · FBP e IP capturados",
        color: "#3B82F6",
      },
      {
        time: "00:25",
        type: "ScrollDepth_25",
        label: "Passou da primeira dobra (25%)",
        detail: "Lead assistiu ao início da VSL · Baixa taxa de rejeição",
        color: "#10B981",
      },
      {
        time: "01:40",
        type: "ScrollDepth_50",
        label: "Consumiu metade do conteúdo (50%)",
        detail: "Leu os 3 maiores gargalos de tráfego com alto engajamento",
        color: "#10B981",
      },
      {
        time: "02:50",
        type: "ScrollDepth_75",
        label: "Chegou na Seção de Oferta & Bônus (75%)",
        detail: "Visualizou os 4 bônus exclusivos e ancoragem de preço",
        color: "#F59E0B",
      },
      {
        time: "03:05",
        type: "ViewCTA",
        label: "Botão de Compra visível no ecrã (90%)",
        detail: "Botão pulsante 'QUERO GARANTIR MINHA VAGA' entrou no visor",
        color: "#8B5CF6",
      },
      {
        time: "03:20",
        type: "InitiateCheckout",
        label: "Lead clicou no Botão de Compra",
        detail: "Redirecionado com SCK e UTMs injetadas na Cakto/Kiwify",
        color: "#EF4444",
      },
      {
        time: "03:35",
        type: "Purchase",
        label: "Venda aprovada via Pix!",
        detail: "Valor de R$ 297,00 compensado instantaneamente",
        color: "#10B981",
      },
    ],
  },
  {
    id: "lead_8490",
    leadNumber: 8490,
    name: "Visitante Anônimo",
    location: "Curitiba, PR",
    device: "Samsung Galaxy S24 · Android 14",
    source: "Facebook Feed",
    campaign: "ad_criativo_direto_04",
    relativeTime: "Há 6 min",
    maxScroll: 88,
    timeSpentSeconds: 154,
    status: "cta_viewed",
    statusLabel: "Viu Oferta & Preço (88%)",
    statusColor: "#8B5CF6",
    events: [
      {
        time: "00:00",
        type: "PageView",
        label: "Lead acessou a página de vendas",
        detail: "UTM: source=facebook, campaign=ad_criativo_direto_04",
        color: "#3B82F6",
      },
      {
        time: "00:30",
        type: "ScrollDepth_25",
        label: "Passou da primeira dobra (25%)",
        detail: "Iniciou leitura do mecanismo único",
        color: "#10B981",
      },
      {
        time: "01:20",
        type: "ScrollDepth_50",
        label: "Super engajado na narrativa (50%)",
        detail: "Consumiu depoimentos de prova social",
        color: "#10B981",
      },
      {
        time: "02:10",
        type: "ScrollDepth_75",
        label: "Visualizou Oferta e Tabela de Preço (75%)",
        detail: "Público ultra qualificado para remarketing no Meta Ads",
        color: "#F59E0B",
      },
      {
        time: "02:30",
        type: "ViewCTA",
        label: "Botão de Compra visível no ecrã!",
        detail: "Lead viu o botão mas não clicou. Gargalo: objeção de garantia ou parcelamento.",
        color: "#8B5CF6",
      },
    ],
  },
  {
    id: "lead_8489",
    leadNumber: 8489,
    name: "Juliana F.",
    location: "Belo Horizonte, MG",
    device: "iPhone 14 · iOS 17",
    source: "Instagram Reels",
    campaign: "reels_historia_dor · Ad 02",
    relativeTime: "Há 14 min",
    maxScroll: 95,
    timeSpentSeconds: 198,
    status: "checkout_clicked",
    statusLabel: "Clicou no Checkout (95%)",
    statusColor: "#EF4444",
    events: [
      {
        time: "00:00",
        type: "PageView",
        label: "Lead acessou a página de vendas",
        detail: "UTM: source=instagram, campaign=reels_historia_dor",
        color: "#3B82F6",
      },
      {
        time: "00:20",
        type: "ScrollDepth_25",
        label: "Rolou até 25% da página",
        detail: "Dobra inicial ultrapassada",
        color: "#10B981",
      },
      {
        time: "01:10",
        type: "ScrollDepth_50",
        label: "Rolou até 50% da página",
        detail: "Assistiu 3 minutos da VSL",
        color: "#10B981",
      },
      {
        time: "02:15",
        type: "ScrollDepth_75",
        label: "Visualizou Oferta Completa (75%)",
        detail: "Analisou o preço de 12x de R$ 29,70",
        color: "#F59E0B",
      },
      {
        time: "02:40",
        type: "ViewCTA",
        label: "Botão de Compra no ecrã",
        detail: "Visualizou botão verde de checkout",
        color: "#8B5CF6",
      },
      {
        time: "03:10",
        type: "InitiateCheckout",
        label: "Clicou no Botão de Compra!",
        detail: "Iniciou checkout na plataforma de pagamento",
        color: "#EF4444",
      },
    ],
  },
  {
    id: "lead_8488",
    leadNumber: 8488,
    name: "Visitante Anônimo",
    location: "Campinas, SP",
    device: "Motorola Edge 40 · Android 14",
    source: "Google Pesquisa",
    campaign: "search_trafego_direto",
    relativeTime: "Há 22 min",
    maxScroll: 52,
    timeSpentSeconds: 65,
    status: "offer_viewed",
    statusLabel: "Parou na VSL/Dores (52%)",
    statusColor: "#3B82F6",
    events: [
      {
        time: "00:00",
        type: "PageView",
        label: "Lead acessou a página de vendas",
        detail: "Origem: Busca Orgânica / Google Ads",
        color: "#3B82F6",
      },
      {
        time: "00:25",
        type: "ScrollDepth_25",
        label: "Passou da dobra 1 (25%)",
        detail: "Leu a headline e deu play no vídeo",
        color: "#10B981",
      },
      {
        time: "01:00",
        type: "ScrollDepth_50",
        label: "Alcançou 50% da página",
        detail: "Sessão encerrada antes de ver o preço e a oferta",
        color: "#10B981",
      },
    ],
  },
  {
    id: "lead_8487",
    leadNumber: 8487,
    name: "Visitante Anônimo",
    location: "Fortaleza, CE",
    device: "Xiaomi Redmi Note 13",
    source: "Direto / Orgânico",
    campaign: "link_bio_instagram",
    relativeTime: "Há 35 min",
    maxScroll: 22,
    timeSpentSeconds: 12,
    status: "bounced",
    statusLabel: "Rejeição Rápida (22%)",
    statusColor: "#94A3B8",
    events: [
      {
        time: "00:00",
        type: "PageView",
        label: "Lead acessou a página de vendas",
        detail: "Acesso direto via link da bio",
        color: "#3B82F6",
      },
      {
        time: "00:12",
        type: "SessionEnd",
        label: "Saiu da página em 12 segundos",
        detail: "Não passou da primeira dobra. Possível desconexão com a promessa do anúncio.",
        color: "#94A3B8",
      },
    ],
  },
];

export function LeadScrollVisualizer({ sales = [] }: { sales?: SaleRow[] }) {
  const phoneScrollRef = useRef<HTMLDivElement>(null);
  const [leads, setLeads] = useState<LeadSession[]>(initialMockLeads);
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialMockLeads[0].id);
  const [filterType, setFilterType] = useState<"all" | "purchased" | "hot" | "cta" | "cold">("all");
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [currentScrollPct, setCurrentScrollPct] = useState<number>(0);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) || leads[0];

  // Se houver vendas reais no workspace, mescla os compradores reais
  useEffect(() => {
    if (!sales || sales.length === 0) return;
    const realBuyerLeads: LeadSession[] = sales.slice(0, 3).map((s, idx) => {
      const buyerName = s.attribution?.buyer_name || s.attribution?.name || "Comprador Verificado";
      const src = s.attribution?.utm_source || s.provider || "Tráfego Pago";
      const camp = s.attribution?.utm_campaign || "Campanha Principal";
      const num = 9000 + idx;
      return {
        id: `real_${s.id}`,
        leadNumber: num,
        name: buyerName,
        location: "Brasil",
        device: "Dispositivo do Comprador",
        source: src,
        campaign: camp,
        relativeTime: "Venda Real",
        maxScroll: 100,
        timeSpentSeconds: 180,
        status: "purchased",
        statusLabel: `Comprou R$ ${(s.gross_amount || s.amount || 0).toFixed(2)}`,
        statusColor: "#10B981",
        amount: s.gross_amount || s.amount || 0,
        events: [
          {
            time: "00:00",
            type: "PageView",
            label: "Acesso registrado no funil",
            detail: `Origem: ${src} · Campanha: ${camp}`,
            color: "#3B82F6",
          },
          {
            time: "00:28",
            type: "ScrollDepth_25",
            label: "Passou da dobra 1",
            detail: "Iniciou consumo do conteúdo",
            color: "#10B981",
          },
          {
            time: "01:30",
            type: "ScrollDepth_50",
            label: "Metade da página alcançada",
            detail: "Interesse validado",
            color: "#10B981",
          },
          {
            time: "02:20",
            type: "ScrollDepth_75",
            label: "Visualizou Oferta & Preço",
            detail: "Lead quente",
            color: "#F59E0B",
          },
          {
            time: "02:45",
            type: "ViewCTA",
            label: "Botão de compra no visor",
            detail: "Visualizou o checkout",
            color: "#8B5CF6",
          },
          {
            time: "03:00",
            type: "Purchase",
            label: `Compra aprovada na ${s.provider.toUpperCase()}!`,
            detail: `Valor: R$ ${(s.gross_amount || s.amount || 0).toFixed(2)}`,
            color: "#10B981",
          },
        ],
      };
    });

    setLeads((prev) => {
      const existingRealIds = new Set(prev.filter((p) => p.id.startsWith("real_")).map((p) => p.id));
      const toAdd = realBuyerLeads.filter((r) => !existingRealIds.has(r.id));
      return [...toAdd, ...prev];
    });
  }, [sales]);

  // Atualiza a posição do celular ao trocar de lead selecionado
  useEffect(() => {
    if (!selectedLead) return;
    setIsReplaying(false);
    const el = phoneScrollRef.current;
    if (!el) return;

    // Calcula o scroll até o ponto máximo daquele lead
    const maxScrollHeight = el.scrollHeight - el.clientHeight;
    const targetScrollTop = (selectedLead.maxScroll / 100) * maxScrollHeight;
    el.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    setCurrentScrollPct(selectedLead.maxScroll);
  }, [selectedLeadId, selectedLead]);

  // Modo Replay da Sessão (animação passo a passo do lead descendo a página)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isReplaying) {
      const el = phoneScrollRef.current;
      if (el) {
        el.scrollTo({ top: 0, behavior: "auto" });
      }
      setCurrentScrollPct(0);

      let step = 0;
      interval = setInterval(() => {
        const container = phoneScrollRef.current;
        if (!container) return;

        const maxScrollHeight = container.scrollHeight - container.clientHeight;
        const targetScrollTop = (selectedLead.maxScroll / 100) * maxScrollHeight;

        step += 35;
        if (step >= targetScrollTop) {
          container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
          setCurrentScrollPct(selectedLead.maxScroll);
          setIsReplaying(false);
          return;
        }

        container.scrollTo({ top: step, behavior: "smooth" });
        const pct = Math.min(100, Math.round((step / maxScrollHeight) * 100));
        setCurrentScrollPct(pct);
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isReplaying, selectedLead]);

  // Manual scroll handler
  const handlePhoneScroll = () => {
    const el = phoneScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    const pct = Math.min(100, Math.max(0, Math.round((el.scrollTop / maxScroll) * 100)));
    setCurrentScrollPct(pct);
  };

  // Simular a chegada de um Novo Lead em Tempo Real
  const handleAddLiveLead = () => {
    const randomNum = Math.floor(8492 + Math.random() * 500);
    const cities = ["Florianópolis, SC", "Goiânia, GO", "Salvador, BA", "Recife, PE", "Brasília, DF"];
    const sources = ["Instagram Stories", "TikTok Ads", "Facebook Feed", "Google Search"];
    const scrollOptions = [28, 55, 78, 92, 100];
    const pickedScroll = scrollOptions[Math.floor(Math.random() * scrollOptions.length)];
    const randomCity = cities[Math.floor(Math.random() * cities.length)];
    const randomSource = sources[Math.floor(Math.random() * sources.length)];

    const isPurchase = pickedScroll === 100;
    const isCta = pickedScroll >= 85;

    const newLead: LeadSession = {
      id: `lead_${randomNum}`,
      leadNumber: randomNum,
      name: isPurchase ? "Comprador Novo" : "Novo Visitante",
      location: randomCity,
      device: "iPhone 15 · 5G",
      source: randomSource,
      campaign: "cbo_escala_ao_vivo",
      relativeTime: "Agora mesmo",
      maxScroll: pickedScroll,
      timeSpentSeconds: pickedScroll * 2,
      status: isPurchase ? "purchased" : isCta ? "cta_viewed" : "offer_viewed",
      statusLabel: isPurchase ? "Comprou R$ 297,00" : isCta ? "Viu Oferta & Preço" : `Parou em ${pickedScroll}%`,
      statusColor: isPurchase ? "#10B981" : isCta ? "#8B5CF6" : "#3B82F6",
      amount: isPurchase ? 297 : undefined,
      events: [
        {
          time: "00:00",
          type: "PageView",
          label: "Lead acessou a página agora",
          detail: `Origem: ${randomSource} · IP e FBP registrados`,
          color: "#3B82F6",
        },
        ...(pickedScroll >= 25
          ? [
              {
                time: "00:20",
                type: "ScrollDepth_25",
                label: "Passou da primeira dobra (25%)",
                detail: "Interesse confirmado",
                color: "#10B981",
              },
            ]
          : []),
        ...(pickedScroll >= 50
          ? [
              {
                time: "01:10",
                type: "ScrollDepth_50",
                label: "Metade da página (50%)",
                detail: "Consumiu a história e mecanismo",
                color: "#10B981",
              },
            ]
          : []),
        ...(pickedScroll >= 75
          ? [
              {
                time: "02:00",
                type: "ScrollDepth_75",
                label: "Visualizou Oferta (75%)",
                detail: "Chegou na tabela de preços e bônus",
                color: "#F59E0B",
              },
            ]
          : []),
        ...(isCta
          ? [
              {
                time: "02:25",
                type: "ViewCTA",
                label: "Botão de Compra no Visor",
                detail: "Lead viu o botão de checkout",
                color: "#8B5CF6",
              },
            ]
          : []),
        ...(isPurchase
          ? [
              {
                time: "02:40",
                type: "Purchase",
                label: "Venda aprovada via Pix!",
                detail: "R$ 297,00 creditados na operação",
                color: "#10B981",
              },
            ]
          : []),
      ],
    };

    setLeads((prev) => [newLead, ...prev]);
    setSelectedLeadId(newLead.id);
  };

  // Filtro dos leads na barra
  const filteredLeads = leads.filter((l) => {
    if (filterType === "purchased") return l.status === "purchased";
    if (filterType === "hot") return l.maxScroll >= 75;
    if (filterType === "cta") return l.status === "cta_viewed" || l.status === "checkout_clicked";
    if (filterType === "cold") return l.maxScroll < 50;
    return true;
  });

  const formatSecs = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec.toString().padStart(2, "0")}s`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Top Banner do Radar de Leads */}
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
              <Radio size={12} className="spin" /> RADAR DE LEADS EM TEMPO REAL
            </span>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)" }}>
              Radar de Leads · Sessões Individuais do Funil
            </h2>
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
            Selecione qualquer lead abaixo para ver o percurso exato dele no celular, onde ele parou de ler, tempo na tela e eventos acionados.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            className="button primary"
            onClick={handleAddLiveLead}
            style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 650 }}
          >
            <Plus size={15} /> 📡 Simular Novo Lead Chegando
          </button>
        </div>
      </div>

      {/* SELETOR DE LEADS DO FUNIL (Sessões Individuais) */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Compass size={18} color="#5B34EA" />
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>
              Leads e Sessões Recentes no Funil ({leads.length})
            </h3>
          </div>

          {/* Filtros Rápidos */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              { id: "all", label: "Todos os Leads" },
              { id: "hot", label: "🔥 Na Oferta (75%+)" },
              { id: "purchased", label: "💰 Compradores" },
              { id: "cta", label: "🛒 Clicaram/Viram CTA" },
              { id: "cold", label: "❄️ Frios (<50%)" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id as "all" | "purchased" | "hot" | "cta" | "cold")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "1px solid",
                  borderColor: filterType === f.id ? "#5B34EA" : "var(--line)",
                  background: filterType === f.id ? "#5B34EA" : "var(--surface)",
                  color: filterType === f.id ? "#FFF" : "var(--muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards de Sessões Individuais (Grid com Scroll Horizontal Suave) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "0.75rem",
            maxHeight: "180px",
            overflowY: "auto",
            paddingRight: "4px",
          }}
        >
          {filteredLeads.map((lead) => {
            const isSelected = lead.id === selectedLeadId;
            return (
              <div
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: isSelected ? "2px solid #5B34EA" : "1px solid var(--line)",
                  background: isSelected ? "rgba(91, 52, 234, 0.06)" : "var(--surface-subtle)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "0.82rem", color: "var(--ink)" }}>
                    Lead #{lead.leadNumber} · {lead.name}
                  </strong>
                  <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{lead.relativeTime}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.72rem", color: "var(--muted)" }}>
                  <MapPin size={11} />
                  <span>{lead.location}</span>
                  <span>·</span>
                  <span>{lead.source}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: `${lead.statusColor}18`,
                      color: lead.statusColor,
                    }}
                  >
                    {lead.statusLabel}
                  </span>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink)" }}>
                    {lead.maxScroll}% rolado
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Principal Lado a Lado: Celular do Lead vs Telemetria da Sessão */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: "1.75rem",
          alignItems: "start",
        }}
        className="lead-visualizer-grid"
      >
        {/* COLUNA ESQUERDA: Celular Mockup com o percurso do Lead Selecionado */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          {/* Card Resumo do Lead Selecionado */}
          <div
            style={{
              width: "340px",
              padding: "10px 14px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              fontSize: "0.78rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: "var(--ink)" }}>
                Sessão: Lead #{selectedLead.leadNumber} ({selectedLead.name})
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
                {selectedLead.device} · {selectedLead.location}
              </div>
            </div>

            <button
              className="button secondary small"
              onClick={() => setIsReplaying(!isReplaying)}
              title="Ver replay da rolagem do lead"
              style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.72rem", padding: "4px 8px" }}
            >
              {isReplaying ? <Pause size={12} /> : <Play size={12} />}
              <span>{isReplaying ? "Pausar" : "Replay"}</span>
            </button>
          </div>

          {/* Smartphone Frame */}
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
            {/* Notch / Ilha Dinâmica */}
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

            {/* Tela com Rolagem */}
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
              {/* Barra de Status */}
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "38px",
                  background: "rgba(255, 255, 255, 0.94)",
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

              {/* Barra de Scroll do Celular */}
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
                    width: `${currentScrollPct}%`,
                    background: "linear-gradient(90deg, #10B981, #5B34EA)",
                    transition: "width 0.1s ease-out",
                  }}
                />
              </div>

              {/* CONTEÚDO DA PÁGINA DE VENDAS */}
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
                    <div>✖ O Meta Ads não recebe as vendas dos checkouts e desotimiza suas campanhas.</div>
                    <div>✖ Você não sabe qual criativo realmente gerou o lucro no final do dia.</div>
                    <div>✖ Leads saem da página sem você saber onde eles pararam de ler.</div>
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
                  <div style={{ background: "#FFF", padding: "8px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "0.7rem" }}>
                    <strong>&quot;Faturei R$ 42.000 no primeiro mês&quot;</strong>
                    <p style={{ margin: "2px 0 0", color: "#64748B", fontSize: "0.65rem" }}>
                      &quot;O rastreamento me mostrou que o lead lia até o preço e não comprava. Ajustei a oferta e explodiu!&quot; — Lucas M.
                    </p>
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
                  </div>

                  <button
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
                    }}
                  >
                    <ShoppingBag size={15} /> QUERO GARANTIR MINHA VAGA
                  </button>
                </div>

                {/* DOBRA 5 (90% a 100%) - Garantia */}
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
                  <p style={{ fontSize: "0.68rem", color: "#64748B", margin: 0 }}>
                    Risco zero garantido por contrato.
                  </p>
                </div>

                {/* Marcador Visual do Ponto de Parada do Lead */}
                <div
                  style={{
                    padding: "6px",
                    borderRadius: "8px",
                    background: `${selectedLead.statusColor}22`,
                    border: `1px dashed ${selectedLead.statusColor}`,
                    textAlign: "center",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: selectedLead.statusColor,
                  }}
                >
                  📍 Ponto de parada do Lead #{selectedLead.leadNumber} ({selectedLead.maxScroll}%)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Telemetria e Diagnóstico Específico da Sessão do Lead */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Painel 1: Perfil e Telemetria do Lead */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Activity size={18} color="#5B34EA" />
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--ink)" }}>
                    Sessão: Lead #{selectedLead.leadNumber} ({selectedLead.name})
                  </h3>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {selectedLead.location} · {selectedLead.source} · {selectedLead.campaign}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={15} color="var(--muted)" />
                <span style={{ fontSize: "0.82rem", color: "var(--ink)", fontWeight: 600 }}>
                  Tempo na tela: <strong>{formatSecs(selectedLead.timeSpentSeconds)}</strong>
                </span>
              </div>
            </div>

            {/* Medidor de Rolagem Alcançado */}
            <div style={{ marginTop: "1rem", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>Profundidade Máxima Alcançada pelo Lead</span>
                <strong style={{ color: selectedLead.statusColor, fontSize: "1.15rem" }}>
                  {selectedLead.maxScroll}% da página
                </strong>
              </div>
              <div style={{ width: "100%", height: "10px", background: "var(--line)", borderRadius: "6px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${selectedLead.maxScroll}%`,
                    background: selectedLead.statusColor,
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
            </div>

            {/* Diagnóstico do Comportamento deste Lead */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: "var(--surface-subtle)",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                fontSize: "0.82rem",
              }}
            >
              <Eye size={16} color="#5B34EA" />
              <span style={{ color: "var(--muted)" }}>Diagnóstico da sessão:</span>
              <strong style={{ color: "var(--ink)" }}>
                {selectedLead.status === "purchased"
                  ? "Lead converteu com sucesso e realizou o pagamento total!"
                  : selectedLead.status === "checkout_clicked"
                  ? "Lead clicou no botão de compra mas abandonou na página do checkout."
                  : selectedLead.status === "cta_viewed"
                  ? "Visualizou o botão de compra e a tabela de preços, mas não clicou (Objeção de preço)."
                  : selectedLead.status === "offer_viewed"
                  ? "Chegou até a metade da VSL e abandonou antes de ver o preço."
                  : "Saiu nos primeiros segundos da página (rejeição de headline/promessa)."}
              </strong>
            </div>
          </div>

          {/* Painel 2: Marcos Acionados pelo Lead */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>
              Marcos Atingidos por este Lead
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {[
                { label: "0% · PageView", active: true, desc: "Entrou na página" },
                { label: "25% · Dobra 1", active: selectedLead.maxScroll >= 25, desc: "Passou da introdução" },
                { label: "50% · Meio/VSL", active: selectedLead.maxScroll >= 50, desc: "Engajado no conteúdo" },
                { label: "75% · Oferta", active: selectedLead.maxScroll >= 75, desc: "Viu a ancoragem" },
                { label: "90% · CTA Visível", active: selectedLead.maxScroll >= 85, desc: "Botão no ecrã" },
                { label: "Checkout/Compra", active: selectedLead.status === "purchased" || selectedLead.status === "checkout_clicked", desc: "Ação de conversão" },
              ].map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    background: m.active ? "rgba(16, 185, 129, 0.08)" : "var(--surface-subtle)",
                    border: `1px solid ${m.active ? "#10B981" : "var(--line)"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: m.active ? "#10B981" : "var(--muted)" }}>
                      {m.label}
                    </span>
                    {m.active && <CheckCircle2 size={14} color="#10B981" />}
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: "0.72rem", display: "block", marginTop: "2px" }}>
                    {m.desc}
                  </small>
                </div>
              ))}
            </div>
          </div>

          {/* Painel 3: Trilha de Eventos desta Sessão Específica */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>
              Linha do Tempo da Sessão (Feed do Lead #{selectedLead.leadNumber})
            </h3>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              {selectedLead.events.map((ev, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: "var(--surface)",
                    borderLeft: `3px solid ${ev.color}`,
                    fontSize: "0.8rem",
                    border: "1px solid var(--line)",
                  }}
                >
                  <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>
                    [{ev.time}]
                  </span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: `${ev.color}15`,
                          color: ev.color,
                        }}
                      >
                        {ev.type}
                      </span>
                      <strong style={{ color: "var(--ink)" }}>{ev.label}</strong>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>
                      {ev.detail}
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
