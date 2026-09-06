import { db, configured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { dayInZone } from "@/lib/metrics";
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
        summary={null}
        initialTab={p.tab}
        appUrl={process.env.APP_URL || "http://localhost:3000"}
      />
    );
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");

  const { data: workspaces, error: we } = await client
    .from("utm_workspaces")
    .select("id,name,timezone,plan")
    .order("created_at");
  const w: Workspace | null =
    workspaces?.find((w) => w.id === p.workspace) ?? workspaces?.[0] ?? null;

  const empty = { data: [], error: null };

  const periodDays = Number(p.period) || 7;
  const currency = p.currency || "BRL";
  const offerFilter = p.offer && p.offer !== "all" ? p.offer : null;
  const timezone = w?.timezone || "America/Sao_Paulo";
  const today = dayInZone(new Date(), timezone);
  const begin = new Date(`${today}T12:00:00Z`);
  begin.setUTCDate(begin.getUTCDate() - periodDays + 1);
  const since = `${begin.toISOString().slice(0, 10)}T00:00:00Z`;
  const until = `${today}T23:59:59Z`;

  const [offers, links, integrations, sales, insights, entities, logs, summaryRes] = w
    ? await Promise.all([
        client
          .from("utm_offers")
          .select("id,name,landing_url,currency,public_key")
          .eq("workspace_id", w.id)
          .order("created_at", { ascending: false }),
        client
          .from("utm_links")
          .select("id,name,url,offer_id,params,active,public_key,created_at")
          .eq("workspace_id", w.id)
          .order("created_at", { ascending: false }),
        client
          .from("utm_integrations")
          .select("id,name,provider,status,account_id,currency,last_synced_at")
          .eq("workspace_id", w.id)
          .order("created_at"),
        client
          .from("utm_sales")
          .select(
            "id,offer_id,provider,status,amount,currency,country,attribution,is_test,occurred_at",
          )
          .eq("workspace_id", w.id)
          .order("occurred_at", { ascending: false })
          .limit(200),
        client
          .from("utm_insights")
          .select(
            "ad_id,campaign_id,adset_id,day,currency,spend,clicks,impressions",
          )
          .eq("workspace_id", w.id)
          .order("day", { ascending: false })
          .limit(200),
        client
          .from("utm_ad_entities")
          .select("integration_id,external_id,kind,name,status")
          .eq("workspace_id", w.id)
          .order("name")
          .limit(500),
        client
          .from("utm_webhook_logs")
          .select(
            "id,integration_id,event_id,status,reason,received_at,is_test",
          )
          .eq("workspace_id", w.id)
          .order("received_at", { ascending: false })
          .limit(50),
        client.rpc("utm_dashboard_summary", {
          p_workspace: w.id,
          p_since: since,
          p_until: until,
          p_currency: currency,
          p_offer_id: offerFilter,
        }),
      ])
    : [empty, empty, empty, empty, empty, empty, empty, { data: null, error: null }];

  const error =
    we ||
    [offers, links, integrations, sales, insights, entities, logs].some(
      (r) => r.error,
    )
      ? "Não foi possível carregar todos os dados. Verifique a conexão e as migrations."
      : p.error === "meta"
        ? "A conexão Meta não foi concluída. Confira as permissões e tente novamente."
        : undefined;

  return (
    <Dashboard
      workspaces={(workspaces ?? []) as Workspace[]}
      workspace={w}
      offers={(offers.data ?? []) as Offer[]}
      links={(links.data ?? []) as LinkRow[]}
      integrations={(integrations.data ?? []) as Integration[]}
      sales={(sales.data ?? []) as SaleRow[]}
      insights={(insights.data ?? []) as InsightRow[]}
      entities={(entities.data ?? []) as Entity[]}
      logs={(logs.data ?? []) as WebhookLog[]}
      summary={(summaryRes.data ?? null) as DashboardSummary | null}
      initialTab={p.tab}
      appUrl={process.env.APP_URL || "http://localhost:3000"}
      error={error}
    />
  );
}
