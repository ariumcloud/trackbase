import { admin, db, configured } from "@/lib/supabase/server";
import { getAuthUser, checkPlatformAdmin } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { Dashboard } from "@/components/dashboard";
import { dayInZone } from "@/lib/metrics";
import { evaluateAlerts, type AlertItem } from "@/lib/alerts";
import type {
  Workspace,
  Offer,
  LinkRow,
  Integration,
  SaleRow,
  InsightRow,
  Entity,
  WebhookLog,
  DashboardSummary,
  PixelRow,
  DiagnosticRow,
  ShieldRow,
  ShieldLogRow,
  TrackingEvent,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Supabase applies a server-side row limit to every request. Dashboard totals
 * must not silently stop at the first page, so high-volume tables are read in
 * deterministic batches before the client performs any aggregation.
 */
async function fetchAllRows(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>,
  pageSize = 1000,
): Promise<{ data: unknown[]; error: PostgrestError | null }> {
  const rows: unknown[] = [];
  for (let page = 0; page < 1000; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const result = await build(from, to);
    if (result.error) return { data: rows, error: result.error };
    const batch = result.data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return { data: rows, error: null };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    workspace?: string;
    tab?: string;
    error?: string;
    period?: string;
    currency?: string;
    offer?: string;
    provider?: string;
    meta_select?: string;
  }>;
}) {
  const p = await searchParams;
  const activeTab = p.tab || "visao";
  if (!configured())
    return (
      <Dashboard
        setup
        workspaces={[]}
        workspace={null}
        offers={[]}
        links={[]}
        integrations={[]}
        sales={[]}
        insights={[]}
        entities={[]}
        logs={[]}
        pixels={[]}
        shields={[]}
        shieldLogs={[]}
        alerts={[]}
        summary={null}
        initialTab={p.tab}
        account={{ name: null, document: null, email: null }}
        monthlySalesCount={0}
        appUrl={process.env.APP_URL || "http://localhost:3000"}
      />
    );

  const user = await getAuthUser();
  if (!user) redirect("/login");
  const platformAdmin = await checkPlatformAdmin(user.id);
  const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const account = {
    name: typeof userMeta.full_name === "string" ? userMeta.full_name : null,
    document: typeof userMeta.document === "string" ? userMeta.document : null,
    email: user.email ?? null,
  };

  const client = await db();
  const { data: workspaces, error: we } = await client
    .from("utm_workspaces")
    .select("id,name,timezone,plan,push_settings,default_currency")
    .order("created_at");
  const w: Workspace | null =
    workspaces?.find((w) => w.id === p.workspace) ?? workspaces?.[0] ?? null;

  // O tracker grava eventos via RPC com service_role. A leitura autenticada
  // dessa tabela pode retornar uma lista vazia quando a política de membro do
  // ambiente ainda não foi aplicada de forma consistente. O workspace já foi
  // resolvido pela consulta autenticada acima; o cliente administrativo fica
  // restrito a esse mesmo workspace e evita perder IC/pageviews no painel.
  const eventsClient = w ? admin() : client;

  const empty = Promise.resolve({ data: [], error: null });

  const periodParam = p.period || "7";
  const currency = p.currency || w?.default_currency || "BRL";
  const offerFilter = p.offer && p.offer !== "all" ? p.offer : null;
  const timezone = w?.timezone || "America/Sao_Paulo";
  const today = dayInZone(new Date(), timezone);

  let since: string;
  let until: string;

  if (periodParam === "yesterday") {
    const yDate = new Date(`${today}T12:00:00Z`);
    yDate.setUTCDate(yDate.getUTCDate() - 1);
    const yStr = yDate.toISOString().slice(0, 10);
    since = `${yStr}T00:00:00Z`;
    until = `${yStr}T23:59:59Z`;
  } else if (periodParam.includes("_")) {
    const [startDate, endDate] = periodParam.split("_");
    since = `${startDate || today}T00:00:00Z`;
    until = `${endDate || today}T23:59:59Z`;
  } else {
    const periodDays = Number(periodParam) || 7;
    const begin = new Date(`${today}T12:00:00Z`);
    begin.setUTCDate(begin.getUTCDate() - periodDays + 1);
    since = `${begin.toISOString().slice(0, 10)}T00:00:00Z`;
    until = `${today}T23:59:59Z`;
  }

  // 24h buffer on both ends prevents any timezone boundary cutoff while avoiding unbounded queries
  const querySince = new Date(new Date(since).getTime() - 24 * 3600 * 1000).toISOString();
  const queryUntil = new Date(new Date(until).getTime() + 24 * 3600 * 1000).toISOString();

  const needsSales = ["visao", "campanhas", "assistente", "radar", "simulador"].includes(activeTab);
  const needsInsights = ["visao", "campanhas", "assistente"].includes(activeTab);
  const needsEntities = ["visao", "campanhas", "assistente"].includes(activeTab);
  const needsLogs = activeTab === "integracoes";
  // The offers tab exposes the universal Meta Pixel installer, so it also
  // needs the pixel rows available before opening that modal. Without this,
  // a configured pixel was incorrectly treated as missing until navigation.
  const needsPixels = ["integracoes", "campanhas", "ofertas"].includes(activeTab);
  const needsSummary = ["visao", "campanhas"].includes(activeTab);
  const needsAlerts = activeTab === "alertas";
  const needsDiagnostics = ["diagnostico", "assistente"].includes(activeTab);
  const needsShield = activeTab === "shield";
  const needsEvents = ["radar", "simulador", "visao", "campanhas"].includes(activeTab);

  // Independente da aba aberta e do período selecionado no dashboard: o uso
  // do plano precisa refletir o total de vendas do mês corrente, não o
  // recorte de datas que o usuário escolheu em outra tela.
  const monthStart = `${today.slice(0, 7)}-01T00:00:00Z`;
  const monthlySalesCount = w
    ? await client
        .from("utm_sales")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", w.id)
        .eq("is_test", false)
        .gte("occurred_at", monthStart)
        .lte("occurred_at", queryUntil)
        .then((res) => res.count ?? 0)
    : 0;

  const [
    offers,
    links,
    integrations,
    sales,
    insights,
    entities,
    logs,
    pixels,
    summaryRes,
    alerts,
    diagnosticsRes,
    shields,
    shieldLogs,
    events,
  ] = w
    ? await Promise.all([
        client
          .from("utm_offers")
          .select(
            "id,name,landing_url,currency,public_key,product_type,platform,parent_offer_id,checkout_url,percent_fee,fixed_fee,cost_per_sale,active",
          )
          .eq("workspace_id", w.id)
          .or("active.is.null,active.eq.true")
          .order("created_at", { ascending: false }),
        client
          .from("utm_links")
          .select("id,name,url,offer_id,params,active,public_key,created_at")
          .eq("workspace_id", w.id)
          .order("created_at", { ascending: false }),
        client
          .from("utm_integrations")
          .select("id,name,provider,status,offer_id,account_id,currency,last_synced_at")
          .eq("workspace_id", w.id)
          .order("created_at"),
        needsSales
          ? fetchAllRows((from, to) =>
              client
                .from("utm_sales")
                .select(
                  "id,offer_id,provider,status,amount,gross_amount,fee_amount,fee_currency,net_amount,net_currency,product_type,parent_transaction_id,currency,country,attribution,is_test,occurred_at",
                )
                .eq("workspace_id", w.id)
                .gte("occurred_at", querySince)
                .lte("occurred_at", queryUntil)
                .order("occurred_at", { ascending: false })
                .range(from, to),
            )
          : empty,
        needsInsights
          ? fetchAllRows((from, to) =>
              client
                .from("utm_insights")
                .select(
                  "integration_id,ad_id,campaign_id,adset_id,day,currency,spend,clicks,impressions,meta_initiate_checkouts",
                )
                .eq("workspace_id", w.id)
                .gte("day", since.slice(0, 10))
                .lte("day", until.slice(0, 10))
                .order("day", { ascending: false })
                .range(from, to),
            )
          : empty,
        needsEntities
          ? fetchAllRows((from, to) =>
              client
                .from("utm_ad_entities")
                .select("integration_id,external_id,kind,parent_id,name,status,budget_minor,budget_currency,budget_type,meta_created_at")
                .eq("workspace_id", w.id)
                .order("external_id", { ascending: false })
                .range(from, to),
            )
          : empty,
        needsLogs
          ? client
              .from("utm_webhook_logs")
              .select(
                "id,integration_id,event_id,status,reason,received_at,is_test",
              )
              .eq("workspace_id", w.id)
              .order("received_at", { ascending: false })
              .limit(50)
          : empty,
        needsPixels
          ? client
              .from("utm_pixels")
              .select("id,pixel_id,offer_id,test_event_code,active,created_at")
              .eq("workspace_id", w.id)
              .order("created_at", { ascending: false })
          : empty,
        needsSummary
          ? client.rpc("utm_dashboard_summary", {
              p_workspace: w.id,
              p_since: since,
              p_until: until,
              p_currency: currency,
              p_offer_id: offerFilter,
            })
          : Promise.resolve({ data: null, error: null }),
        needsAlerts
          ? evaluateAlerts(w.id).catch(() => [] as AlertItem[])
          : Promise.resolve([] as AlertItem[]),
        needsDiagnostics
          ? client
              .from("utm_funnel_diagnostics")
              .select("id,workspace_id,offer_id,url,score,category_scores,bottlenecks,recommendations,metrics_snapshot,created_at")
              .eq("workspace_id", w.id)
              .order("created_at", { ascending: false })
              .limit(20)
          : empty,
        needsShield
          ? client
              .from("utm_shields")
              .select("*")
              .eq("workspace_id", w.id)
              .order("created_at", { ascending: false })
          : empty,
        needsShield
          ? client
              .from("utm_shield_logs")
              .select("*")
              .eq("workspace_id", w.id)
              .order("created_at", { ascending: false })
              .limit(100)
          : empty,
        needsEvents
          ? fetchAllRows((from, to) =>
              eventsClient
                .from("utm_events")
                .select("id,workspace_id,offer_id,link_id,event_type,session_id,url,attribution,created_at")
                .eq("workspace_id", w.id)
                .gte("created_at", querySince)
                .lte("created_at", queryUntil)
                .order("created_at", { ascending: false })
                .range(from, to),
            )
          : empty,
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null },
        [] as AlertItem[],
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const queries = [
    { name: "workspaces", error: we },
    { name: "offers", error: offers.error },
    { name: "links", error: links.error },
    { name: "integrations", error: integrations.error },
    { name: "sales", error: sales.error },
    { name: "insights", error: insights.error },
    { name: "entities", error: entities.error },
    { name: "logs", error: logs.error },
    { name: "pixels", error: pixels.error },
    { name: "events", error: events.error },
  ];

  const failedQuery = queries.find((q) => q.error);
  if (failedQuery) {
    console.error("Dashboard query failed:", failedQuery.name, failedQuery.error);
  }

  const error = failedQuery
    ? "Não foi possível carregar alguns dados agora. Atualize a página ou tente novamente em instantes."
    : p.error === "meta"
      ? "A conexão Meta não foi concluída. Confira as permissões e tente novamente."
      : undefined;

  const resolvedIntegrations = (integrations.data ?? []) as Integration[];
  const periodStartDay = since.slice(0, 10);
  const periodEndDay = until.slice(0, 10);
  const periodSales = ((sales.data ?? []) as SaleRow[]).filter((sale) => {
    const day = dayInZone(new Date(sale.occurred_at), timezone);
    return day >= periodStartDay && day <= periodEndDay;
  });
  const periodEvents = ((events.data ?? []) as TrackingEvent[]).filter((event) => {
    const day = dayInZone(new Date(event.created_at), timezone);
    return day >= periodStartDay && day <= periodEndDay;
  });

  return (
    <Dashboard
      isAdmin={platformAdmin}
      workspaces={(workspaces ?? []) as Workspace[]}
      workspace={w}
      offers={(offers.data ?? []) as Offer[]}
      links={(links.data ?? []) as LinkRow[]}
      integrations={resolvedIntegrations}
      sales={periodSales}
      insights={(insights.data ?? []) as InsightRow[]}
      entities={(entities.data ?? []) as Entity[]}
      events={periodEvents}
      logs={(logs.data ?? []) as WebhookLog[]}
      pixels={(pixels.data ?? []) as PixelRow[]}
      diagnostics={(diagnosticsRes.data ?? []) as DiagnosticRow[]}
      shields={(shields.data ?? []) as ShieldRow[]}
      shieldLogs={(shieldLogs.data ?? []) as ShieldLogRow[]}
      alerts={alerts}
      summary={(summaryRes.data ?? null) as DashboardSummary | null}
      initialTab={p.tab}
      initialCurrency={currency}
      initialProvider={p.provider}
      initialPeriod={p.period}
      metaSelectIntegrationId={p.meta_select}
      account={account}
      monthlySalesCount={monthlySalesCount}
      appUrl={process.env.APP_URL || "http://localhost:3000"}
      error={error}
    />
  );
}
