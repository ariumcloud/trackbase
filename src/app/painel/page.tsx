import { db, configured } from "@/lib/supabase/server";
import { getAuthUser, checkPlatformAdmin } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
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
} from "@/lib/types";

export const dynamic = "force-dynamic";

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
        appUrl={process.env.APP_URL || "http://localhost:3000"}
      />
    );

  const user = await getAuthUser();
  if (!user) redirect("/login");
  const platformAdmin = await checkPlatformAdmin(user.id);

  const client = await db();
  const { data: workspaces, error: we } = await client
    .from("utm_workspaces")
    .select("id,name,timezone,plan,push_settings")
    .order("created_at");
  const w: Workspace | null =
    workspaces?.find((w) => w.id === p.workspace) ?? workspaces?.[0] ?? null;

  const empty = Promise.resolve({ data: [], error: null });

  const periodParam = p.period || "7";
  const currency = p.currency || "BRL";
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
  const needsPixels = ["integracoes", "campanhas"].includes(activeTab);
  const needsSummary = ["visao", "campanhas"].includes(activeTab);
  const needsAlerts = activeTab === "alertas";
  const needsDiagnostics = ["diagnostico", "assistente"].includes(activeTab);
  const needsShield = activeTab === "shield";

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
  ] = w
    ? await Promise.all([
        client
          .from("utm_offers")
          .select(
            "id,name,landing_url,currency,public_key,product_type,platform,parent_offer_id,checkout_url,percent_fee,fixed_fee,cost_per_sale",
          )
          .eq("workspace_id", w.id)
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
          ? client
              .from("utm_sales")
              .select(
                "id,offer_id,provider,status,amount,gross_amount,fee_amount,net_amount,product_type,parent_transaction_id,currency,country,attribution,is_test,occurred_at",
              )
              .eq("workspace_id", w.id)
              .gte("occurred_at", querySince)
              .lte("occurred_at", queryUntil)
              .order("occurred_at", { ascending: false })
              .limit(1000)
          : empty,
        needsInsights
          ? client
              .from("utm_insights")
              .select(
                "ad_id,campaign_id,adset_id,day,currency,spend,clicks,impressions",
              )
              .eq("workspace_id", w.id)
              .gte("day", since.slice(0, 10))
              .lte("day", until.slice(0, 10))
              .order("day", { ascending: false })
              .limit(1000)
          : empty,
        needsEntities
          ? client
              .from("utm_ad_entities")
              .select("integration_id,external_id,kind,name,status")
              .eq("workspace_id", w.id)
              .order("name")
              .limit(500)
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
  ];

  const failedQuery = queries.find((q) => q.error);
  if (failedQuery) {
    console.error("Dashboard query failed:", failedQuery.name, failedQuery.error);
  }

  const error = failedQuery
    ? `Não foi possível carregar todos os dados (${failedQuery.name}: ${failedQuery.error?.message || "erro"}). Verifique a conexão e as migrations.`
    : p.error === "meta"
      ? "A conexão Meta não foi concluída. Confira as permissões e tente novamente."
      : undefined;

  return (
    <Dashboard
      isAdmin={platformAdmin}
      workspaces={(workspaces ?? []) as Workspace[]}
      workspace={w}
      offers={(offers.data ?? []) as Offer[]}
      links={(links.data ?? []) as LinkRow[]}
      integrations={(integrations.data ?? []) as Integration[]}
      sales={(sales.data ?? []) as SaleRow[]}
      insights={(insights.data ?? []) as InsightRow[]}
      entities={(entities.data ?? []) as Entity[]}
      logs={(logs.data ?? []) as WebhookLog[]}
      pixels={(pixels.data ?? []) as PixelRow[]}
      diagnostics={(diagnosticsRes.data ?? []) as DiagnosticRow[]}
      shields={(shields.data ?? []) as ShieldRow[]}
      shieldLogs={(shieldLogs.data ?? []) as ShieldLogRow[]}
      alerts={alerts}
      summary={(summaryRes.data ?? null) as DashboardSummary | null}
      initialTab={p.tab}
      initialPeriod={p.period}
      appUrl={process.env.APP_URL || "http://localhost:3000"}
      error={error}
    />
  );
}
