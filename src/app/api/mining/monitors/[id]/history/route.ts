import { z } from "zod";
import { body } from "@/lib/security";
import { admin } from "@/lib/supabase/server";
import { workspaceSchema } from "@/lib/mining/schema";
import { access, fail, result, MiningError } from "@/lib/mining/server";
type Context = { params: Promise<{ id: string }> };
async function monitor(request: Request, context: Context, write = false) {
  const workspace = workspaceSchema.parse(
    new URL(request.url).searchParams.get("workspace"),
  );
  const id = workspaceSchema.parse((await context.params).id);
  const auth = await access(request, workspace, write, write);
  const { data, error } = await auth.client
    .from("utm_mining_monitors")
    .select("*")
    .eq("workspace_id", workspace)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new MiningError("Monitoramento não encontrado.", 404);
  return { ...auth, workspace, id, data };
}
export async function GET(request: Request, context: Context) {
  try {
    const { client, workspace, id } = await monitor(request, context);
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(new URL(request.url).searchParams.get("page") || 0);
    const { data, error, count } = await client
      .from("utm_mining_runs")
      .select("*", { count: "exact" })
      .eq("workspace_id", workspace)
      .eq("monitor_id", id)
      .order("created_at", { ascending: false })
      .range(page * 30, page * 30 + 29);
    if (error) throw error;
    return result({ runs: data, count });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { workspace, id, data } = await monitor(request, context, true);
    if (data.status !== "active")
      throw new MiningError("Monitoramento pausado.", 409);
    const { reason } = z
      .object({
        reason: z.enum([
          "capture_failed",
          "insufficient_data",
          "api_unavailable",
        ]),
      })
      .strict()
      .parse(await body(request, 1024));
    const { error } = await admin().rpc("utm_mining_failure", {
      p_workspace: workspace,
      p_monitor: id,
      p_reason: reason,
    });
    if (error) throw error;
    return result({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
