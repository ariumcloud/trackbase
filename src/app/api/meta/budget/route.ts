import { requireFeature } from "@/lib/feature-access";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, sameOrigin } from "@/lib/security";
import { credentials, graph, MetaError, metaPermissions } from "@/lib/meta";
import { admin } from "@/lib/supabase/server";

const input = z.object({
  workspace: z.string().uuid(), integration: z.string().uuid(), id: z.string().regex(/^\d+$/),
  kind: z.enum(["campaign", "adset"]), amount: z.coerce.number().positive().max(10_000_000),
});

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const v = input.parse(await body(request));
    await requireFeature(v.workspace, "integrations");
    const { token, integration } = await credentials(v.workspace, v.integration);
    if (!(await metaPermissions(token)).adsManagement) {
      return NextResponse.json({ error: "Reconecte a Meta e aceite a permissão para gerenciar anúncios.", reconnect: true }, { status: 403 });
    }
    const entity = await graph<{ account_id: string; daily_budget?: string; lifetime_budget?: string }>(v.id, token, {
      fields: "account_id,daily_budget,lifetime_budget",
    });
    if (`act_${entity.account_id}` !== integration.account_id) throw new Error("Conta Meta inválida.");
    const field = entity.daily_budget ? "daily_budget" : entity.lifetime_budget ? "lifetime_budget" : "daily_budget";
    const currency = integration.currency || "USD";
    const zeroDecimal = new Set(["CLP", "COP", "JPY", "KRW", "VND"]).has(currency);
    const minor = Math.round(v.amount * (zeroDecimal ? 1 : 100));
    await graph(v.id, token, { [field]: String(minor) }, "POST");
    const { error } = await admin().from("utm_ad_entities").update({
      budget_minor: minor, budget_currency: currency, budget_type: field === "daily_budget" ? "daily" : "lifetime",
    }).eq("workspace_id", v.workspace).eq("integration_id", v.integration).eq("external_id", v.id);
    if (error) throw error;
    return NextResponse.json({ ok: true, amount: v.amount, currency, type: field === "daily_budget" ? "daily" : "lifetime" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof MetaError ? error.message : "Não foi possível alterar o orçamento." }, { status: error instanceof MetaError && error.internalCode === "token_expired" ? 401 : 403 });
  }
}
