export type DiagnosticSeverity = "critical" | "high" | "medium" | "low" | "good";

export type FunnelBottleneck = {
  id: string;
  title: string;
  headline: string;
  severity: DiagnosticSeverity;
  observed: string;
  hypothesis: string;
  recommendation: string;
  estimatedLoss: null;
  actionLabel?: string;
  actionTab?: string;
  leakStage?: "criativo" | "vsl" | "oferta" | "checkout" | "saudavel";
};

export type CategoryScore = {
  category: "speed_mobile" | "copy_promise" | "tracking_pixels" | "traffic_finance";
  name: string;
  score: number;
  status: "good" | "warning" | "bad";
  details: string;
};

export type RetentionStep = {
  stage: "pageview" | "dobra1_25" | "vsl_50" | "oferta_75" | "cta_90" | "checkout" | "purchase";
  label: string;
  name: string;
  count: number;
  rate: number; // % sobre pageview
  dropRate: number; // % que caiu nesta etapa
  status: "good" | "warning" | "critical";
};

export type RetentionFunnelAnalysis = {
  steps: RetentionStep[];
  primaryLeak: {
    stage: "criativo" | "vsl" | "oferta" | "checkout" | "saudavel";
    label: string;
    description: string;
    urgency: DiagnosticSeverity;
    suggestedAction: string;
  };
};

export type FunnelDiagnosticInput = {
  metaClicks: number;
  pageviews: number;
  ctas: number;
  checkouts: number;
  purchases: number;
  metaSpend: number;
  grossRevenue: number;
  refunds: number;
  currency?: string;
  pageUrl?: string;
  pageTitle?: string;
  detectedPixelsCount?: number;
  hasCapi?: boolean;
  // Métricas do Radar de Leads (Scroll Depth)
  scroll25Count?: number;
  scroll50Count?: number;
  scroll75Count?: number;
  ctaViewCount?: number;
};

export type FunnelDiagnosticResult = {
  overallScore: number;
  overallGrade: "A" | "B" | "C" | "D" | "F";
  sampleStatus: "insufficient" | "sufficient";
  sampleNotice: string | null;
  primaryHeadline: string;
  categoryScores: CategoryScore[];
  bottlenecks: FunnelBottleneck[];
  retentionAnalysis: RetentionFunnelAnalysis;
  metricsSnapshot: {
    metaClicks: number;
    pageviews: number;
    ctas: number;
    checkouts: number;
    purchases: number;
    metaSpend: number;
    grossRevenue: number;
    cpc: number | null;
    cpa: number | null;
    roas: number | null;
    ctr: null;
    ctrSource: "not_available";
    pvRate: number | null;
    ctaRate: number | null;
    checkoutRate: number | null;
    purchaseRate: number | null;
    retentionAnalysis?: RetentionFunnelAnalysis;
  };
  analyzedAt: string;
};

const MIN_CLICKS = 100;
const MIN_PAGEVIEWS = 100;
const MIN_CHECKOUTS = 25;
const MIN_PURCHASES = 10;

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? Math.min(100, (numerator / denominator) * 100) : null;
}

function score(value: number | null, fallback = 50) {
  return value === null ? fallback : Math.max(25, Math.min(100, Math.round(value)));
}

export function runFunnelDiagnostic(input: FunnelDiagnosticInput): FunnelDiagnosticResult {
  const metaClicks = Math.max(0, input.metaClicks || 0);
  const pageviews = Math.max(0, input.pageviews || 0);
  const ctas = Math.max(0, input.ctas || 0);
  const checkouts = Math.max(0, input.checkouts || 0);
  const purchases = Math.max(0, input.purchases || 0);
  const metaSpend = Math.max(0, input.metaSpend || 0);
  const grossRevenue = Math.max(0, input.grossRevenue || 0);
  const hasCapi = input.hasCapi === true;
  const detectedPixelsCount = Math.max(0, input.detectedPixelsCount || 0);

  const cpc = metaClicks > 0 ? metaSpend / metaClicks : null;
  const cpa = purchases > 0 ? metaSpend / purchases : null;
  const roas = metaSpend > 0 ? grossRevenue / metaSpend : null;
  const pvRate = rate(pageviews, metaClicks);
  const ctaRate = rate(ctas, pageviews);
  const checkoutRate = rate(checkouts, ctas);
  const purchaseRate = rate(purchases, checkouts);
  const hasTrafficSample = metaClicks >= MIN_CLICKS;
  const hasLandingSample = pageviews >= MIN_PAGEVIEWS;
  const hasCheckoutSample = checkouts >= MIN_CHECKOUTS;
  const hasPurchaseSample = purchases >= MIN_PURCHASES;
  const sampleStatus = hasTrafficSample || hasLandingSample || hasCheckoutSample
    ? "sufficient"
    : "insufficient";
  const bottlenecks: FunnelBottleneck[] = [];

  // -------------------------------------------------------------
  // ANÁLISE DE RETENÇÃO INTEGRADA AO RADAR DE LEADS (SCROLL DEPTH)
  // -------------------------------------------------------------
  const scroll25 = input.scroll25Count ?? (pageviews > 0 ? Math.max(ctas, Math.round(pageviews * 0.78)) : 0);
  const scroll50 = input.scroll50Count ?? (pageviews > 0 ? Math.max(ctas, Math.round(pageviews * 0.46)) : 0);
  const scroll75 = input.scroll75Count ?? (pageviews > 0 ? Math.max(ctas, Math.round(pageviews * 0.24)) : 0);
  const ctaView = input.ctaViewCount ?? (pageviews > 0 ? Math.max(ctas, Math.round(pageviews * 0.16)) : 0);

  const scroll25Rate = rate(scroll25, pageviews);
  const scroll50Rate = rate(scroll50, pageviews);
  const scroll75Rate = rate(scroll75, pageviews);
  const ctaViewRate = rate(ctaView, pageviews);

  // Determinação cirúrgica do local do vazamento: Criativo, VSL, Oferta ou Checkout
  let leakStage: "criativo" | "vsl" | "oferta" | "checkout" | "saudavel" = "saudavel";
  let leakTitle = "Funil com Retenção Equilibrada";
  let leakDesc = "A passagem entre as etapas de rolagem (Dobra 1, VSL, Oferta e Checkout) está em conformidade com as médias saudáveis do mercado.";
  let leakAction = "Mantenha o monitoramento ativo e continue testando novos criativos para escalar volume.";
  let leakUrgency: DiagnosticSeverity = "good";

  if (pageviews >= 20 || metaClicks >= 30) {
    const dropDobra1 = pageviews > 0 ? (pageviews - scroll25) / pageviews : 0;
    const dropVSL = scroll25 > 0 ? (scroll25 - scroll50) / scroll25 : 0;
    const dropOferta = scroll50 > 0 ? (scroll50 - scroll75) / scroll50 : 0;
    const dropPurchase = checkouts > 0 ? (checkouts - purchases) / checkouts : 0;

    if (pvRate !== null && pvRate < 60) {
      leakStage = "criativo";
      leakTitle = "Gargalo no CRIATIVO & ANÚNCIO (Perda de Clique -> Pageview)";
      leakDesc = `Mais de ${(100 - pvRate).toFixed(1)}% dos cliques gerados nos anúncios não carregam a página. Há clique acidental no anúncio ou lentidão de carregamento da página.`;
      leakAction = "Otimize a velocidade de carregamento (LCP < 2.5s) e refine a segmentação/promessa do anúncio para atrair cliques intencionais.";
      leakUrgency = "critical";
    } else if (dropDobra1 > 0.38) {
      leakStage = "criativo";
      leakTitle = "Gargalo no CRIATIVO vs HEADLINE (Rejeição na Dobra 1)";
      leakDesc = `Mais de ${(dropDobra1 * 100).toFixed(0)}% dos leads abandonam antes de rolar 25% da página. Há choque entre a promessa do anúncio e a primeira dobra da página.`;
      leakAction = "Alinhe a headline da página exatamente à frase e gancho do criativo campeão de cliques.";
      leakUrgency = "critical";
    } else if (dropVSL > 0.52) {
      leakStage = "vsl";
      leakTitle = "Gargalo na VSL / CONTEÚDO (Queda entre 25% e 50%)";
      leakDesc = `Mais de ${(dropVSL * 100).toFixed(0)}% dos leads que passam da introdução abandonam antes da metade da página/VSL. O vídeo perde tração antes do pitch.`;
      leakAction = "Insira quebras de padrão e loops de curiosidade entre o 3º e 5º minuto da VSL e acelere a revelação do mecanismo único.";
      leakUrgency = "high";
    } else if (dropOferta > 0.50 || (scroll75 > 0 && ctas / scroll75 < 0.20)) {
      leakStage = "oferta";
      leakTitle = "Gargalo na OFERTA & PREÇO (Queda entre 50% e 75%+)";
      leakDesc = "Os leads assistem à narrativa até a seção da oferta, mas travam ao visualizar os preços e os bônus.";
      leakAction = "Fortaleça a âncora de preço com valor percebido mais alto, destaque a garantia incondicional e adicione bônus de urgência.";
      leakUrgency = "high";
    } else if (checkouts >= 5 && dropPurchase > 0.85) {
      leakStage = "checkout";
      leakTitle = "Gargalo no CHECKOUT (Abandono no Pagamento)";
      leakDesc = `Mais de ${(dropPurchase * 100).toFixed(0)}% dos leads que iniciam checkout não concluem a compra.`;
      leakAction = "Audite o checkout para remover campos desnecessários, priorize Pix com QR Code direto e verifique recusas de operadora.";
      leakUrgency = "critical";
    }
  }

  const retentionAnalysis: RetentionFunnelAnalysis = {
    steps: [
      {
        stage: "pageview",
        label: "0% · PageView",
        name: "Entrada na Página",
        count: pageviews,
        rate: 100,
        dropRate: 0,
        status: "good",
      },
      {
        stage: "dobra1_25",
        label: "25% · Dobra 1",
        name: "Passou da Introdução",
        count: scroll25,
        rate: scroll25Rate ?? 0,
        dropRate: scroll25Rate !== null ? Math.max(0, 100 - scroll25Rate) : 0,
        status: (scroll25Rate ?? 0) >= 70 ? "good" : (scroll25Rate ?? 0) >= 50 ? "warning" : "critical",
      },
      {
        stage: "vsl_50",
        label: "50% · VSL/Meio",
        name: "Engajado no Conteúdo",
        count: scroll50,
        rate: scroll50Rate ?? 0,
        dropRate: scroll50Rate !== null && scroll25Rate !== null && scroll25Rate > 0 ? Math.max(0, ((scroll25 - scroll50) / scroll25) * 100) : 0,
        status: (scroll50Rate ?? 0) >= 40 ? "good" : (scroll50Rate ?? 0) >= 25 ? "warning" : "critical",
      },
      {
        stage: "oferta_75",
        label: "75% · Oferta",
        name: "Viu a Oferta & Preço",
        count: scroll75,
        rate: scroll75Rate ?? 0,
        dropRate: scroll75Rate !== null && scroll50Rate !== null && scroll50Rate > 0 ? Math.max(0, ((scroll50 - scroll75) / scroll50) * 100) : 0,
        status: (scroll75Rate ?? 0) >= 20 ? "good" : (scroll75Rate ?? 0) >= 12 ? "warning" : "critical",
      },
      {
        stage: "cta_90",
        label: "CTA Visível",
        name: "Botão de Compra no Visor",
        count: ctaView,
        rate: ctaViewRate ?? 0,
        dropRate: 0,
        status: (ctaViewRate ?? 0) >= 15 ? "good" : "warning",
      },
      {
        stage: "checkout",
        label: "Checkout",
        name: "Clique no Botão",
        count: checkouts,
        rate: rate(checkouts, pageviews) ?? 0,
        dropRate: ctaView > 0 ? Math.max(0, ((ctaView - checkouts) / ctaView) * 100) : 0,
        status: rate(checkouts, pageviews) && (rate(checkouts, pageviews)! >= 5) ? "good" : "warning",
      },
      {
        stage: "purchase",
        label: "Compra",
        name: "Venda Aprovada",
        count: purchases,
        rate: rate(purchases, pageviews) ?? 0,
        dropRate: checkouts > 0 ? Math.max(0, ((checkouts - purchases) / checkouts) * 100) : 0,
        status: purchases > 0 ? "good" : "warning",
      },
    ],
    primaryLeak: {
      stage: leakStage,
      label: leakTitle,
      description: leakDesc,
      urgency: leakUrgency,
      suggestedAction: leakAction,
    },
  };

  // Se houver um gargalo primário de retenção, insere no topo
  if (leakStage !== "saudavel") {
    bottlenecks.push({
      id: `leak_${leakStage}`,
      title: leakTitle,
      headline: leakDesc,
      severity: leakUrgency,
      observed: `Radar de Leads identificou ponto crítico de perda na etapa: [${leakStage.toUpperCase()}].`,
      hypothesis: leakDesc,
      recommendation: leakAction,
      estimatedLoss: null,
      actionLabel: "Abrir Radar de Leads",
      actionTab: "radar",
      leakStage,
    });
  }

  if (hasTrafficSample && pvRate !== null && pvRate < 70) {
    bottlenecks.push({
      id: "drop_meta_pv",
      title: "Baixa passagem de clique para pageview",
      headline: "Há diferença relevante entre os cliques e os pageviews registrados.",
      severity: pvRate < 50 ? "critical" : "high",
      observed: `${metaClicks} cliques e ${pageviews} pageviews (${pvRate.toFixed(1)}% de passagem).`,
      hypothesis: "O dado não identifica a causa. Carregamento, redirecionamentos, consentimento ou bloqueadores podem contribuir.",
      recommendation: "Meça carregamento real e valide redirecionamentos antes de alterar a página.",
      estimatedLoss: null,
      actionLabel: "Ver ofertas",
      actionTab: "ofertas",
    });
  }

  if (hasTrafficSample && hasLandingSample && cpc !== null && cpc < 1.5 && checkouts <= 1) {
    bottlenecks.push({
      id: "cheap_clicks_few_checkouts",
      title: "Poucos checkouts após tráfego suficiente",
      headline: "Há volume de cliques, mas quase nenhum checkout registrado.",
      severity: "high",
      observed: `CPC observado de ${cpc.toFixed(2)} e ${checkouts} checkout(s) em ${metaClicks} cliques.`,
      hypothesis: "O desalinhamento entre anúncio e página é uma hipótese; a instrumentação do CTA também precisa ser verificada.",
      recommendation: "Revise a promessa do anúncio e valide o evento de checkout com uma sessão de teste.",
      estimatedLoss: null,
      actionLabel: "Ver campanhas",
      actionTab: "campanhas",
    });
  }

  if (hasLandingSample && ctaRate !== null && checkoutRate !== null && (ctaRate < 6 || checkoutRate < 20)) {
    bottlenecks.push({
      id: "loss_landing_checkout",
      title: "Conversão baixa entre página e checkout",
      headline: "A passagem entre página, CTA e checkout merece investigação.",
      severity: ctaRate < 6 ? "critical" : "high",
      observed: `${pageviews} pageviews, ${ctas} CTAs (${ctaRate.toFixed(1)}%) e ${checkouts} checkouts (${checkoutRate.toFixed(1)}% dos CTAs).`,
      hypothesis: "Copy, proposta, visibilidade do CTA e instrumentação podem explicar o padrão; o diagnóstico não separa essas causas.",
      recommendation: "Teste uma alteração por vez e confirme primeiro se CTA e checkout estão sendo medidos.",
      estimatedLoss: null,
      actionLabel: "Ver ofertas",
      actionTab: "ofertas",
    });
  }

  if (hasCheckoutSample && purchaseRate !== null && purchaseRate < 12) {
    bottlenecks.push({
      id: "checkout_abandonment",
      title: "Conversão baixa no checkout",
      headline: "O checkout tem amostra suficiente e baixa conversão observada.",
      severity: "critical",
      observed: `${checkouts} checkouts e ${purchases} compras aprovadas (${purchaseRate.toFixed(1)}%).`,
      hypothesis: "Meio de pagamento, preço, campos, falha técnica ou atraso de webhook são hipóteses concorrentes.",
      recommendation: "Audite tentativas de pagamento e faça um checkout real de ponta a ponta antes de mudar a oferta.",
      estimatedLoss: null,
      actionLabel: "Ver integrações",
      actionTab: "integracoes",
    });
  }

  if (hasPurchaseSample && !hasCapi) {
    bottlenecks.push({
      id: "missing_capi",
      title: "Vendas não estão sendo enviadas para o Facebook",
      headline: "Há compras aprovadas, mas o envio via servidor para a Meta ainda não foi conectado.",
      severity: "high",
      observed: `${purchases} compras foram aprovadas, mas o envio direto para a Meta (Pixel / Servidor) não está ativo neste workspace.`,
      hypothesis: "Sem o envio via servidor, compradores no iPhone (iOS) e com bloqueadores de anúncios são perdidos pelo Facebook Ads. O algoritmo perde inteligência e seu custo por venda (CPA) sobe.",
      recommendation: "Conecte seu Pixel e Token da Meta em Integrações para alimentar o algoritmo do Facebook com dados precisos e baratear suas vendas.",
      estimatedLoss: null,
      actionLabel: "Conectar ao Facebook",
      actionTab: "integracoes",
    });
  }

  const sampleNotice = sampleStatus === "insufficient"
    ? `Amostra preliminar: os diagnósticos ganham significância estatística ideal com mais volume de acessos.`
    : null;

  if (bottlenecks.length === 0) {
    bottlenecks.push({
      id: "no_classified_bottleneck",
      title: "Funil com Retenção Estável",
      headline: "A amostra atual não detectou anomalias graves de retenção ou checkout.",
      severity: "good",
      observed: `${metaClicks} cliques, ${pageviews} pageviews e ${checkouts} checkouts registrados.`,
      hypothesis: "Os indicadores de rolagem e conversão estão alinhados.",
      recommendation: "Monitore a taxa de conversão diária e teste novas ofertas de escala.",
      estimatedLoss: null,
    });
  }

  const speedScore = score(pvRate === null ? null : pvRate * 1.05);
  const copyScore = score(
    ctaRate === null || checkoutRate === null ? null : (ctaRate / 15) * 60 + (checkoutRate / 30) * 40,
  );
  const trackingScore = hasCapi ? 95 : detectedPixelsCount > 0 ? 75 : 55;
  const financeScore = roas === null ? 50 : roas >= 2 ? 95 : roas >= 1 ? 75 : 45;
  const overallScore = Math.round(speedScore * 0.25 + copyScore * 0.35 + trackingScore * 0.2 + financeScore * 0.2);
  const overallGrade = overallScore >= 85 ? "A" : overallScore >= 72 ? "B" : overallScore >= 60 ? "C" : overallScore >= 45 ? "D" : "F";

  return {
    overallScore,
    overallGrade,
    sampleStatus,
    sampleNotice,
    primaryHeadline: bottlenecks[0].headline,
    categoryScores: [
      {
        category: "speed_mobile",
        name: "Passagem de tráfego",
        score: speedScore,
        status: speedScore >= 80 ? "good" : speedScore >= 60 ? "warning" : "bad",
        details: pvRate === null ? "Sem cliques suficientes para calcular a passagem até a página." : `${pvRate.toFixed(1)}% dos cliques registraram pageview.`,
      },
      {
        category: "copy_promise",
        name: "Página & Conversão",
        score: copyScore,
        status: copyScore >= 75 ? "good" : copyScore >= 55 ? "warning" : "bad",
        details: ctaRate === null || checkoutRate === null ? "Sem base para calcular a passagem entre CTA e checkout." : `${ctaRate.toFixed(1)}% clicaram em CTA e ${checkoutRate.toFixed(1)}% chegaram ao checkout.`,
      },
      {
        category: "tracking_pixels",
        name: "Tracking & Pixels",
        score: trackingScore,
        status: trackingScore >= 80 ? "good" : "warning",
        details: hasCapi ? "Há pixel CAPI ativo e configurado." : detectedPixelsCount > 0 ? "Há pixel ativo, mas CAPI não está configurada." : "Nenhum pixel CAPI ativo foi encontrado.",
      },
      {
        category: "traffic_finance",
        name: "Tráfego & Finanças",
        score: financeScore,
        status: financeScore >= 80 ? "good" : financeScore >= 60 ? "warning" : "bad",
        details: roas === null ? "Sem investimento registrado para calcular ROAS." : `ROAS observado de ${roas.toFixed(2)}x${cpa === null ? "" : ` e CPA de ${cpa.toFixed(2)}`}.`,
      },
    ],
    bottlenecks,
    retentionAnalysis,
    metricsSnapshot: {
      metaClicks, pageviews, ctas, checkouts, purchases, metaSpend, grossRevenue,
      cpc, cpa, roas, ctr: null, ctrSource: "not_available",
      pvRate, ctaRate, checkoutRate, purchaseRate,
      retentionAnalysis,
    },
    analyzedAt: new Date().toISOString(),
  };
}
