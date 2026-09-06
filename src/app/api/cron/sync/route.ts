import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/server";
import { credentials, pages, type RawInsight } from "@/lib/meta";
import { dayInZone } from "@/lib/metrics";

export const maxDuration = 300; // 5 minutos se hospedado no serverless

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }

    const service = admin();
    const { data: integrations, error } = await service
      .from("utm_integrations")
      .select("id,workspace_id,account_id,account_timezone,name")
      .eq("provider", "meta")
      .eq("status", "connected")
      .not("account_id", "is", null);

    if (error || !integrations || integrations.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, message: "Nenhuma integração Meta pendente de sincronização." });
    }

    const results: Array<{ id: string; name: string; status: string; error?: string }> = [];

    for (const integration of integrations) {
      try {
        const { token } = await credentials(integration.workspace_id, integration.id);
        const until = dayInZone(new Date(), integration.account_timezone || "UTC");
        const start = new Date(`${until}T12:00:00Z`);
        start.setUTCDate(start.getUTCDate() - 3); // Últimos 3 dias
        const since = start.toISOString().slice(0, 10);

        const insights = await pages<RawInsight>(
          `${integration.account_id}/insights`,
          token,
          {
            fields:
              "ad_id,campaign_id,adset_id,date_start,account_currency,spend,impressions,inline_link_clicks,reach,actions,action_values",
            level: "ad",
            time_increment: "1",
            time_range: JSON.stringify({ since, until }),
          },
        );

        const entities = [];
        for (const [edge, kind] of [
          ["campaigns", "campaign"],
          ["adsets", "adset"],
          ["ads", "ad"],
        ]) {
          const rows = await pages<{
            id: string;
            name: string;
            status: string;
            campaign_id?: string;
            adset_id?: string;
          }>(`${integration.account_id}/${edge}`, token, {
            fields: `id,name,status${kind === "adset" ? ",campaign_id" : kind === "ad" ? ",adset_id" : ""}`,
          });
          entities.push(
            ...rows.map((r) => ({
              workspace_id: integration.workspace_id,
              integration_id: integration.id,
              external_id: r.id,
              name: r.name,
              status: r.status,
              kind,
              parent_id: r.adset_id ?? r.campaign_id ?? null,
            })),
          );
        }

        const rows = insights.map((r) => ({
          workspace_id: integration.workspace_id,
          integration_id: integration.id,
          ad_id: r.ad_id,
          campaign_id: r.campaign_id,
          adset_id: r.adset_id,
          day: r.date_start,
          currency: r.account_currency,
          spend: Number(r.spend),
          impressions: Number(r.impressions),
          clicks: Number(r.inline_link_clicks ?? 0),
          reach: Number(r.reach ?? 0),
          meta_purchases: Number(
            r.actions?.find((a) => a.action_type === "purchase")?.value ?? 0,
          ),
          meta_revenue: Number(
            r.action_values?.find((a) => a.action_type === "purchase")?.value ?? 0,
          ),
        }));

        await service.rpc("utm_commit_meta_sync", {
          p_integration: integration.id,
          p_since: since,
          p_until: until,
          p_entities: entities,
          p_insights: rows,
        });

        results.push({ id: integration.id, name: integration.name, status: "success" });
      } catch (err) {
        results.push({
          id: integration.id,
          name: integration.name,
          status: "error",
          error: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    }

    return NextResponse.json({ ok: true, synced: results.length, results });
  } catch {
    return NextResponse.json({ error: "Falha na rotina de cron." }, { status: 500 });
  }
}
