"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Copy,
  Check,
  Code2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import type { SaleRow, TrackingEvent, Offer } from "@/lib/types";
import { isApprovedSaleStatus } from "@/lib/sale-status";
import { countryName } from "@/lib/country";

export interface LeadSession {
  id: string;
  leadNumber: number;
  name: string;
  location: string;
  device: string;
  source: string;
  campaign: string;
  placement?: string;
  relativeTime: string;
  maxScroll: number | null; // null quando a profundidade não foi capturada
  timeSpentSeconds: number | null;
  status: "purchased" | "checkout_clicked" | "cta_viewed" | "offer_viewed" | "bounced";
  statusLabel: string;
  statusColor: string;
  amount?: number;
  currency?: string | null;
  events: {
    time: string;
    type: string;
    label: string;
    detail: string;
    color: string;
  }[];
}

function countryLabel(country: string | null | undefined): string {
  return countryName(country);
}

function moneyLabel(amount: number, currency: string | null | undefined): string {
  const normalized = (currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return `Valor sem moeda (${amount.toFixed(2)})`;
  const locale = normalized === "BRL" ? "pt-BR" : normalized === "ARS" ? "es-AR" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency: normalized }).format(amount);
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
    placement: "Instagram Stories",
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
    placement: "Facebook Feed (Mobile)",
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
        label: "Viu a Tabela de Preço (75%)",
        detail: "Parou na oferta de 12x de R$ 29,70",
        color: "#F59E0B",
      },
      {
        time: "02:34",
        type: "ViewCTA",
        label: "Botão de Compra no ecrã (88%)",
        detail: "Analisou os bônus VIP mas não clicou no botão",
        color: "#8B5CF6",
      },
    ],
  },
  {
    id: "lead_8489",
    leadNumber: 8489,
    name: "Gabriel R.",
    location: "Belo Horizonte, MG",
    device: "iPhone 14 · iOS 17",
    source: "TikTok Ads",
    campaign: "spark_ads_autoridade",
    placement: "TikTok In-Feed",
    relativeTime: "Há 14 min",
    maxScroll: 92,
    timeSpentSeconds: 190,
    status: "checkout_clicked",
    statusLabel: "Abandono de Checkout (92%)",
    statusColor: "#EF4444",
    events: [
      {
        time: "00:00",
        type: "PageView",
        label: "Lead acessou a página de vendas",
        detail: "Origem: TikTok Ads via Spark Ads",
        color: "#3B82F6",
      },
      {
        time: "00:20",
        type: "ScrollDepth_25",
        label: "Passou da dobra 1 (25%)",
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

export function LeadScrollVisualizer({
  sales = [],
  events = [],
  offers = [],
  appUrl = "https://trackbase.com.br",
  workspaceId: _workspaceId,
}: {
  sales?: SaleRow[];
  events?: TrackingEvent[];
  offers?: Offer[];
  appUrl?: string;
  workspaceId?: string;
}) {
  const router = useRouter();
  const phoneScrollRef = useRef<HTMLDivElement>(null);

  // Estados de Configuração e Oferta
  const [selectedOfferId, setSelectedOfferId] = useState<string>("all");
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [showInstallHelp, setShowInstallHelp] = useState<boolean>(false);
  const [dataSourceMode, setDataSourceMode] = useState<"real" | "demo">("real");

  // Estados de Visualização de Leads
  const [demoLeads, setDemoLeads] = useState<LeadSession[]>(initialMockLeads);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "purchased" | "hot" | "cta" | "cold">("all");
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [currentScrollPct, setCurrentScrollPct] = useState<number>(0);

  // Oferta ativa selecionada para gerar o script
  const activeOffer = useMemo(() => {
    if (selectedOfferId !== "all") {
      return offers.find((o) => o.id === selectedOfferId) || null;
    }
    // When the selector is on "all", use the main offer's key instead of
    // whichever offer happens to be first. A complementary offer can share
    // the same landing page but point to a different checkout/product.
    return offers.find((o) => o.product_type === "main" && o.public_key)
      || offers.find((o) => o.public_key)
      || offers[0]
      || null;
  }, [offers, selectedOfferId]);

  const trackerKey = activeOffer?.public_key || (offers.length > 0 && offers[0].public_key) || "SUA_CHAVE_DE_OFERTA";
  const scriptSnippet = `<script src="${appUrl}/tracker.js" data-key="${trackerKey}" defer></script>`;

  const filteredEventsForView = useMemo(
    () =>
      selectedOfferId && selectedOfferId !== "all"
        ? (events || []).filter(
            (event) =>
              event.offer_id === selectedOfferId ||
              event.attribution?.offer_id === selectedOfferId,
          )
        : events || [],
    [events, selectedOfferId],
  );
  const realPageviewCount = filteredEventsForView.filter(
    (event) => event.event_type === "pageview",
  ).length;
  const realSessionCount = new Set(
    filteredEventsForView.map((event) => event.session_id || `ev_${event.id}`),
  ).size;

  const handleCopyScript = () => {
    try {
      navigator.clipboard.writeText(scriptSnippet);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2200);
    } catch {
      // ignore
    }
  };

  // Parser de Sessões Reais a partir de 'events' e 'sales'
  const realSessions = useMemo<LeadSession[]>(() => {
    if (filteredEventsForView.length === 0 && (!sales || sales.length === 0)) {
      return [];
    }

    const sessionMap = new Map<string, TrackingEvent[]>();
    for (const ev of filteredEventsForView) {
      const sid = ev.session_id || `ev_${ev.id}`;
      if (!sessionMap.has(sid)) {
        sessionMap.set(sid, []);
      }
      sessionMap.get(sid)!.push(ev);
    }

    const result: LeadSession[] = [];
    const approvedSales = (sales || []).filter(
      (sale) =>
        !sale.is_test &&
        isApprovedSaleStatus(sale.status) &&
        (selectedOfferId === "all" || sale.offer_id === selectedOfferId),
    );
    let leadSeq = 1000;

    sessionMap.forEach((sessionEvents, sid) => {
      // Ordena eventos cronologicamente
      sessionEvents.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const firstEv = sessionEvents[0];
      const lastEv = sessionEvents[sessionEvents.length - 1];
      const attr = firstEv.attribution || lastEv.attribution || {};

      const startMs = new Date(firstEv.created_at).getTime();
      const endMs = new Date(lastEv.created_at).getTime();
      const timeSpent = Math.max(0, Math.min(3600, Math.round((endMs - startMs) / 1000)));

      let maxScroll = 0;
      let hasViewCTA = false;
      let hasCheckout = false;

      sessionEvents.forEach((e) => {
        const type = (e.event_type || "").toLowerCase();
        const action = (e.attribution?.action || "").toLowerCase();
        const depth = parseInt(e.attribution?.scroll_depth || "0", 10);

        if (depth > 0) maxScroll = Math.max(maxScroll, depth);
        if (type.includes("scroll_90") || action.includes("90")) maxScroll = Math.max(maxScroll, 90);
        else if (type.includes("scroll_75") || action.includes("75")) maxScroll = Math.max(maxScroll, 75);
        else if (type.includes("scroll_50") || action.includes("50")) maxScroll = Math.max(maxScroll, 50);
        else if (type.includes("scroll_25") || action.includes("25")) maxScroll = Math.max(maxScroll, 25);

        if (type === "cta_view" || action === "cta_view" || e.attribution?.cta_view) {
          hasViewCTA = true;
          maxScroll = Math.max(maxScroll, 85);
        }
        if (type === "checkout" || action === "checkout") {
          hasCheckout = true;
          maxScroll = Math.max(maxScroll, 90);
        }
      });

      // Cruza com vendas reais pelo session_id ou fbp
      const matchingSale = approvedSales.find((s) => {
        if (s.attribution?.session_id && s.attribution.session_id === sid) return true;
        if (s.attribution?.fbp && attr?.fbp && s.attribution.fbp === attr.fbp) return true;
        return false;
      });

      const isPurchased = !!matchingSale;

      let status: LeadSession["status"] = "bounced";
      let statusLabel = `Saiu em ${maxScroll}%`;
      let statusColor = "#94A3B8";

      if (isPurchased) {
        status = "purchased";
        const amt = matchingSale?.gross_amount || matchingSale?.amount || 0;
        statusLabel = `Comprou ${moneyLabel(amt, matchingSale?.currency)}`;
        statusColor = "#10B981";
      } else if (hasCheckout) {
        status = "checkout_clicked";
        statusLabel = "Clicou no Checkout";
        statusColor = "#EF4444";
      } else if (hasViewCTA || maxScroll >= 85) {
        status = "cta_viewed";
        statusLabel = `Viu Oferta & Preço (${maxScroll}%)`;
        statusColor = "#8B5CF6";
      } else if (maxScroll >= 50) {
        status = "offer_viewed";
        statusLabel = `Engajado (${maxScroll}%)`;
        statusColor = "#3B82F6";
      } else {
        status = "bounced";
        statusLabel = `Rejeição Rápida (${maxScroll}%)`;
        statusColor = "#94A3B8";
      }

      const src = attr.utm_source || "Direto / Orgânico";
      const camp = attr.utm_campaign || "Sem campanha";
      const buyerName = matchingSale?.attribution?.buyer_name || matchingSale?.attribution?.name || "Visitante Real";

      const diffSec = Math.max(0, Math.round((Date.now() - new Date(firstEv.created_at).getTime()) / 1000));
      let relTime = "Há instantes";
      if (diffSec < 60) relTime = "Há poucos seg";
      else if (diffSec < 3600) relTime = `Há ${Math.floor(diffSec / 60)} min`;
      else if (diffSec < 86400) relTime = `Há ${Math.floor(diffSec / 3600)}h`;
      else relTime = `Há ${Math.floor(diffSec / 86400)}d`;

      // Linha do tempo dos eventos
      const sessionStartTime = new Date(firstEv.created_at).getTime();
      const timelineEvents = sessionEvents.map((ev) => {
        const evOffsetSec = Math.max(0, Math.round((new Date(ev.created_at).getTime() - sessionStartTime) / 1000));
        const m = Math.floor(evOffsetSec / 60);
        const s = evOffsetSec % 60;
        const timeStr = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

        const t = (ev.event_type || "").toLowerCase();
        const a = (ev.attribution?.action || "").toLowerCase();
        const d = ev.attribution?.scroll_depth;

        let type = "PageView";
        let label = "Lead acessou a página";
        let detail = `URL: ${ev.url || "Página de Vendas"} · Origem: ${src}`;
        let color = "#3B82F6";

        if (t === "checkout" || a === "checkout") {
          type = "InitiateCheckout";
          label = "Lead clicou no Botão de Compra!";
          detail = "Redirecionando para o checkout com parâmetros UTM e SCK";
          color = "#EF4444";
        } else if (t === "cta_view" || a === "cta_view") {
          type = "ViewCTA";
          label = "Botão de Compra visível no ecrã";
          detail = "Oferta e ancoragem apresentadas para o visitante";
          color = "#8B5CF6";
        } else if (d === "90" || t.includes("90") || a.includes("90")) {
          type = "ScrollDepth_90";
          label = "Rolagem profunda (90%)";
          detail = "Visitante analisando garantia e detalhes finais";
          color = "#8B5CF6";
        } else if (d === "75" || t.includes("75") || a.includes("75")) {
          type = "ScrollDepth_75";
          label = "Chegou na Seção de Oferta (75%)";
          detail = "Visualizou a ancoragem de preço e bônus";
          color = "#F59E0B";
        } else if (d === "50" || t.includes("50") || a.includes("50")) {
          type = "ScrollDepth_50";
          label = "Consumiu metade da página (50%)";
          detail = "Alto engajamento com a VSL e mecanismo único";
          color = "#10B981";
        } else if (d === "25" || t.includes("25") || a.includes("25")) {
          type = "ScrollDepth_25";
          label = "Passou da primeira dobra (25%)";
          detail = "Iniciou consumo da página";
          color = "#10B981";
        } else if (t === "cta") {
          type = "CTA";
          label = "Lead interagiu com um CTA";
          detail = "Interação com chamada para ação registrada";
          color = "#8B5CF6";
        }

        return {
          time: timeStr,
          type,
          label,
          detail,
          color,
        };
      });

      if (isPurchased) {
        timelineEvents.push({
          time: "Final",
          type: "Purchase",
          label: `Compra aprovada na ${(matchingSale?.provider || "Plataforma").toUpperCase()}!`,
          detail: `Valor de ${moneyLabel(matchingSale?.gross_amount || matchingSale?.amount || 0, matchingSale?.currency)}`,
          color: "#10B981",
        });
      }

      const rawPlacement = (attr.utm_placement || attr.placement || matchingSale?.attribution?.utm_placement || matchingSale?.attribution?.placement || "").trim();
      let formattedPlacement: string | undefined = undefined;
      if (rawPlacement) {
        if (/instagram_stories|ig_stories/i.test(rawPlacement)) formattedPlacement = "Instagram Stories";
        else if (/instagram_feed|ig_feed/i.test(rawPlacement)) formattedPlacement = "Instagram Feed";
        else if (/instagram_reels|ig_reels/i.test(rawPlacement)) formattedPlacement = "Instagram Reels";
        else if (/facebook_mobile_feed|fb_mobile_feed/i.test(rawPlacement)) formattedPlacement = "Facebook Feed (Mobile)";
        else if (/facebook_stories|fb_stories/i.test(rawPlacement)) formattedPlacement = "Facebook Stories";
        else if (/facebook_reels|fb_reels/i.test(rawPlacement)) formattedPlacement = "Facebook Reels";
        else formattedPlacement = rawPlacement;
      }

      result.push({
        id: `session_${sid}`,
        leadNumber: ++leadSeq,
        name: buyerName,
        location: countryLabel(matchingSale?.country) !== "País não informado"
          ? countryLabel(matchingSale?.country)
          : attr.location || "País não informado",
        device: attr.device || "Mobile",
        source: src,
        campaign: camp,
        placement: formattedPlacement,
        relativeTime: relTime,
        maxScroll,
        timeSpentSeconds: timeSpent,
        status,
        statusLabel,
        statusColor,
        amount: matchingSale?.gross_amount || matchingSale?.amount,
        currency: matchingSale?.currency,
        events: timelineEvents,
      });
    });

    // Uma venda sem telemetria de sessão não pode virar uma jornada inventada.
    // Exibimos somente a compra aprovada e deixamos profundidade/tempo como não capturados.
    approvedSales.forEach((s, idx) => {
      const saleId = `sale_${s.id}`;
      if (result.some((r) => r.id === `session_${s.attribution?.session_id}` || r.id === saleId)) return;
      const buyerName = s.attribution?.buyer_name || s.attribution?.name || `Comprador #${idx + 1}`;
      const src = s.attribution?.utm_source || s.provider || "Tráfego Pago";
      const camp = s.attribution?.utm_campaign || "Campanha Principal";
      const amt = s.gross_amount ?? s.amount ?? 0;

      const rawSalePlacement = (s.attribution?.utm_placement || s.attribution?.placement || "").trim();
      let formattedSalePlacement: string | undefined = undefined;
      if (rawSalePlacement) {
        if (/instagram_stories|ig_stories/i.test(rawSalePlacement)) formattedSalePlacement = "Instagram Stories";
        else if (/instagram_feed|ig_feed/i.test(rawSalePlacement)) formattedSalePlacement = "Instagram Feed";
        else if (/instagram_reels|ig_reels/i.test(rawSalePlacement)) formattedSalePlacement = "Instagram Reels";
        else if (/facebook_mobile_feed|fb_mobile_feed/i.test(rawSalePlacement)) formattedSalePlacement = "Facebook Feed (Mobile)";
        else if (/facebook_stories|fb_stories/i.test(rawSalePlacement)) formattedSalePlacement = "Facebook Stories";
        else if (/facebook_reels|fb_reels/i.test(rawSalePlacement)) formattedSalePlacement = "Facebook Reels";
        else formattedSalePlacement = rawSalePlacement;
      }

      result.unshift({
        id: saleId,
        leadNumber: 9000 + idx,
        name: buyerName,
        location: countryLabel(s.country),
        device: "Dispositivo do Comprador",
        source: src,
        campaign: camp,
        placement: formattedSalePlacement,
        relativeTime: "Venda Real",
        maxScroll: null,
        timeSpentSeconds: null,
        status: "purchased",
        statusLabel: `Comprou ${moneyLabel(amt, s.currency)}`,
        statusColor: "#10B981",
        amount: amt,
        currency: s.currency,
        events: [
          {
            time: "—",
            type: "Purchase",
            label: `Compra aprovada na ${s.provider.toUpperCase()}!`,
            detail: `Valor de ${moneyLabel(amt, s.currency)} · Profundidade e tempo de sessão não capturados`,
            color: "#10B981",
          },
        ],
      });
    });

    return result;
  }, [filteredEventsForView, sales, selectedOfferId]);

  // Define se usa dados reais ou demonstração. Dados de demonstração só
  // aparecem quando o usuário escolhe explicitamente esse modo.
  const hasRealData = realSessions.length > 0;
  const activeLeads = dataSourceMode === "real" ? realSessions : demoLeads;

  // Atualiza o Radar sem exigir reload manual. O refresh preserva o estado
  // visual e faz o Server Component buscar eventos recém-gravados.
  useEffect(() => {
    if (dataSourceMode !== "real") return;
    const refreshId = window.setInterval(() => router.refresh(), 10000);
    return () => window.clearInterval(refreshId);
  }, [dataSourceMode, router]);

  // Garante seleção válida de lead
  useEffect(() => {
    if (!selectedLeadId || !activeLeads.some((l) => l.id === selectedLeadId)) {
      if (activeLeads.length > 0) {
        setSelectedLeadId(activeLeads[0].id);
      }
    }
  }, [activeLeads, selectedLeadId]);

  const selectedLead = activeLeads.find((l) => l.id === selectedLeadId) || activeLeads[0] || null;
  const selectedLeadHasPageView = Boolean(
    selectedLead?.events.some((event) => event.type.toLowerCase() === "pageview"),
  );

  // Atualiza a posição do celular ao trocar de lead selecionado
  useEffect(() => {
    if (!selectedLead) return;
    setIsReplaying(false);
    const el = phoneScrollRef.current;
    if (!el) return;

    const maxScrollHeight = el.scrollHeight - el.clientHeight;
    const selectedScroll = selectedLead.maxScroll ?? 0;
    const targetScrollTop = (selectedScroll / 100) * maxScrollHeight;
    el.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    setCurrentScrollPct(selectedScroll);
  }, [selectedLeadId, selectedLead]);

  // Modo Replay da Sessão (animação passo a passo do lead descendo a página)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isReplaying && selectedLead) {
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
        const selectedScroll = selectedLead.maxScroll ?? 0;
        const targetScrollTop = (selectedScroll / 100) * maxScrollHeight;

        step += 35;
        if (step >= targetScrollTop) {
          container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
          setCurrentScrollPct(selectedScroll);
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

  const handlePhoneScroll = () => {
    const el = phoneScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    const pct = Math.min(100, Math.max(0, Math.round((el.scrollTop / maxScroll) * 100)));
    setCurrentScrollPct(pct);
  };

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

    setDemoLeads((prev) => [newLead, ...prev]);
    setSelectedLeadId(newLead.id);
    setDataSourceMode("demo");
  };

  const filteredLeads = activeLeads.filter((l) => {
    if (filterType === "purchased") return l.status === "purchased";
    if (filterType === "hot") return (l.maxScroll ?? 0) >= 75;
    if (filterType === "cta") return l.status === "cta_viewed" || l.status === "checkout_clicked";
    if (filterType === "cold") return l.maxScroll !== null && l.maxScroll < 50;
    return true;
  });

  const formatSecs = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec.toString().padStart(2, "0")}s`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* 1. CARD PRINCIPAL: SCRIPT DE RASTREAMENTO DO RADAR DE LEADS */}
      <div
        className="panel"
        style={{
          background: "linear-gradient(135deg, rgba(91, 52, 234, 0.07) 0%, rgba(16, 185, 129, 0.05) 100%)",
          border: "1px solid rgba(91, 52, 234, 0.25)",
          padding: "1.25rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.35rem" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 10px",
                  borderRadius: "14px",
                  background: hasRealData ? "rgba(16, 185, 129, 0.15)" : "rgba(91, 52, 234, 0.15)",
                  color: hasRealData ? "#10B981" : "#5B34EA",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  letterSpacing: "0.03em",
                }}
              >
                <Radio size={12} className={hasRealData ? "spin" : ""} />
                {hasRealData ? "RADAR ATIVO · DADOS EM TEMPO REAL" : "RADAR AO VIVO · AGUARDANDO EVENTOS"}
              </span>

              {/* Toggle Real vs Demonstração */}
              <div style={{ display: "inline-flex", background: "var(--surface)", borderRadius: "8px", border: "1px solid var(--line)", padding: "2px" }}>
                <button
                  type="button"
                  onClick={() => setDataSourceMode("real")}
                  style={{
                    padding: "3px 9px",
                    borderRadius: "6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    border: "none",
                    background: dataSourceMode === "real" ? "#10B981" : "transparent",
                    color: dataSourceMode === "real" ? "#FFF" : "var(--muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s",
                  }}
                  title={hasRealData ? "Exibir sessões reais capturadas" : "Nenhum evento registrado ainda"}
                >
                  ● Ao Vivo {hasRealData ? `(${realSessions.length})` : "(0)"}
                </button>
                <button
                  type="button"
                  onClick={() => setDataSourceMode("demo")}
                  style={{
                    padding: "3px 9px",
                    borderRadius: "6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    border: "none",
                    background: dataSourceMode === "demo" ? "#5B34EA" : "transparent",
                    color: dataSourceMode === "demo" ? "#FFF" : "var(--muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s",
                  }}
                >
                  Modo Demonstração
                </button>
              </div>
            </div>

            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--ink)" }}>
              Script de Rastreamento do Radar de Leads
            </h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.84rem", maxWidth: "700px" }}>
              Cole o script abaixo na sua página de vendas / VSL. Ele rastreia cada visitante individualmente, captura profundidade de rolagem (25%, 50%, 75%, 90%), tempo na página, cliques de checkout e deduplica conversões na Meta Ads.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="button secondary small"
              onClick={() => setShowInstallHelp(!showInstallHelp)}
              style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.78rem" }}
            >
              <HelpCircle size={14} /> Como instalar? {showInstallHelp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {dataSourceMode === "demo" && (
              <button
                type="button"
                className="button ghost small"
                onClick={handleAddLiveLead}
                style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.78rem" }}
                title="Adiciona um lead apenas para demonstração"
              >
                <Plus size={14} /> Adicionar Lead Demo
              </button>
            )}
          </div>
        </div>

        {/* Linha do Seletor de Ofertas e Caixa do Script com Botão Copiar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: offers.length > 1 ? "240px 1fr" : "1fr",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          {offers.length > 1 && (
            <div>
              <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                🏷️ Selecionar Oferta / Funil:
              </label>
              <select
                value={selectedOfferId}
                onChange={(e) => setSelectedOfferId(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--ink)",
                  cursor: "pointer",
                }}
              >
                <option value="all">Todas as Ofertas ({offers.length})</option>
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} {o.public_key ? `(${o.public_key.slice(0, 6)}...)` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Codebox do Script */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              padding: "6px 12px",
              gap: "8px",
              overflow: "hidden",
            }}
          >
            <Code2 size={16} color="#5B34EA" style={{ flexShrink: 0 }} />
            <div
              style={{
                flex: 1,
                fontFamily: "monospace",
                fontSize: "0.8rem",
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                userSelect: "all",
              }}
              title={scriptSnippet}
            >
              {scriptSnippet}
            </div>

            <button
              type="button"
              className={copiedScript ? "button small success" : "button small primary"}
              onClick={handleCopyScript}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                flexShrink: 0,
                fontSize: "0.78rem",
                fontWeight: 700,
                padding: "6px 14px",
              }}
            >
              {copiedScript ? (
                <>
                  <Check size={14} /> Copiado!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copiar Script
                </>
              )}
            </button>
          </div>
        </div>

        {/* Guia Rápido de Instalação (Expandível) */}
        {showInstallHelp && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "1rem",
              fontSize: "0.8rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1rem",
            }}
          >
            <div>
              <strong style={{ color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                WordPress / Elementor:
              </strong>
              <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.4 }}>
                Arraste um widget <strong>HTML</strong> para o rodapé da página ou use o plugin <em>WPCode / Insert Headers and Footers</em> e cole no Footer.
              </p>
            </div>
            <div>
              <strong style={{ color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Kiwify / Hotmart / Cakto (Páginas Próprias):
              </strong>
              <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.4 }}>
                Cole antes do fechamento da tag <code>&lt;/body&gt;</code> ou na tag <code>&lt;head&gt;</code> do HTML da sua página de vendas.
              </p>
            </div>
            <div>
              <strong style={{ color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                Webflow, Framer, Wix ou HTML:
              </strong>
              <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.4 }}>
                Abra as configurações da página &gt; Custom Code e cole em <strong>Footer Code</strong> (antes de &lt;/body&gt;).
              </p>
            </div>
          </div>
        )}

        {/* Benefícios Rápidos */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.74rem", color: "var(--muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <CheckCircle2 size={13} color="#10B981" /> 0 impacto no carregamento (&lt; 4KB)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <CheckCircle2 size={13} color="#10B981" /> Deduplicação nativa na Meta CAPI (Event ID)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <CheckCircle2 size={13} color="#10B981" /> Injeção automática de UTMs e SCK no Checkout
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <CheckCircle2 size={13} color="#10B981" /> Rastreia Rolagem 25%, 50%, 75%, 90% e Checkout
          </span>
        </div>
      </div>

      {/* 2. SELETOR DE LEADS DO FUNIL (Sessões Individuais) */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Compass size={18} color="#5B34EA" />
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>
              {dataSourceMode === "real"
                ? `Visitantes Reais no Funil (${activeLeads.length})`
                : `Leads e Sessões de Exemplo (${activeLeads.length})`}
            </h3>
            {dataSourceMode === "real" && (
              <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                {realPageviewCount} PageViews · {realSessionCount} sessões únicas
              </span>
            )}
            {dataSourceMode === "demo" && (
              <span
                style={{
                  fontSize: "0.68rem",
                  padding: "2px 7px",
                  borderRadius: "10px",
                  background: "rgba(91, 52, 234, 0.1)",
                  color: "#5B34EA",
                  fontWeight: 700,
                }}
              >
                Demonstração
              </span>
            )}
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

        {/* Estado vazio quando não houver leads no filtro */}
        {filteredLeads.length === 0 ? (
          <div
            style={{
              padding: "2rem 1rem",
              textAlign: "center",
              background: "var(--surface-subtle)",
              borderRadius: "10px",
              border: "1px dashed var(--line)",
            }}
          >
            <Info size={24} color="var(--muted)" style={{ margin: "0 auto 8px" }} />
            <p style={{ margin: "0 0 8px", fontSize: "0.85rem", color: "var(--ink)", fontWeight: 600 }}>
              {dataSourceMode === "real" && !hasRealData
                ? "Aguardando primeiros visitantes com o tracker.js instalado..."
                : "Nenhum lead encontrado com o filtro selecionado."}
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
              {dataSourceMode === "real" && !hasRealData && (
                <button
                  type="button"
                  className="button primary small"
                  onClick={() => setDataSourceMode("demo")}
                >
                  Ver Modo Demonstração
                </button>
              )}
              <button
                type="button"
                className="button ghost small"
                onClick={() => setFilterType("all")}
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        ) : (
          /* Cards de Sessões Individuais (Grid com Scroll Horizontal Suave) */
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
              const isSelected = selectedLead && lead.id === selectedLead.id;
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

                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.72rem", color: "var(--muted)", flexWrap: "wrap" }}>
                    <MapPin size={11} />
                    <span>{lead.location}</span>
                    <span>·</span>
                    <span>{lead.source}</span>
                    {lead.placement && (
                      <>
                        <span>·</span>
                        <span style={{ color: "#5B34EA", fontWeight: 700 }}>📱 {lead.placement}</span>
                      </>
                    )}
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
                      {lead.maxScroll === null ? "Profundidade não capturada" : `${lead.maxScroll}% rolado`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid Principal Lado a Lado: Celular do Lead vs Telemetria da Sessão */}
      {selectedLead ? (
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
                  📍 Ponto de parada do Lead #{selectedLead.leadNumber} ({selectedLead.maxScroll === null ? "não capturado" : `${selectedLead.maxScroll}%`})
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
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      {selectedLead.location} · {selectedLead.source} · {selectedLead.campaign}
                    </span>
                    {selectedLead.placement && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "1px 8px",
                          borderRadius: "6px",
                          background: "rgba(91, 52, 234, 0.12)",
                          color: "#5B34EA",
                        }}
                      >
                        📱 {selectedLead.placement}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={15} color="var(--muted)" />
                  <span style={{ fontSize: "0.82rem", color: "var(--ink)", fontWeight: 600 }}>
                    Tempo na tela: <strong>{selectedLead.timeSpentSeconds === null ? "Não capturado" : formatSecs(selectedLead.timeSpentSeconds)}</strong>
                  </span>
                </div>
              </div>

              {/* Medidor de Rolagem Alcançado */}
              <div style={{ marginTop: "1rem", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>Profundidade Máxima Alcançada pelo Lead</span>
                  <strong style={{ color: selectedLead.statusColor, fontSize: "1.15rem" }}>
                    {selectedLead.maxScroll === null ? "Não capturada" : `${selectedLead.maxScroll}% da página`}
                  </strong>
                </div>
                <div style={{ width: "100%", height: "10px", background: "var(--line)", borderRadius: "6px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${selectedLead.maxScroll ?? 0}%`,
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
                  { label: "0% · PageView", active: selectedLeadHasPageView, desc: "Entrou na página" },
                  { label: "25% · Dobra 1", active: (selectedLead.maxScroll ?? 0) >= 25, desc: "Passou da introdução" },
                  { label: "50% · Meio/VSL", active: (selectedLead.maxScroll ?? 0) >= 50, desc: "Engajado no conteúdo" },
                  { label: "75% · Oferta", active: (selectedLead.maxScroll ?? 0) >= 75, desc: "Viu a ancoragem" },
                  { label: "90% · CTA Visível", active: (selectedLead.maxScroll ?? 0) >= 85, desc: "Botão no ecrã" },
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
      ) : null}
    </div>
  );
}
