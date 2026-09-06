import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, body, sameOrigin } from "@/lib/security";
import { credentials, pages, type Account, MetaError } from "@/lib/meta";
import { admin } from "@/lib/supabase/server";
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams,
      w = p.get("workspace") ?? "",
      id = p.get("integration") ?? "";
    await authorize(w, true);
    const { token } = await credentials(w, id);
    return NextResponse.json({
      accounts: await pages<Account>("me/adaccounts", token, {
        fields: "id,name,currency,timezone_name",
      }),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof MetaError
            ? e.message
            : "Não foi possível listar as contas.",
      },
      { status: 400 },
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
        account: z.string().regex(/^act_\d+$/),
      })
      .parse(await body(request));
    await authorize(v.workspace, true);
    const { token, integration } = await credentials(
      v.workspace,
      v.integration,
    );
    if (integration.account_id)
      return NextResponse.json(
        { error: "Conta já vinculada. Crie outra conexão para outra conta." },
        { status: 409 },
      );
    const accounts = await pages<Account>("me/adaccounts", token, {
        fields: "id,name,currency,timezone_name",
      }),
      account = accounts.find((a) => a.id === v.account);
    if (!account) throw new Error();
    const { error } = await admin()
      .from("utm_integrations")
      .update({
        account_id: account.id,
        name: account.name,
        currency: account.currency,
        account_timezone: account.timezone_name,
        status: "connected",
      })
      .eq("id", v.integration)
      .eq("workspace_id", v.workspace)
      .is("account_id", null);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Conta não autorizada." },
      { status: 403 },
    );
  }
}
