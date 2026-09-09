import { requireFeature } from "@/lib/feature-access";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, sameOrigin } from "@/lib/security";
import { credentials, listMetaAccounts, normalizeAdAccountId, MetaError } from "@/lib/meta";
import { admin } from "@/lib/supabase/server";

function selectionFailure(error: unknown) {
  if (error instanceof MetaError) {
    return {
      status: error.internalCode === "token_expired" ? 401 : 403,
      error: error.message,
      code: error.internalCode,
      stage: error.stage,
    };
  }
  if (error instanceof z.ZodError) {
    return {
      status: 422,
      error: "Dados da conta inválidos.",
      code: "invalid_request",
      stage: "account_selection",
    };
  }
  if (error instanceof Error) {
    if (error.message === "Entre na sua conta.") {
      return { status: 401, error: error.message, code: "unauthenticated", stage: "authorization" };
    }
    if (error.message === "Origem não autorizada." || error.message === "Workspace não autorizado.") {
      return { status: 403, error: error.message, code: "forbidden", stage: "authorization" };
    }
  }
  console.error("Meta account selection failed", {
    kind: error instanceof Error ? error.name : "unknown",
  });
  return {
    status: 500,
    error: "Não foi possível salvar a conta agora. Tente novamente.",
    code: "persistence_failed",
    stage: "account_selection",
  };
}

export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams,
      w = p.get("workspace") ?? "",
      id = p.get("integration") ?? "";
    await requireFeature(w, "integrations");
    const { token } = await credentials(w, id);
    return NextResponse.json(await listMetaAccounts(token));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof MetaError ? e.message : "Não foi possível listar as contas.", code: e instanceof MetaError ? e.internalCode : "api_unavailable", stage: e instanceof MetaError ? e.stage : "account_discovery" },
      { status: e instanceof MetaError && e.internalCode === "token_expired" ? 401 : 400 },
    );
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const v = z
      .object({
        workspace: z.string().uuid(),
        integration: z.string().uuid(),
        account: z.string().min(1).max(40),
      })
      .parse(await body(request));
    await requireFeature(v.workspace, "integrations");
    const { token } = await credentials(
      v.workspace,
      v.integration,
    );
    const selectedId = normalizeAdAccountId(v.account);
    if (!selectedId) return NextResponse.json({ error: "ID de conta Meta inválido.", code: "invalid_account", stage: "account_selection" }, { status: 422 });
    const discovery = await listMetaAccounts(token);
    const account = discovery.accounts.find((candidate) => candidate.id === selectedId);
    if (!account) return NextResponse.json({ error: "Essa conta não está acessível com o token conectado.", code: "account_not_found", stage: "account_selection" }, { status: 404 });
    const service = admin();
    const integrationUpdate = {
        account_id: selectedId,
        name: account.name,
        currency: account.currency,
        account_timezone: account.timezone_name,
        status: "connected",
      };
    const { data: existing } = await service
      .from("utm_integrations")
      .select("id")
      .eq("workspace_id", v.workspace)
      .eq("provider", "meta")
      .eq("account_id", selectedId)
      .maybeSingle();

    if (existing && existing.id !== v.integration) {
      const { data: sourceCredentials, error: sourceError } = await service
        .from("utm_credentials")
        .select("token_ciphertext,expires_at")
        .eq("workspace_id", v.workspace)
        .eq("integration_id", v.integration)
        .single();
      if (sourceError || !sourceCredentials) throw new Error();

      const { error: credentialError } = await service
        .from("utm_credentials")
        .upsert({
          workspace_id: v.workspace,
          integration_id: existing.id,
          ...sourceCredentials,
        }, { onConflict: "integration_id" });
      if (credentialError) throw credentialError;
      const { error: updateError } = await service
        .from("utm_integrations")
        .update(integrationUpdate)
        .eq("id", existing.id)
        .eq("workspace_id", v.workspace);
      if (updateError) throw updateError;
      const { error: credentialDeleteError } = await service
        .from("utm_credentials")
        .delete()
        .eq("integration_id", v.integration);
      if (credentialDeleteError) throw credentialDeleteError;
      const { error: temporaryDeleteError } = await service
        .from("utm_integrations")
        .delete()
        .eq("id", v.integration)
        .eq("workspace_id", v.workspace)
        .is("account_id", null);
      if (temporaryDeleteError) throw temporaryDeleteError;
      return NextResponse.json({ ok: true, reconnected: true });
    }

    const { data: updated, error } = await service
      .from("utm_integrations")
      .update(integrationUpdate)
      .eq("id", v.integration)
      .eq("workspace_id", v.workspace)
      .is("account_id", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) {
      return NextResponse.json(
        {
          error: "Essa integração já possui uma conta selecionada. Atualize o painel antes de escolher outra.",
          code: "account_already_selected",
          stage: "account_selection",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, account: { id: selectedId, name: account.name, currency: account.currency, timezone: account.timezone_name } });
  } catch (e) {
    const failure = selectionFailure(e);
    return NextResponse.json(
      { error: failure.error, code: failure.code, stage: failure.stage },
      { status: failure.status },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const query = new URL(request.url).searchParams;
    const workspace = z.string().uuid().parse(query.get("workspace"));
    const integration = z.string().uuid().parse(query.get("integration"));
    await requireFeature(workspace, "integrations");

    const service = admin();
    const { data: connection, error: lookupError } = await service
      .from("utm_integrations")
      .select("id")
      .eq("id", integration)
      .eq("workspace_id", workspace)
      .eq("provider", "meta")
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!connection) return NextResponse.json({ error: "Conexão Meta não encontrada." }, { status: 404 });

    // Delete every child first; none of these queries can cross the workspace
    // boundary because the integration was verified above.
    for (const table of ["utm_meta_action_logs", "utm_ad_entities", "utm_insights", "utm_webhook_logs", "utm_sales", "utm_credentials"] as const) {
      const { error } = await service.from(table).delete().eq("workspace_id", workspace).eq("integration_id", integration);
      if (error) throw error;
    }
    const { error: deleteError } = await service
      .from("utm_integrations")
      .delete()
      .eq("id", integration)
      .eq("workspace_id", workspace)
      .eq("provider", "meta");
    if (deleteError) throw deleteError;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error && (error.message === "Origem não autorizada." || error.message === "Workspace não autorizado.")
      ? error.message
      : "Não foi possível desconectar a conta Meta.";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
