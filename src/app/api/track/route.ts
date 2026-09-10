import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/server";
import { body, encrypt } from "@/lib/security";
import { trackPayloadSchema, matchingCheckoutOffers, matchesCheckoutUrl, createCheckoutUrlMatcher } from "@/lib/tracker";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

type PublicOffer = { id: string; workspace_id: string; public_key: string; checkout_url: string | null; landing_url: string };
const offerFields = "id,workspace_id,public_key,checkout_url,landing_url";

// A public key stays bound to its offer. Only a workspace UUID can resolve across offers.
async function trackingContext(key: string) {
  const service = admin();
  const { data: link, error: linkError } = await service.from("utm_links")
    .select("offer_id,workspace_id").eq("public_key", key).eq("active", true).maybeSingle();
  if (linkError) throw new Error("TRACKING_CONFIG_UNAVAILABLE");
  if (link) {
    const { data, error } = await service.from("utm_offers").select(offerFields)
      .eq("id", link.offer_id).eq("workspace_id", link.workspace_id).eq("active", true).maybeSingle();
    if (error) throw new Error("TRACKING_CONFIG_UNAVAILABLE");
    return { offers: data ? [data as PublicOffer] : [], bound: true };
  }
  const { data: offer, error } = await service.from("utm_offers").select(offerFields)
    .eq("public_key", key).eq("active", true).maybeSingle();
  if (error) throw new Error("TRACKING_CONFIG_UNAVAILABLE");
  if (offer) return { offers: [offer as PublicOffer], bound: true };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return { offers: [], bound: false };
  // Read all pages: a truncated list must not turn ambiguous destinations into unique ones.
  const offers: PublicOffer[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error: listError } = await service.from("utm_offers").select(offerFields)
      .eq("workspace_id", key).eq("active", true).order("id").range(offset, offset + 499);
    if (listError) throw new Error("TRACKING_CONFIG_UNAVAILABLE");
    offers.push(...(data || []) as PublicOffer[]);
    if (!data || data.length < 500) break;
  }
  return { offers, bound: false };
}

export async function GET(request: Request) {
  const headers = { ...corsHeaders, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key") || "";
    if (key.length < 8 || key.length > 100) return NextResponse.json({ error: "Chave inválida." }, { status: 400, headers });
    if (!checkInMemoryLimit(keyMap, `config:${key}`, 600)) return NextResponse.json({ error: "Limite excedido." }, { status: 429, headers });
    const context = await trackingContext(key);
    if (!context.offers.length) return NextResponse.json({ error: "Chave inativa ou inválida." }, { status: 404, headers });
    // Only public checkout patterns, never offer keys, IDs, credentials or workspace details.
    const rules = context.offers.map(offer => offer.checkout_url).filter((value): value is string => Boolean(value));
    if (url.searchParams.get("format") !== "js") return NextResponse.json({ rules }, { headers });
    const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    const source = `window.__TRACKBASE_CHECKOUT_CONFIG__=window.__TRACKBASE_CHECKOUT_CONFIG__||{};window.__TRACKBASE_CHECKOUT_CONFIG__[${json(key)}]={rules:${json(rules)},matches:(${createCheckoutUrlMatcher.toString()})().matchesCheckoutUrl};`;
    return new Response(source, { headers: { ...headers, "Content-Type": "application/javascript; charset=utf-8" } });
  } catch {
    return NextResponse.json({ error: "Configuração temporariamente indisponível." }, { status: 503, headers });
  }
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
      dbEventType = "cta";
    }

    const service = admin();
    const context = await trackingContext(key);
    if (!context.offers.length) return NextResponse.json({ error: "Chave inativa ou inválida." }, { status: 404, headers: corsHeaders });
    const candidates = eventData.event_type === "checkout"
      ? matchingCheckoutOffers(eventData.url, context.offers)
      : context.bound || context.offers.length === 1
        ? context.offers
        : context.offers.filter(offer => matchesCheckoutUrl(eventData.url, offer.landing_url));
    if (candidates.length !== 1) {
      return NextResponse.json({
        error: candidates.length > 1 ? "Destino ambíguo entre ofertas." : "Destino não configurado para esta oferta.",
        code: candidates.length > 1 ? "AMBIGUOUS_OFFER" : "UNCONFIGURED_DESTINATION",
      }, { status: 422, headers: corsHeaders });
    }
    const resolvedKey = context.bound ? key : candidates[0].public_key;
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
