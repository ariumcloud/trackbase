import { requireFeature } from "@/lib/feature-access";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, sameOrigin, rateLimit } from "@/lib/security";
import { getGoogleCredentials, listGoogleAccessibleCustomers } from "@/lib/google-ads";

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
    if (!creds.accessToken || !creds.developerToken) {
      throw new Error("Google Ads não está configurado para sincronização.");
    }

    const customers = await listGoogleAccessibleCustomers(
      creds.accessToken,
      creds.developerToken,
    );

    return NextResponse.json({
      ok: true,
      status: "verified",
      accessibleCustomers: customers.length,
      message:
        "Credenciais Google Ads verificadas. A importação de insights ainda não está configurada.",
    });
  } catch (err: unknown) {
    console.error("Google sync verification failed", {
      error: err instanceof Error ? err.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Não foi possível verificar a conexão Google Ads." },
      { status: 503 },
    );
  }
}
