import { body } from "@/lib/security";
import { updateSchema } from "@/lib/mining/schema";
import { fail, result, offerAccess, MiningError } from "@/lib/mining/server";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { offer } = await offerAccess(request, (await context.params).id);
    return result({ offer });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const { client, workspace, offer } = await offerAccess(
      request,
      (await context.params).id,
      true,
    );
    const patch = updateSchema.parse(await body(request));
    const { data, error } = await client
      .from("utm_mined_offers")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspace)
      .eq("id", offer.id)
      .select()
      .single();
    if (error) throw error;
    return result({ offer: data });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const { client, workspace, offer } = await offerAccess(
      request,
      (await context.params).id,
      true,
    );
    if (request.headers.get("x-confirm-delete") !== offer.id)
      throw new MiningError("Confirme a exclusão da oferta.");
    const { error } = await client
      .from("utm_mined_offers")
      .delete()
      .eq("workspace_id", workspace)
      .eq("id", offer.id);
    if (error) throw error;
    return result({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
