import { canUse } from "@/lib/plans";
import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/server";
import { metaInitiateCheckouts, metaLinkClicks } from "@/lib/meta-clicks";
import { credentials, pages, type RawInsight } from "@/lib/meta";
import { dayInZone } from "@/lib/metrics";
import { processCapiOutbox } from "@/lib/capi-outbox";
import { rateLimit } from "@/lib/security";

export const maxDuration = 300; // 5 minutos se hospedado no serverless

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    if (!(await rateLimit("cron:sync", 4))) {
      return NextResponse.json(
        { error: "Rotina já está em execução. Tente novamente em breve." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const service = admin();
    const capi = await processCapiOutbox(5).catch(() => {
      console.error("CAPI outbox processing failed");
      return { claimed: 0, sent: 0, skipped: 0, retried: 0, failed: 0 };
    });
    const { data: integrations, error } = await service
      .from("utm_integrations")
      .select("id,workspace_id,account_id,account_timezone,name,currency")
      .eq("provider", "meta")
      .eq("status", "connected")
      .not("account_id", "is", null);

    if (error || !integrations || integrations.length === 0) {
      return NextResponse.json({
        ok: true,
        synced: 0,
        capi,
        message: "Nenhuma integração Meta pendente de sincronização.",
      });
    }

    const results: Array<{
      id: string;
      name: string;
      status: string;
      error?: string;
    }> = [];

    for (const integration of integrations) {
      try {
        const { data: workspace, error: planError } = await service
          .from("utm_workspaces")
          .select("plan")
          .eq("id", integration.workspace_id)
          .single();
        if (planError) throw new Error("Falha ao consultar plano.");
        if (!workspace || !canUse(workspace.plan, "integrations")) {
          results.push({
            id: integration.id,
            name: integration.name,
            status: "skipped",
          });
          continue;
        }
        const { token } = await credentials(
          integration.workspace_id,
          integration.id,
        );
        const until = dayInZone(
          new Date(),
          integration.account_timezone || "UTC",
        );
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
            daily_budget?: string;
            lifetime_budget?: string;
            created_time?: string;
          }>(`${integration.account_id}/${edge}`, token, {
            fields: `id,name,status,created_time${kind === "adset" ? ",campaign_id,daily_budget,lifetime_budget" : kind === "campaign" ? ",daily_budget,lifetime_budget" : ",adset_id"}`,
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
              budget_minor: kind === "ad" ? null : Number(r.daily_budget ?? r.lifetime_budget ?? 0) || null,
              budget_currency: kind === "ad" ? null : integration.currency ?? null,
              budget_type: kind === "ad" ? null : r.daily_budget ? "daily" : r.lifetime_budget ? "lifetime" : null,
              meta_created_at: r.created_time ?? null,
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
          clicks: metaLinkClicks(r),
          reach: Number(r.reach ?? 0),
          meta_initiate_checkouts: metaInitiateCheckouts(r.actions),
          meta_purchases: Number(
            r.actions?.find((a) => a.action_type === "purchase")?.value ?? 0,
          ),
          meta_revenue: Number(
            r.action_values?.find((a) => a.action_type === "purchase")?.value ??
              0,
          ),
        }));

        const { error: syncError } = await service.rpc("utm_commit_meta_sync", {
          p_integration: integration.id,
          p_since: since,
          p_until: until,
          p_entities: entities,
          p_insights: rows,
        });

        if (syncError) throw new Error("Falha ao persistir sincronização.");
        results.push({
          id: integration.id,
          name: integration.name,
          status: "success",
        });
      } catch (err) {
        console.error("Meta cron sync failed", {
          integrationId: integration.id,
          error: err instanceof Error ? err.name : "UnknownError",
        });
        results.push({
          id: integration.id,
          name: integration.name,
          status: "error",
          error: "Falha temporária ao sincronizar esta integração.",
        });
      }
    }

    const synced = results.filter((result) => result.status === "success").length;
    const skipped = results.filter((result) => result.status === "skipped").length;
    const failed = results.filter((result) => result.status === "error").length;

    return NextResponse.json({
      ok: failed === 0,
      synced,
      skipped,
      failed,
      results,
      capi,
    });
  } catch {
    return NextResponse.json(
      { error: "Falha na rotina de cron." },
      { status: 500 },
    );
  }
}
