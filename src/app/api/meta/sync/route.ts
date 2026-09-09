import { requireFeature } from "@/lib/feature-access";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, sameOrigin, rateLimit } from "@/lib/security";
import { credentials, pages, type RawInsight, MetaError } from "@/lib/meta";
import { dayInZone } from "@/lib/metrics";
import { admin } from "@/lib/supabase/server";
export async function POST(request: Request) {
  let synchronization: { workspace: string; integration: string } | null = null;
  try {
    sameOrigin(request);
    const v = z
      .object({ workspace: z.string().uuid(), integration: z.string().uuid() })
      .parse(await body(request));
    synchronization = { workspace: v.workspace, integration: v.integration };
    await requireFeature(v.workspace, "integrations");
    if (!(await rateLimit(`sync:${v.integration}`, 2)))
      return NextResponse.json(
        { error: "Aguarde um minuto entre sincronizações." },
        { status: 429 },
      );
    const { token, integration } = await credentials(
      v.workspace,
      v.integration,
    );
    if (!integration.account_id)
      return NextResponse.json({ error: "Conecte e selecione uma conta Meta antes de sincronizar.", code: "account_not_selected", stage: "account_selection" }, { status: 409 });
    const until = dayInZone(new Date(), integration.account_timezone || "UTC");
    const start = new Date(`${until}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 29);
    const since = start.toISOString().slice(0, 10);
    const service = admin();
    const { error: startingError } = await service
      .from("utm_integrations")
      .update({ status: "syncing" })
      .eq("id", v.integration)
      .eq("workspace_id", v.workspace)
      .eq("account_id", integration.account_id);
    if (startingError) throw startingError;
    const insights = await pages<RawInsight>(
      `${integration.account_id}/insights`,
      token,
      {
        fields:
          "ad_id,campaign_id,adset_id,date_start,account_currency,spend,impressions,inline_link_clicks,reach,actions,action_values",
        level: "ad",
        time_increment: "1",
        time_range: JSON.stringify({ since, until }),
      }, "insights",
    );
    const entities: Array<{ workspace_id: string; integration_id: string; external_id: string; name: string; status: string; kind: "campaign" | "adset" | "ad"; parent_id: string | null; budget_minor: number | null; budget_currency: string | null; budget_type: "daily" | "lifetime" | null }> = [];
    const entityEdges: Array<[string, "campaign" | "adset" | "ad"]> = [["campaigns", "campaign"], ["adsets", "adset"], ["ads", "ad"]];
    for (const [edge, kind] of entityEdges) {
      const rows = await pages<{
        id: string;
        name: string;
        status: string;
        campaign_id?: string;
        adset_id?: string;
        daily_budget?: string;
        lifetime_budget?: string;
        account_currency?: string;
      }>(`${integration.account_id}/${edge}`, token, {
        fields: `id,name,status${kind === "adset" ? ",campaign_id,daily_budget,lifetime_budget,account_currency" : kind === "campaign" ? ",daily_budget,lifetime_budget,account_currency" : ",adset_id"}`,
      });
      entities.push(
        ...rows.map((r) => ({
          workspace_id: v.workspace,
          integration_id: v.integration,
          external_id: r.id,
          name: r.name,
          status: r.status,
          kind,
          parent_id: kind === "ad" ? r.adset_id ?? null : kind === "adset" ? r.campaign_id ?? null : null,
          budget_minor: kind === "ad" ? null : Number(r.daily_budget ?? r.lifetime_budget ?? 0) || null,
          budget_currency: kind === "ad" ? null : r.account_currency ?? integration.currency ?? null,
          budget_type: kind === "ad" ? null : r.daily_budget ? "daily" as const : r.lifetime_budget ? "lifetime" as const : null,
        })),
      );
    }
    const rows = insights.map((r) => ({
      workspace_id: v.workspace,
      integration_id: v.integration,
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
    const { error } = await service.rpc("utm_commit_meta_sync", {
      p_integration: v.integration,
      p_since: since,
      p_until: until,
      p_entities: entities,
      p_insights: rows,
    });
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      ads: entities.length,
      days: rows.length,
    });
  } catch (e) {
    if (synchronization) {
      const status = e instanceof MetaError && e.internalCode === "token_expired"
        ? "token_expired"
        : e instanceof MetaError && e.internalCode === "permission_insufficient"
          ? "permission_insufficient"
          : "connected";
      await admin().from("utm_integrations").update({ status }).eq("id", synchronization.integration).eq("workspace_id", synchronization.workspace);
    }
    if (e instanceof MetaError) {
      console.error("Meta sync failed", { code: e.internalCode, stage: e.stage });
    }
    return NextResponse.json(
      {
        error: e instanceof MetaError ? e.message : "Falha ao salvar a sincronização. A última carga completa permanece disponível.",
        code: e instanceof MetaError ? e.internalCode : "persistence_failed",
        stage: e instanceof MetaError ? e.stage : "persistence",
      },
      { status: 503 },
    );
  }
}
