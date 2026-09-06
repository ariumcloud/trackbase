import "server-only";
import { authorize } from "./security";
import { assertFeature, type PlanFeature } from "./plans";
/** O plano vem do banco sob RLS, nunca de parâmetros do navegador. */
export async function requireFeature(
  workspace: string,
  feature: PlanFeature,
  write = true,
) {
  const context = await authorize(workspace, write);
  const { data, error } = await context.client
    .from("utm_workspaces")
    .select("plan")
    .eq("id", workspace)
    .single();
  if (error || !data) throw new Error("Não foi possível verificar seu plano.");
  assertFeature(data.plan, feature);
  return context;
}
