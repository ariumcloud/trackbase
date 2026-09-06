export type DiagnosticSeverity = "critical" | "high" | "medium" | "low" | "good";

export type FunnelBottleneck = {
  id: string;
  title: string;
  headline: string;
  severity: DiagnosticSeverity;
  evidence: string;
  possibleCause: string;
  estimatedLoss: number; // Valor estimado em moeda local
  recommendation: string;
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
    cpc: number;
    cpa: number;
    roas: number;
    ctr: number;
    pvRate: number; // PageViews / Cliques
    ctaRate: number; // CTAs / PageViews
    checkoutRate: number; // Checkouts / CTAs
    purchaseRate: number; // Compras / Checkouts
  };
  analyzedAt: string;
};

export function runFunnelDiagnostic(input: FunnelDiagnosticInput): FunnelDiagnosticResult {
  const {
    metaClicks = 0,
    pageviews = 0,
    ctas = 0,
    checkouts = 0,
    purchases = 0,
    metaSpend = 0,
    grossRevenue = 0,
    hasCapi = false,
    detectedPixelsCount = 0,
  } = input;

  const cpc = metaClicks > 0 ? metaSpend / metaClicks : 0;
  const cpa = purchases > 0 ? metaSpend / purchases : metaSpend;
  const roas = metaSpend > 0 ? grossRevenue / metaSpend : 0;
  const ctr = metaClicks > 0 ? 1.8 : 0; // estimativa padrão

  const pvRate = metaClicks > 0 ? Math.min(100, (pageviews / metaClicks) * 100) : 100;
  const ctaRate = pageviews > 0 ? Math.min(100, (ctas / pageviews) * 100) : 0;
  const checkoutRate = ctas > 0 ? Math.min(100, (checkouts / ctas) * 100) : (pageviews > 0 ? (checkouts / pageviews) * 100 : 0);
  const purchaseRate = checkouts > 0 ? Math.min(100, (purchases / checkouts) * 100) : 0;

  const bottlenecks: FunnelBottleneck[] = [];

  // 1. Diferença entre cliques da Meta e pageviews reais
  if (metaClicks >= 15 && pvRate < 70) {
    const lostVisits = Math.max(0, Math.round(metaClicks * (0.85 - pvRate / 100)));
    const estimatedLoss = lostVisits * cpc * 1.5;
    bottlenecks.push({
      id: "drop_meta_pv",
      title: "Perda de tráfego antes do carregamento",
      headline: "Há diferença entre os cliques da Meta e os pageviews registrados.",
      severity: pvRate < 50 ? "critical" : "high",
      evidence: `${metaClicks} cliques registrados na Meta, mas apenas ${pageviews} visualizações de página (${pvRate.toFixed(1)}% de aproveitamento).`,
      possibleCause: "A página está lenta no mobile ou há redirecionamentos pesados antes do script carregar.",
      estimatedLoss: Math.round(estimatedLoss),
      recommendation: "Comprima imagens da landing page, remova scripts externos desnecessários e use o script assíncrono do Kirofy.",
      actionLabel: "Otimizar velocidade",
      actionTab: "clonador",
    });
  }

  // 2. Anúncio barato com poucos checkouts
  if (metaClicks >= 20 && cpc > 0 && cpc < 1.5 && checkouts <= 1) {
    bottlenecks.push({
      id: "cheap_clicks_few_checkouts",
      title: "Tráfego desqualificado ou promessa desalinhada",
      headline: "O anúncio está trazendo cliques baratos, mas poucos checkouts.",
      severity: "high",
      evidence: `CPC médio favorável de R$ ${cpc.toFixed(2)}, porém apenas ${checkouts} checkouts gerados em ${metaClicks} cliques.`,
      possibleCause: "A promessa do criativo do anúncio não corresponde à expectativa criada na primeira dobra da página.",
      estimatedLoss: Math.round(metaSpend * 0.7),
      recommendation: "Alinhe o texto do anúncio com o headline principal da landing e reforce a chamada para ação acima da dobra.",
      actionLabel: "Ver campanhas",
      actionTab: "campanhas",
    });
  }

  // 3. Maior perda entre landing e checkout
  if (pageviews >= 30 && (ctaRate < 6 || (ctas > 0 && checkoutRate < 20))) {
    const expectedCheckouts = Math.round(pageviews * 0.12);
    const lostCheckouts = Math.max(0, expectedCheckouts - checkouts);
    const avgTicket = purchases > 0 ? grossRevenue / purchases : 97;
    bottlenecks.push({
      id: "loss_landing_checkout",
      title: "Gargalo severo entre a leitura e o checkout",
      headline: "A maior perda está entre landing e checkout.",
      severity: "critical",
      evidence: `Taxa de cliques no CTA de apenas ${ctaRate.toFixed(1)}%. De ${pageviews} visitantes, somente ${checkouts} chegaram ao checkout.`,
      possibleCause: "Falta de prova social clara, CTAs apagados ou texto longo demais sem botões intermediários.",
      estimatedLoss: Math.round(lostCheckouts * avgTicket * 0.25),
      recommendation: "Insira depoimentos visuais, destaque o botão com contraste e adicione um CTA fixo no rodapé mobile.",
      actionLabel: "Editar blocos no clonador",
      actionTab: "clonador",
    });
  }

  // 4. Checkout recebe acessos mas não gera compras
  if (checkouts >= 5 && purchaseRate < 12) {
    const abandoned = checkouts - purchases;
    const avgTicket = purchases > 0 ? grossRevenue / purchases : 97;
    bottlenecks.push({
      id: "checkout_abandonment",
      title: "Abandono excessivo na etapa de pagamento",
      headline: "O checkout recebe acessos, mas não gera compras.",
      severity: "critical",
      evidence: `${checkouts} checkouts iniciados, mas apenas ${purchases} pedidos aprovados (${purchaseRate.toFixed(1)}% de conversão de checkout).`,
      possibleCause: "Falta de opções de PIX imediato, juros no parcelamento, frete surpresa ou checkout lento.",
      estimatedLoss: Math.round(abandoned * avgTicket * 0.4),
      recommendation: "Ative checkout em 1 etapa com PIX automático, remova campos desnecessários e coloque selos de segurança.",
      actionLabel: "Ver integrações",
      actionTab: "integracoes",
    });
  }

  // 5. Pixel ativo sem evento Purchase / CAPI
  if (purchases > 0 && !hasCapi) {
    bottlenecks.push({
      id: "missing_capi",
      title: "Rastreamento server-side ausente",
      headline: "O pixel está ativo, mas o evento Purchase não está chegando via CAPI.",
      severity: "high",
      evidence: "Foram registradas vendas na plataforma, mas a Conversions API (CAPI) não está configurada neste workspace.",
      possibleCause: "Bloqueadores de anúncio (AdBlock) e iOS 14+ estão descartando até 35% das suas conversões no navegador.",
      estimatedLoss: Math.round(purchases * 0.3 * (purchases > 0 ? grossRevenue / purchases : 97) * 0.2),
      recommendation: "Ative a CAPI server-side do Kirofy nas configurações para recuperar atribuição e baratear seus anúncios.",
      actionLabel: "Configurar CAPI",
      actionTab: "integracoes",
    });
  }

  // 6. Página lenta no mobile
  if (pvRate < 60 && metaClicks >= 10) {
    bottlenecks.push({
      id: "slow_mobile",
      title: "Descarte por lentidão em redes 4G/5G",
      headline: "A página está lenta no mobile.",
      severity: "medium",
      evidence: "A taxa de carregamento estimada no mobile está abaixo dos 2,5 segundos ideais.",
      possibleCause: "Imagens pesadas sem formato WebP e múltiplos iframes pesados.",
      estimatedLoss: Math.round(metaSpend * 0.25),
      recommendation: "Converta imagens para WebP, use lazy loading e reduza o peso total da página para menos de 1.8MB.",
      actionLabel: "Diagnosticar no clonador",
      actionTab: "clonador",
    });
  }

  // Se não houver gargalos graves identificados:
  if (bottlenecks.length === 0) {
    bottlenecks.push({
      id: "healthy_operation",
      title: "Operação balanceada e sem vazamentos críticos",
      headline: "Seu funil apresenta conversão saudável entre as etapas.",
      severity: "good",
      evidence: `Conversão de página para checkout em ${ctaRate > 0 ? ctaRate.toFixed(1) : "—"}% e conversão de pagamento estável.`,
      possibleCause: "Alinhamento adequado entre anúncio, página de vendas e checkout.",
      estimatedLoss: 0,
      recommendation: "Mantenha o monitoramento e escale o orçamento das campanhas com melhor ROAS gradualmente.",
      actionLabel: "Ver campanhas",
      actionTab: "campanhas",
    });
  }

  // Cálculo das notas por categoria (0-100)
  const speedScore = Math.max(30, Math.min(100, Math.round(pvRate * 1.05)));
  const copyScore = Math.max(25, Math.min(100, Math.round((ctaRate / 15) * 60 + (checkoutRate / 30) * 40)));
  const trackingScore = hasCapi ? 95 : (detectedPixelsCount > 0 ? 75 : 55);
  const financeScore = roas >= 2 ? 95 : (roas >= 1 ? 75 : (metaSpend === 0 ? 80 : 45));

  const categoryScores: CategoryScore[] = [
    {
      category: "speed_mobile",
      name: "Velocidade & Mobile",
      score: speedScore,
      status: speedScore >= 80 ? "good" : speedScore >= 60 ? "warning" : "bad",
      details: `${pvRate.toFixed(0)}% dos cliques chegam a registrar visualização da página.`,
    },
    {
      category: "copy_promise",
      name: "Copy & Conversão",
      score: copyScore,
      status: copyScore >= 75 ? "good" : copyScore >= 55 ? "warning" : "bad",
      details: `${ctaRate.toFixed(1)}% de interação com os botões e ofertas da página.`,
    },
    {
      category: "tracking_pixels",
      name: "Tracking & Pixels",
      score: trackingScore,
      status: trackingScore >= 80 ? "good" : "warning",
      details: hasCapi ? "Pixel e CAPI server-side ativos com deduplicação." : "Apenas pixel client-side ativo; CAPI pendente.",
    },
    {
      category: "traffic_finance",
      name: "Tráfego & Finanças",
      score: financeScore,
      status: financeScore >= 80 ? "good" : financeScore >= 60 ? "warning" : "bad",
      details: metaSpend > 0 ? `ROAS atual de ${roas.toFixed(2)}x com CPA médio de R$ ${cpa.toFixed(2)}.` : "Sem investimento de mídia registrado no período.",
    },
  ];

  const overallScore = Math.round(
    speedScore * 0.25 + copyScore * 0.35 + trackingScore * 0.2 + financeScore * 0.2,
  );

  const overallGrade =
    overallScore >= 85 ? "A" : overallScore >= 72 ? "B" : overallScore >= 60 ? "C" : overallScore >= 45 ? "D" : "F";

  const primaryHeadline = bottlenecks[0]?.headline || "Diagnóstico concluído.";

  return {
    overallScore,
    overallGrade,
    primaryHeadline,
    categoryScores,
    bottlenecks,
    metricsSnapshot: {
      metaClicks,
      pageviews,
      ctas,
      checkouts,
      purchases,
      metaSpend,
      grossRevenue,
      cpc,
      cpa,
      roas,
      ctr,
      pvRate,
      ctaRate,
      checkoutRate,
      purchaseRate,
    },
    analyzedAt: new Date().toISOString(),
  };
}
