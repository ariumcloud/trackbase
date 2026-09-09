import { z } from "zod";
import { body } from "@/lib/security";
import { monitorSchema, workspaceSchema } from "@/lib/mining/schema";
import { access, fail, result, MiningError } from "@/lib/mining/server";
export async function GET(request: Request) {
  try {
    const workspace = workspaceSchema.parse(
      new URL(request.url).searchParams.get("workspace"),
    );
    const { client } = await access(request, workspace, false, true);
    const { data, error } = await client
      .from("utm_mining_monitors")
      .select("*")
      .eq("workspace_id", workspace)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return result({
      monitors: data,
      execution: "awaiting_capture",
      message:
        "Verificação automática indisponível. Atualize pela extensão com os anúncios visíveis.",
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const workspace = workspaceSchema.parse(
      new URL(request.url).searchParams.get("workspace"),
    );
    const { client } = await access(request, workspace, true);
    const p = monitorSchema.parse(await body(request));
    const { data, error } = await client
      .from("utm_mining_monitors")
      .upsert(
        { ...p, workspace_id: workspace, updated_at: new Date().toISOString() },
        {
          onConflict: p.offer_id
            ? "workspace_id,offer_id"
            : "workspace_id,page_id",
        },
      )
      .select()
      .single();
    if (error?.code === "23503")
      throw new MiningError("Oferta não encontrada neste workspace.", 404);
    if (error) throw error;
    return result({ monitor: data });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const workspace = workspaceSchema.parse(
      new URL(request.url).searchParams.get("workspace"),
    );
    const { client } = await access(request, workspace, true);
    const p = z
      .object({ id: workspaceSchema, status: z.enum(["active", "paused"]) })
      .strict()
      .parse(await body(request));
    const { data, error } = await client
      .from("utm_mining_monitors")
      .update({
        status: p.status,
        next_check_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspace)
      .eq("id", p.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new MiningError("Monitoramento não encontrado.", 404);
    return result({ monitor: data });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const workspace = workspaceSchema.parse(params.get("workspace")),
      id = workspaceSchema.parse(params.get("id"));
    const { client } = await access(request, workspace, true);
    const { error } = await client
      .from("utm_mining_monitors")
      .delete()
      .eq("workspace_id", workspace)
      .eq("id", id);
    if (error) throw error;
    return result({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
