import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorize, digest, sameOrigin } from "@/lib/security";
import { admin } from "@/lib/supabase/server";
import { workspaceSchema } from "./schema";
import { canUse } from "@/lib/plans";

export class MiningError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function grantValid(
  grant: { status: string; expires_at: string; workspace_id: string } | null,
  workspace: string,
  now = Date.now(),
) {
  return Boolean(
    grant &&
    grant.status === "active" &&
    Date.parse(grant.expires_at) > now &&
    grant.workspace_id === workspace,
  );
}
async function assertMiningPlan(client: SupabaseClient, workspace: string) {
  const { data, error } = await client
    .from("utm_workspaces")
    .select("plan")
    .eq("id", workspace)
    .single();
  if (error || !data)
    throw new MiningError(
      "Não foi possível verificar o plano do workspace.",
      503,
    );
  if (!canUse(data.plan, "mining"))
    throw new MiningError(
      "A Biblioteca de ofertas está disponível no Plano Básico ou superior.",
      403,
    );
}
// A delegated credential authorizes capture only; it never grants access to account settings or AI.
export async function access(
  request: Request,
  workspace: string,
  write = false,
  extension = false,
) {
  workspaceSchema.parse(workspace);
  const bearer = request.headers.get("authorization");
  if (bearer) {
    if (!extension || !/^Bearer [a-f0-9]{64}$/.test(bearer))
      throw new MiningError("Autorização da extensão inválida.", 401);
    const service = admin();
    const { data: grant, error } = await service
      .from("utm_extension_grants")
      .select("user_id,workspace_id,status,expires_at")
      .eq("token_hash", digest(bearer.slice(7)))
      .maybeSingle();
    if (error)
      throw new MiningError("Não foi possível validar a autorização.", 503);
    if (!grantValid(grant, workspace))
      throw new MiningError(
        "Autorização expirada, revogada ou de outro workspace.",
        401,
      );
    const { data: member, error: memberError } = await service
      .from("utm_members")
      .select("role")
      .eq("workspace_id", workspace)
      .eq("user_id", grant!.user_id)
      .maybeSingle();
    if (memberError || !member || !["owner", "admin"].includes(member.role))
      throw new MiningError("Workspace não autorizado.", 403);
    const {
      data: { user },
      error: userError,
    } = await service.auth.admin.getUserById(grant!.user_id);
    if (userError || !user || user.id !== grant!.user_id)
      throw new MiningError("Usuário não autorizado.", 401);
    const bannedUntil = (user as typeof user & { banned_until?: string })
      .banned_until;
    if (bannedUntil && Date.parse(bannedUntil) > Date.now())
      throw new MiningError("Usuário não autorizado.", 401);
    await assertMiningPlan(service, workspace);
    return { client: service, user, role: member.role };
  }
  if (write) sameOrigin(request);
  const context = await authorize(workspace, write);
  await assertMiningPlan(context.client, workspace);
  return context;
}
export function fail(error: unknown) {
  if (error instanceof MiningError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return NextResponse.json(
      { error: "Dados inválidos ou insuficientes. Confira os campos." },
      { status: 400 },
    );
  const message = error instanceof Error ? error.message : "";
  if (message === "Entre na sua conta.")
    return NextResponse.json({ error: message }, { status: 401 });
  if (["Workspace não autorizado.", "Origem não autorizada."].includes(message))
    return NextResponse.json({ error: message }, { status: 403 });
  if (message === "Payload excede o limite.")
    return NextResponse.json({ error: message }, { status: 413 });
  return NextResponse.json(
    {
      error:
        "Mineração indisponível. Verifique a configuração e tente novamente.",
    },
    { status: 503 },
  );
}
export function result(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function offerAccess(request: Request, id: string, write = false) {
  workspaceSchema.parse(id);
  const workspace = workspaceSchema.parse(
    new URL(request.url).searchParams.get("workspace"),
  );
  const auth = await access(request, workspace, write);
  const { data: offer, error } = await auth.client
    .from("utm_mined_offers")
    .select("*")
    .eq("workspace_id", workspace)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!offer) throw new MiningError("Oferta não encontrada.", 404);
  return { ...auth, workspace, offer };
}
