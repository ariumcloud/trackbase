import { db, configured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import type {
  Workspace,
  Offer,
  LinkRow,
  Integration,
  SaleRow,
  InsightRow,
  Entity,
  WebhookLog,
} from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; tab?: string; error?: string }>;
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
  const [offers, links, integrations, sales, insights, entities, logs] = w
    ? await Promise.all([
        client
          .from("utm_offers")
          .select("id,name,landing_url,currency")
          .eq("workspace_id", w.id)
          .order("created_at", { ascending: false }),
        client
          .from("utm_links")
          .select("id,name,url,offer_id,params,active,created_at")
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
          .limit(1000),
        client
          .from("utm_insights")
          .select(
            "ad_id,campaign_id,adset_id,day,currency,spend,clicks,impressions",
          )
          .eq("workspace_id", w.id)
          .order("day", { ascending: false })
          .limit(1000),
        client
          .from("utm_ad_entities")
          .select("integration_id,external_id,kind,name,status")
          .eq("workspace_id", w.id)
          .order("name")
          .limit(1000),
        client
          .from("utm_webhook_logs")
          .select(
            "id,integration_id,event_id,status,reason,received_at,is_test",
          )
          .eq("workspace_id", w.id)
          .order("received_at", { ascending: false })
          .limit(50),
      ])
    : [empty, empty, empty, empty, empty, empty, empty];
  const error =
    we ||
    [offers, links, integrations, sales, insights, entities, logs].some(
      (r) => r.error,
    )
      ? "Não foi possível carregar todos os dados. Verifique a conexão e as migrations."
      : p.error === "meta"
        ? "A conexão Meta não foi concluída. Confira as permissões e tente novamente."
        : sales.data?.length === 1000 || insights.data?.length === 1000
          ? "Há mais de 1.000 registros. Este painel MVP mostra uma janela limitada; totais podem estar incompletos."
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
      initialTab={p.tab}
      appUrl={process.env.APP_URL || "http://localhost:3000"}
      error={error}
    />
  );
}
