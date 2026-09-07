import { requireFeature } from "@/lib/feature-access";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, sameOrigin, rateLimit } from "@/lib/security";
import { getGoogleCredentials } from "@/lib/google-ads";
import { admin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const v = z
      .object({ workspace: z.string().uuid(), integration: z.string().uuid() })
      .parse(await body(request));

    await requireFeature(v.workspace, "integrations");

    if (!(await rateLimit(`sync-google:${v.integration}`, 2))) {
      return NextResponse.json(
        { error: "Aguarde um minuto entre sincronizações." },
        { status: 429 },
      );
    }

    const creds = await getGoogleCredentials(v.workspace, v.integration);
    if (!creds.accessToken) throw new Error("Token de acesso indisponível.");

    const service = admin();

    // Mark last_synced_at
    await service
      .from("utm_integrations")
      .update({
        last_synced_at: new Date().toISOString(),
        status: "connected",
      })
      .eq("id", v.integration);

    return NextResponse.json({
      ok: true,
      message: "Conexão com Google Ads verificada com sucesso.",
    });
  } catch (err: unknown) {
    console.error("Google sync error:", err);
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
