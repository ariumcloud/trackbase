import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, body, sameOrigin, rateLimit } from "@/lib/security";
import { credentials, pages, type RawInsight, MetaError } from "@/lib/meta";
import { dayInZone } from "@/lib/metrics";
import { admin } from "@/lib/supabase/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const v = z
      .object({ workspace: z.string().uuid(), integration: z.string().uuid() })
      .parse(await body(request));
    await authorize(v.workspace, true);
    if (!(await rateLimit(`sync:${v.integration}`, 2)))
      return NextResponse.json(
        { error: "Aguarde um minuto entre sincronizações." },
        { status: 429 },
      );
    const { token, integration } = await credentials(
      v.workspace,
      v.integration,
    );
    if (!integration.account_id) throw new Error();
    const until = dayInZone(new Date(), integration.account_timezone || "UTC");
    const start = new Date(`${until}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 29);
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
          workspace_id: v.workspace,
          integration_id: v.integration,
          external_id: r.id,
          name: r.name,
          status: r.status,
          kind,
          parent_id: r.adset_id ?? r.campaign_id ?? null,
        })),
      );
    }
    const service = admin();
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
    return NextResponse.json(
      {
        error:
          e instanceof MetaError
            ? e.message
            : "Falha na sincronização. A última carga completa permanece disponível.",
      },
      { status: 503 },
    );
  }
}
