import { randomBytes } from "node:crypto";
import { z } from "zod";
import { body, digest, rateLimit, sameOrigin } from "@/lib/security";
import { admin, db } from "@/lib/supabase/server";
import { workspaceSchema } from "@/lib/mining/schema";
import { access, fail, result, MiningError } from "@/lib/mining/server";
import { canUse } from "@/lib/plans";

export async function GET() {
  try {
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new MiningError("Entre na sua conta.", 401);
    const { data: rawMemberships, error } = await client
      .from("utm_members")
      .select("workspace_id,role,utm_workspaces(id,name)")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"]);
    if (error) throw error;
    const workspaceIds = (rawMemberships || []).map((m) => m.workspace_id);
    const { data: plans, error: planError } = workspaceIds.length
      ? await client
          .from("utm_workspaces")
          .select("id,plan")
          .in("id", workspaceIds)
      : { data: [], error: null };
    if (planError) throw planError;
    const allowed = new Set(
      (plans || []).filter((w) => canUse(w.plan, "mining")).map((w) => w.id),
    );
    const memberships = (rawMemberships || []).filter((m) =>
      allowed.has(m.workspace_id),
    );
    const { data: grants, error: e } = await admin()
      .from("utm_extension_grants")
      .select("id,workspace_id,status,expires_at,created_at")
      .eq("user_id", user.id)
      .in(
        "workspace_id",
        (memberships || []).map((m) => m.workspace_id),
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (e) throw e;
    return result({ memberships, grants });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const p = z
      .object({
        workspace: workspaceSchema,
        challenge: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .parse(await body(request, 2048));
    const { user } = await access(request, p.workspace, true);
    if (!(await rateLimit(`mining:link:${user.id}`, 10)))
      throw new MiningError("Muitos vínculos. Tente em instantes.", 429);
    const { data, error } = await admin()
      .from("utm_extension_grants")
      .insert({
        workspace_id: p.workspace,
        user_id: user.id,
        challenge: p.challenge,
      })
      .select("id,expires_at")
      .single();
    if (error?.code === "23505")
      throw new MiningError(
        "Código já utilizado. Inicie um novo vínculo na extensão.",
        409,
      );
    if (error) throw error;
    return result(data, 201);
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const p = z
      .object({ workspace: workspaceSchema, id: workspaceSchema })
      .strict()
      .parse(await body(request, 2048));
    const { user } = await access(request, p.workspace, true);
    const { data, error } = await admin()
      .from("utm_extension_grants")
      .update({
        status: "revoked",
        token_hash: null,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", p.id)
      .eq("workspace_id", p.workspace)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new MiningError("Vínculo não encontrado.", 404);
    return result({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
// Possession of the verifier completes the approval initiated in the authenticated panel.
export async function PUT(request: Request) {
  try {
    const p = z
      .object({ verifier: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .parse(await body(request, 2048));
    const hash = digest(p.verifier);
    if (!(await rateLimit(`mining:redeem:${hash}`, 10)))
      throw new MiningError("Aguarde antes de tentar novamente.", 429);
    const token = randomBytes(32).toString("hex");
    const { data, error } = await admin().rpc("utm_extension_redeem", {
      p_challenge: hash,
      p_hash: digest(token),
    });
    if (error) throw error;
    if (!data)
      throw new MiningError(
        "Aprove o vínculo no Trackbase. O código pode ter expirado ou já ter sido utilizado.",
        401,
      );
    return result({ ...data, token });
  } catch (e) {
    return fail(e);
  }
}
