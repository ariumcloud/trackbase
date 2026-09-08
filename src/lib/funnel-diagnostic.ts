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
};

export type CategoryScore = {
  category: "speed_mobile" | "copy_promise" | "tracking_pixels" | "traffic_finance";
  name: string;
  score: number;
  status: "good" | "warning" | "bad";
  details: string;
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
};

export type FunnelDiagnosticResult = {
  overallScore: number;
  overallGrade: "A" | "B" | "C" | "D" | "F";
  sampleStatus: "insufficient" | "sufficient";
  sampleNotice: string | null;
  primaryHeadline: string;
  categoryScores: CategoryScore[];
  bottlenecks: FunnelBottleneck[];
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
      title: "CAPI não configurada",
      headline: "Há compras suficientes para justificar validar a CAPI.",
      severity: "high",
      observed: `${purchases} compras foram registradas, mas não há pixel CAPI ativo e configurado neste workspace.`,
      hypothesis: "Sem CAPI, parte da atribuição server-side pode não chegar à Meta; a perda efetiva não é mensurada por este diagnóstico.",
      recommendation: "Configure um pixel CAPI ativo e valide o log de envio antes de avaliar impacto em atribuição.",
      estimatedLoss: null,
      actionLabel: "Configurar CAPI",
      actionTab: "integracoes",
    });
  }

  const sampleNotice = sampleStatus === "insufficient"
    ? `Amostra insuficiente para classificar gargalos: são necessários ao menos ${MIN_CLICKS} cliques, ${MIN_PAGEVIEWS} pageviews ou ${MIN_CHECKOUTS} checkouts.`
    : null;

  if (bottlenecks.length === 0 && sampleStatus === "insufficient") {
    bottlenecks.push({
      id: "insufficient_sample",
      title: "Amostra insuficiente",
      headline: "Ainda não há volume para classificar um gargalo com confiança.",
      severity: "low",
      observed: `${metaClicks} cliques, ${pageviews} pageviews e ${checkouts} checkouts registrados.`,
      hypothesis: "Não aplicável enquanto não houver volume mínimo.",
      recommendation: "Continue a coleta e reavalie quando houver mais volume; não escale nem pause com base nesta amostra.",
      estimatedLoss: null,
    });
  }

  if (bottlenecks.length === 0) {
    bottlenecks.push({
      id: "no_classified_bottleneck",
      title: "Nenhum gargalo classificado",
      headline: "A amostra atual não cruzou os limiares determinísticos de gargalo.",
      severity: "good",
      observed: `Amostra de ${metaClicks} cliques, ${pageviews} pageviews e ${checkouts} checkouts sem alerta determinístico.`,
      hypothesis: "Isso não prova que o funil é saudável; apenas não há evidência suficiente para uma classificação nesta janela.",
      recommendation: "Monitore outra janela e avalie antes de escalar ou pausar campanhas.",
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
    metricsSnapshot: {
      metaClicks, pageviews, ctas, checkouts, purchases, metaSpend, grossRevenue,
      cpc, cpa, roas, ctr: null, ctrSource: "not_available",
      pvRate, ctaRate, checkoutRate, purchaseRate,
    },
    analyzedAt: new Date().toISOString(),
  };
}
