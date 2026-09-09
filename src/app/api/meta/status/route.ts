import { requireFeature } from "@/lib/feature-access";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, sameOrigin } from "@/lib/security";
import { credentials, graph, MetaError, metaPermissions } from "@/lib/meta";
import { admin } from "@/lib/supabase/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const v = z
      .object({
        workspace: z.string().uuid(),
        integration: z.string().uuid(),
        id: z.string().regex(/^\d+$/),
        kind: z.enum(["campaign", "adset", "ad"]),
        status: z.enum(["ACTIVE", "PAUSED"]),
      })
      .parse(await body(request));
    await requireFeature(v.workspace, "integrations");
    const { token, integration } = await credentials(
      v.workspace,
      v.integration,
    );
    const permissions = await metaPermissions(token);
    if (!permissions.adsManagement) {
      return NextResponse.json(
        {
          error: "A permissão para controlar status não foi concedida. Reconecte a Meta e aceite ads_management.",
          code: "permission_insufficient",
          reconnect: true,
        },
        { status: 403 },
      );
    }
    const entity = await graph<{ account_id: string }>(v.id, token, {
      fields: "account_id,effective_status",
    });
    if (`act_${entity.account_id}` !== integration.account_id)
      throw new Error();
    await graph(v.id, token, { status: v.status }, "POST");
    const service = admin();
    const { error } = await service
      .from("utm_ad_entities")
      .update({ status: v.status })
      .eq("workspace_id", v.workspace)
      .eq("integration_id", v.integration)
      .eq("external_id", v.id);
    if (error)
      return NextResponse.json(
        {
          error: "Status alterado na Meta. Sincronize para atualizar o painel.",
        },
        { status: 503 },
      );
    const { error: historyError } = await service.from("utm_meta_action_logs").insert({
      workspace_id: v.workspace,
      integration_id: v.integration,
      entity_id: v.id,
      entity_kind: v.kind,
      requested_status: v.status,
    });
    if (historyError) console.error("Meta action history failed", { code: historyError.code });
    return NextResponse.json({ ok: true, status: v.status });
  } catch (e) {
    const status = e instanceof MetaError && e.internalCode === "token_expired" ? 401 : 403;
    return NextResponse.json(
      {
        error:
          e instanceof MetaError
            ? e.message
            : "Não foi possível alterar o status.",
      },
      { status },
    );
  }
}
