import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/server";
import { rateLimit, body } from "@/lib/security";
import { trackPayloadSchema } from "@/lib/tracker";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!(await rateLimit(`track:${ip}`, 300))) {
      return NextResponse.json(
        { error: "Limite de requisições excedido." },
        { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } },
      );
    }

    let raw: unknown;
    try {
      raw = await body(request, 16384);
    } catch {
      return NextResponse.json(
        { error: "Payload inválido." },
        { status: 400, headers: corsHeaders },
      );
    }

    const parsed = trackPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados do evento inválidos.", details: parsed.error.issues },
        { status: 400, headers: corsHeaders },
      );
    }

    const { key, ...eventData } = parsed.data;

    const service = admin();
    const { data, error } = await service.rpc("utm_track_event", {
      p_key: key,
      p_event: eventData,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Não foi possível registrar o evento." },
        { status: 400, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { ok: true, status: data },
      { status: 200, headers: corsHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "Serviço temporariamente indisponível." },
      { status: 503, headers: corsHeaders },
    );
  }
}
