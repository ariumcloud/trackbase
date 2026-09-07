import { NextResponse } from "next/server";
import { z } from "zod";
import { body, rateLimit, sameOrigin } from "@/lib/security";
import { admin, db } from "@/lib/supabase/server";

const confirmation = "EXCLUIR MINHA CONTA";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    z
      .object({ confirmation: z.literal(confirmation) })
      .strict()
      .parse(await body(request, 1_024));
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    }
    if (!(await rateLimit(`account-delete:${user.id}`, 2))) {
      return NextResponse.json(
        { error: "Aguarde antes de tentar novamente." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const service = admin();
    const { error: dataError } = await service.rpc("utm_delete_account_data", {
      p_user: user.id,
    });
    if (dataError) throw dataError;

    await client.auth.signOut({ scope: "global" });
    const { error: authError } = await service.auth.admin.deleteUser(user.id);
    if (authError) throw authError;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível excluir a conta. Tente novamente mais tarde." },
      { status: 503 },
    );
  }
}
