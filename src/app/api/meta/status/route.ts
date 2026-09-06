import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, body, sameOrigin } from "@/lib/security";
import { credentials, graph, MetaError } from "@/lib/meta";
import { admin } from "@/lib/supabase/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const v = z
      .object({
        workspace: z.string().uuid(),
        integration: z.string().uuid(),
        id: z.string().regex(/^\d+$/),
        status: z.enum(["ACTIVE", "PAUSED"]),
      })
      .parse(await body(request));
    await authorize(v.workspace, true);
    const { token, integration } = await credentials(
      v.workspace,
      v.integration,
    );
    const entity = await graph<{ account_id: string }>(v.id, token, {
      fields: "account_id",
    });
    if (`act_${entity.account_id}` !== integration.account_id)
      throw new Error();
    await graph(v.id, token, { status: v.status }, "POST");
    const { error } = await admin()
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
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof MetaError
            ? e.message
            : "Não foi possível alterar o status.",
      },
      { status: 403 },
    );
  }
}
