import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/server";
import { rateLimit, body } from "@/lib/security";
import { trackPayloadSchema } from "@/lib/tracker";
import { sendCapiEvent, type CapiEventName } from "@/lib/capi";

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

    // Disparo seguro de CAPI com o mesmo event_id gerado pelo navegador
    if (parsed.data.event_type === "pageview" || parsed.data.event_type === "checkout") {
      const eventName: CapiEventName =
        parsed.data.event_type === "pageview" ? "PageView" : "InitiateCheckout";
      const eventId =
        parsed.data.event_id ||
        `ev_${parsed.data.session_id}_${parsed.data.event_type}`;
      const userAgent = request.headers.get("user-agent") || null;
      const fbp = parsed.data.attribution?.fbp || null;
      const fbc = parsed.data.attribution?.fbc || null;

      (async () => {
        try {
          const { data: offerData } = await service
            .from("utm_offers")
            .select("workspace_id, id")
            .eq("public_key", key)
            .maybeSingle();

          if (offerData) {
            await sendCapiEvent({
              workspaceId: offerData.workspace_id,
              offerId: offerData.id,
              eventName,
              eventId,
              url: parsed.data.url,
              userData: {
                clientIp: ip !== "unknown" ? ip : null,
                clientUserAgent: userAgent,
                fbp,
                fbc,
              },
            });
            return;
          }

          const { data: linkData } = await service
            .from("utm_links")
            .select("workspace_id, offer_id")
            .eq("public_key", key)
            .maybeSingle();

          if (linkData) {
            await sendCapiEvent({
              workspaceId: linkData.workspace_id,
              offerId: linkData.offer_id,
              eventName,
              eventId,
              url: parsed.data.url,
              userData: {
                clientIp: ip !== "unknown" ? ip : null,
                clientUserAgent: userAgent,
                fbp,
                fbc,
              },
            });
          }
        } catch {}
      })();
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
