import { NextResponse } from "next/server";
import { authorize, body, sameOrigin } from "@/lib/security";
import { admin } from "@/lib/supabase/server";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { workspace, id } = z
      .object({ workspace: z.string().uuid(), id: z.string().uuid() })
      .parse(await body(request));
    await authorize(workspace, true);
    const service = admin();
    const { data: log } = await service
      .from("utm_webhook_logs")
      .select("integration_id,payment,status")
      .eq("workspace_id", workspace)
      .eq("id", id)
      .single();
    if (!log?.payment)
      return NextResponse.json(
        { error: "Sem evento normalizado para reprocessar." },
        { status: 422 },
      );
    const { data, error } = await service.rpc("utm_process_payment", {
      p_integration: log.integration_id,
      p_payment: log.payment,
    });
    return NextResponse.json(
      error ? { error: "Falha ao reprocessar." } : { status: data },
      { status: error ? 503 : 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Operação não autorizada." },
      { status: 403 },
    );
  }
}
