import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/server";
import { body, encrypt } from "@/lib/security";
import { trackPayloadSchema } from "@/lib/tracker";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const ipMap = new Map<string, { count: number; resetAt: number }>();
const keyMap = new Map<string, { count: number; resetAt: number }>();

function checkInMemoryLimit(
  map: Map<string, { count: number; resetAt: number }>,
  k: string,
  limit: number,
  windowMs = 60000,
): boolean {
  const now = Date.now();
  const entry = map.get(k);
  if (!entry || now > entry.resetAt) {
    map.set(k, { count: 1, resetAt: now + windowMs });
    if (map.size > 2000) {
      for (const [id, val] of map.entries()) {
        if (now > val.resetAt) map.delete(id);
      }
    }
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-vercel-forwarded-for") ||
      request.headers.get("x-real-ip") || "unknown";

    if (!checkInMemoryLimit(ipMap, ip, 300)) {
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
        { error: "Dados do evento inválidos." },
        { status: 400, headers: corsHeaders },
      );
    }

    const { key, ...eventData } = parsed.data;
    if (!checkInMemoryLimit(keyMap, key, 600)) {
      return NextResponse.json(
        { error: "Limite de requisições excedido." },
        { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } },
      );
    }

    // Eventos de rolagem continuam agrupados em cta; cliques e visualizações preservam o tipo.
    let dbEventType: "pageview" | "cta" | "cta_click" | "cta_view" | "checkout" = "cta";
    const enrichedAttribution: Record<string, string> = { ...(eventData.attribution || {}) };

    if (eventData.event_type === "pageview") {
      dbEventType = "pageview";
    } else if (eventData.event_type === "checkout") {
      dbEventType = "checkout";
    } else if (eventData.event_type.startsWith("scroll_")) {
      const depth = eventData.event_type.replace("scroll_", "");
      enrichedAttribution.scroll_depth = depth;
      enrichedAttribution.action = eventData.event_type;
      dbEventType = "cta";
    } else if (eventData.event_type === "scroll") {
      if (eventData.scroll_depth) {
        enrichedAttribution.scroll_depth = String(eventData.scroll_depth);
      }
      enrichedAttribution.action = "scroll";
      dbEventType = "cta";
    } else if (eventData.event_type === "cta_view") {
      enrichedAttribution.cta_view = "true";
      enrichedAttribution.action = "cta_view";
      dbEventType = "cta_view";
    } else if (eventData.event_type === "cta_click") {
      enrichedAttribution.action = "cta_click";
      dbEventType = "cta_click";
    } else {
      dbEventType = "cta_view";
    }

    let capiPayloadCiphertext: string | undefined;
    if (
      (dbEventType === "pageview" || dbEventType === "checkout") &&
      eventData.event_id
    ) {
      try {
        capiPayloadCiphertext = encrypt(JSON.stringify({
          clientIp: ip !== "unknown" ? ip : null,
          clientUserAgent: request.headers.get("user-agent") || null,
          fbp: eventData.attribution?.fbp || null,
          fbc: eventData.attribution?.fbc || null,
        }));
      } catch {
        // O tracking público continua disponível mesmo se a CAPI não estiver configurada.
        console.warn("CAPI outbox payload could not be encrypted");
      }
    }

    const service = admin();
    let resolvedKey = key;
    if (key && (key.includes("-") || key.length >= 30)) {
      const { data: wsOffer } = await service
        .from("utm_offers")
        .select("public_key")
        .eq("workspace_id", key)
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (wsOffer?.public_key) {
        resolvedKey = wsOffer.public_key;
      }
    }

    const { data, error } = await service.rpc("utm_track_event", {
      p_key: resolvedKey,
      p_event: {
        ...eventData,
        event_type: dbEventType,
        attribution: enrichedAttribution,
        capi_payload_ciphertext: capiPayloadCiphertext,
      },
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
