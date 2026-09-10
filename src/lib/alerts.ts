import "server-only";
import { createHash } from "node:crypto";
import { admin } from "./supabase/server";
import { isApprovedSaleStatus, isRefundedSaleStatus } from "./sale-status";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertItem = {
  id: string;
  workspace_id: string;
  offer_id: string | null;
  rule_type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  evidence: Record<string, unknown>;
  link: string | null;
  read: boolean;
  created_at: string;
};

function digestFingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 32);
}

/**
 * Avalia regras de alerta para um workspace de forma isolada e segura.
 * Aplica limiares de amostra mínima para evitar alarmes falsos em operações com pouco tráfego.
 */
export async function evaluateAlerts(workspaceId: string): Promise<AlertItem[]> {
  const service = admin();

  // Janela de análise padrão (últimos 7 dias)
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 7);
  const since = sinceDate.toISOString();
  const todayKey = new Date().toISOString().slice(0, 10);

  // 1. Busca dados agregados de vendas, eventos e insights
  const [workspaceRes, salesRes, eventsRes, insightsRes, webhookLogsRes, capiLogsRes, credentialsRes] = await Promise.all([
    service
      .from("utm_workspaces")
      .select("default_currency")
      .eq("id", workspaceId)
      .maybeSingle(),
    service
      .from("utm_sales")
      .select("offer_id, status, gross_amount, net_amount, attribution, currency, occurred_at, is_test")
      .eq("workspace_id", workspaceId)
      .eq("is_test", false)
      .gte("occurred_at", since),
    service
      .from("utm_events")
      .select("offer_id, event_type, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", since),
    service
      .from("utm_insights")
      .select("spend, clicks, impressions, day, currency")
      .eq("workspace_id", workspaceId)
      .gte("day", since.slice(0, 10)),
    service
      .from("utm_webhook_logs")
      .select("received_at, status")
      .eq("workspace_id", workspaceId)
      .order("received_at", { ascending: false })
      .limit(1),
    service
      .from("utm_capi_logs")
      .select("status, response_summary, created_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "failed")
      .gte("created_at", since)
      .limit(5),
    service
      .from("utm_credentials")
      .select("expires_at, integration_id")
      .eq("workspace_id", workspaceId),
  ]);

  const workspaceCurrency = workspaceRes.data?.default_currency || null;
  const sales = salesRes.data || [];
  const events = eventsRes.data || [];
  const insights = insightsRes.data || [];
  const capiFailures = capiLogsRes.data || [];
  const credentials = credentialsRes.data || [];

  const salesInCurrency = workspaceCurrency
    ? sales.filter((s) => s.currency === workspaceCurrency)
    : sales;
  const insightsInCurrency = workspaceCurrency
    ? insights.filter((i) => i.currency === workspaceCurrency)
    : insights;
  const approvedSales = salesInCurrency.filter((s) => isApprovedSaleStatus(s.status));
  const refundedSales = salesInCurrency.filter((s) => isRefundedSaleStatus(s.status));
  const totalSalesCount = approvedSales.length;
  const totalRevenue = approvedSales.reduce((acc, s) => acc + Number(s.gross_amount || 0), 0);

  const totalSpend = insightsInCurrency.reduce((acc, i) => acc + Number(i.spend || 0), 0);
  const totalClicks = insightsInCurrency.reduce((acc, i) => acc + Number(i.clicks || 0), 0);
  const totalImpressions = insightsInCurrency.reduce((acc, i) => acc + Number(i.impressions || 0), 0);

  const pageviews = events.filter((e) => e.event_type === "pageview").length;
  const ctas = events.filter((e) => e.event_type === "cta" || e.event_type === "cta_click").length;
  const checkouts = events.filter((e) => e.event_type === "checkout").length;

  const alertsToInsert: Array<{
    workspace_id: string;
    offer_id: string | null;
    rule_type: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    evidence: Record<string, unknown>;
    link: string;
    fingerprint: string;
  }> = [];

  // REGRA 1: Token Meta expirado ou próximo de expirar
  for (const cred of credentials) {
    if (cred.expires_at) {
      const expires = new Date(cred.expires_at).getTime();
      const now = Date.now();
      if (expires <= now) {
        alertsToInsert.push({
          workspace_id: workspaceId,
          offer_id: null,
          rule_type: "meta_token_expired",
          severity: "critical",
          title: "Conexão da Meta Expirada",
          message: "O token da conta Meta expirou. Reconecte a conta para continuar sincronizando métricas e enviando CAPI.",
          evidence: { expires_at: cred.expires_at },
          link: "/painel?tab=integracoes",
          fingerprint: digestFingerprint([workspaceId, "meta_token_expired", cred.integration_id, todayKey]),
        });
      }
    }
  }

  // REGRA 2: Falhas consecutivas na Conversions API (CAPI)
  if (capiFailures.length >= 3) {
    alertsToInsert.push({
      workspace_id: workspaceId,
      offer_id: null,
      rule_type: "capi_failures",
      severity: "high",
      title: "Falhas no Envio CAPI",
      message: "Foram registradas falhas recorrentes no envio de eventos para a Meta Conversions API.",
      evidence: { failed_count: capiFailures.length, last_error: capiFailures[0]?.response_summary },
      link: "/painel?tab=integracoes",
      fingerprint: digestFingerprint([workspaceId, "capi_failures", todayKey]),
    });
  }

  // REGRA 3: Gasto sem Checkouts (Requer amostra mínima de investimento > R$ 50 ou 100 cliques)
  if (totalClicks >= 100 && totalSpend > 50 && checkouts === 0) {
    alertsToInsert.push({
      workspace_id: workspaceId,
      offer_id: null,
      rule_type: "spend_without_checkout",
      severity: "high",
      title: "Gasto em Anúncios sem Início de Checkout",
      message: `Foram investidos valores de mídia e gerados ${totalClicks} cliques nos últimos 7 dias, mas nenhum checkout foi iniciado.`,
      evidence: { spend: totalSpend, clicks: totalClicks, checkouts: 0 },
      link: "/painel?tab=visao",
      fingerprint: digestFingerprint([workspaceId, "spend_without_checkout", todayKey]),
    });
  }

  // REGRA 4: Checkouts sem Compras (Requer amostra mínima de >= 20 checkouts)
  if (checkouts >= 20 && totalSalesCount === 0) {
    alertsToInsert.push({
      workspace_id: workspaceId,
      offer_id: null,
      rule_type: "checkout_without_purchase",
      severity: "critical",
      title: "Gargalo Crítico no Checkout",
      message: `Foram iniciados ${checkouts} checkouts, mas nenhuma compra foi aprovada. Verifique se o checkout está ativo e aceitando pagamentos.`,
      evidence: { checkouts, purchases: 0 },
      link: "/painel?tab=visao",
      fingerprint: digestFingerprint([workspaceId, "checkout_without_purchase", todayKey]),
    });
  }

  // REGRA 5: ROAS abaixo do Limite (Requer investimento > R$ 100 e gasto com vendas)
  if (totalSpend >= 100 && totalRevenue > 0) {
    const roas = totalRevenue / totalSpend;
    if (roas < 1.0) {
      alertsToInsert.push({
        workspace_id: workspaceId,
        offer_id: null,
        rule_type: "low_roas",
        severity: "medium",
        title: "ROAS Negativo (< 1.0x)",
        message: `O retorno sobre investimento está em ${roas.toFixed(2)}x nos últimos 7 dias (Receita menor que o gasto de anúncios).`,
        evidence: { roas: Number(roas.toFixed(2)), spend: totalSpend, revenue: totalRevenue },
        link: "/painel?tab=campanhas",
        fingerprint: digestFingerprint([workspaceId, "low_roas", todayKey]),
      });
    }
  }

  // REGRA 5b: CTR Anormalmente Baixo (Requer >= 500 impressões)
  if (totalImpressions >= 500) {
    const ctr = (totalClicks / totalImpressions) * 100;
    if (ctr < 0.8) {
      alertsToInsert.push({
        workspace_id: workspaceId,
        offer_id: null,
        rule_type: "low_ctr",
        severity: "low",
        title: "Taxa de Cliques (CTR) Abaixo de 0.8%",
        message: `Seus anúncios geraram ${totalImpressions} impressões com apenas ${ctr.toFixed(2)}% de cliques. Avalie os criativos.`,
        evidence: { impressions: totalImpressions, clicks: totalClicks, ctr: Number(ctr.toFixed(2)) },
        link: "/painel?tab=campanhas",
        fingerprint: digestFingerprint([workspaceId, "low_ctr", todayKey]),
      });
    }
  }

  // REGRA 6: Alta Taxa de Reembolso ou Chargeback (Requer amostra mínima de >= 15 vendas totais)
  const totalTransactions = totalSalesCount + refundedSales.length;
  if (totalTransactions >= 15) {
    const refundRate = (refundedSales.length / totalTransactions) * 100;
    if (refundRate >= 10.0) {
      alertsToInsert.push({
        workspace_id: workspaceId,
        offer_id: null,
        rule_type: "high_refund_rate",
        severity: "high",
        title: "Taxa de Reembolso Acima de 10%",
        message: `A taxa de reembolso/chargeback atingiu ${refundRate.toFixed(1)}% nas últimas vendas (${refundedSales.length} reembolsos).`,
        evidence: { refund_rate: Number(refundRate.toFixed(1)), refunds: refundedSales.length, total: totalTransactions },
        link: "/painel?tab=visao",
        fingerprint: digestFingerprint([workspaceId, "high_refund_rate", todayKey]),
      });
    }
  }

  // REGRA 7: Gargalo de Landing Page (Pageviews altos com poucos CTAs - Requer >= 80 pageviews)
  if (pageviews >= 80) {
    const ctaRate = (ctas / pageviews) * 100;
    if (ctaRate < 5.0) {
      alertsToInsert.push({
        workspace_id: workspaceId,
        offer_id: null,
        rule_type: "low_cta_conversion",
        severity: "low",
        title: "Conversão Baixa de Visita para CTA",
        message: `Apenas ${ctaRate.toFixed(1)}% dos visitantes clicaram em botões de CTA nos últimos 7 dias (${ctas} cliques em ${pageviews} visitas).`,
        evidence: { pageviews, ctas, cta_rate: Number(ctaRate.toFixed(1)) },
        link: "/painel?tab=visao",
        fingerprint: digestFingerprint([workspaceId, "low_cta_conversion", todayKey]),
      });
    }
  }

  // REGRA 8: Webhook Inativo (Apenas na rotina periódica/cron: se houver vendas no passado e nenhuma nos últimos 3 dias)
  const lastWebhook = webhookLogsRes.data?.[0];
  if (lastWebhook) {
    const lastReceived = new Date(lastWebhook.received_at).getTime();
    const threeDaysAgo = Date.now() - 3 * 24 * 3600 * 1000;
    if (lastReceived < threeDaysAgo) {
      alertsToInsert.push({
        workspace_id: workspaceId,
        offer_id: null,
        rule_type: "inactive_webhook",
        severity: "medium",
        title: "Nenhum Webhook Recebido Recentemente",
        message: "Não foram recebidos novos eventos de webhook da Hotmart ou Cakto nos últimos 3 dias.",
        evidence: { last_received_at: lastWebhook.received_at },
        link: "/painel?tab=integracoes",
        fingerprint: digestFingerprint([workspaceId, "inactive_webhook", todayKey]),
      });
    }
  }

  // 2. Insere alertas no banco com deduplicação por fingerprint
  for (const alert of alertsToInsert) {
    await service.from("utm_alerts").upsert(
      alert,
      { onConflict: "workspace_id,fingerprint", ignoreDuplicates: true },
    );
  }

  // 3. Retorna alertas do workspace
  const { data: currentAlerts } = await service
    .from("utm_alerts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (currentAlerts || []) as AlertItem[];
}
