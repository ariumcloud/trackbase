import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/server";
import { body, decrypt, digest, encrypt, matches, rateLimit, rawBody } from "@/lib/security";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  paymentProviders,
  webhookEventIdentity,
  type PaymentProvider,
} from "@/lib/payment-contract";
import { paymentAdapters } from "@/lib/payment-adapters";
import { hotmartProductNamesMatch } from "@/lib/payment-product-matching";
import { notifySalePush } from "@/lib/push-notifications";
import { z } from "zod";
import { resolveSaleAttributionEvidence } from "@/lib/attribution";
import { resolveProductTarget } from "@/lib/gateway-offers";

function extractWebhookToken(
  provider: string,
  request: Request,
  payload: unknown,
): string {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<
    string,
    unknown
  >;
  const url = new URL(request.url);

  if (provider === "hotmart") {
    return (
      request.headers.get("x-hotmart-hottok") ||
      String(p.hottok || p.token || "")
    );
  }
  if (provider === "kiwify") {
    return (
      request.headers.get("x-kiwify-signature") ||
      String(p.signature || p.token || url.searchParams.get("token") || "")
    );
  }
  if (provider === "cakto") {
    return (
      request.headers.get("x-cakto-secret") || String(p.secret || p.token || "")
    );
  }
  if (provider === "kirvano") {
    return (
      request.headers.get("x-kirvano-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.secret || p.token || url.searchParams.get("token") || "")
    );
  }
  if (provider === "eduzz") {
    return (
      request.headers.get("x-eduzz-signature") ||
      request.headers.get("eduzz-token") ||
      String(p.api_key || p.secret || p.token || "")
    );
  }
  if (provider === "monetizze") {
    return (
      request.headers.get("x-monetizze-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.chave_unica || p.token || p.secret || url.searchParams.get("token") || "")
    );
  }
  if (provider === "lastlink") {
    return (
      request.headers.get("x-lastlink-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.token || p.Token || p.secret || url.searchParams.get("token") || "")
    );
  }
  if (provider === "hubla") {
    return (
      request.headers.get("x-hubla-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.token || p.secret || url.searchParams.get("token") || "")
    );
  }
  if (provider === "wiapy") {
    return (
      request.headers.get("x-wiapy-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.secret || p.token || url.searchParams.get("token") || "")
    );
  }
  if (provider === "perfectpay") {
    return (
      String(p.token || request.headers.get("x-perfectpay-token") || url.searchParams.get("token") || "")
    );
  }
  if (provider === "cartpanda") {
    return (
      request.headers.get("x-cartpanda-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.token || url.searchParams.get("token") || "")
    );
  }
  if (provider === "shopify") {
    return (
      request.headers.get("x-shopify-hmac-sha256") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.token || url.searchParams.get("token") || "")
    );
  }
  if (provider === "ticto") {
    return (
      String(
        p.token ||
        request.headers.get("x-ticto-token") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        url.searchParams.get("token") ||
        ""
      )
    );
  }
  if (provider === "lowfy") {
    return (
      request.headers.get("x-lowfy-token") ||
      request.headers.get("x-lowfy-signature") ||
      request.headers.get("x-lowfy-secret") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(
        p.token ||
        p.secret ||
        p.signature ||
        p.api_key ||
        url.searchParams.get("token") ||
        url.searchParams.get("secret") ||
        ""
      )
    );
  }
  if (provider === "greenn") {
    return (
      request.headers.get("x-greenn-token") ||
      request.headers.get("x-greenn-signature") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(
        p.token ||
        p.secret ||
        url.searchParams.get("token") ||
        url.searchParams.get("secret") ||
        ""
      )
    );
  }
  if (provider === "stripe") {
    return (
      request.headers.get("stripe-signature") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(
        p.token ||
        p.secret ||
        url.searchParams.get("token") ||
        url.searchParams.get("secret") ||
        ""
      )
    );
  }
  if (provider === "yampi") {
    return (
      request.headers.get("x-yampi-hmac-sha256") ||
      request.headers.get("x-yampi-token") ||
      request.headers.get("x-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(
        p.token ||
        p.secret ||
        p.signature ||
        url.searchParams.get("token") ||
        url.searchParams.get("secret") ||
        ""
      )
    );
  }
  return "";
}

function validCaktoSignature(
  request: Request,
  raw: string,
  secret: string,
): boolean {
  const timestamp = request.headers.get("x-cakto-timestamp")?.trim();
  const signature = request.headers.get("x-cakto-signature")?.trim();
  if (!timestamp || !signature || !/^\d{10,13}$/.test(timestamp)) return false;

  const timestampMs = Number(timestamp.length === 10 ? `${timestamp}000` : timestamp);
  if (!Number.isSafeInteger(timestampMs) || Math.abs(Date.now() - timestampMs) > 300_000) {
    return false;
  }

  const received = signature.replace(/^v1=/i, "");
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function validYampiSignature(
  request: Request,
  raw: string,
  secret: string,
): boolean {
  const signature = (
    request.headers.get("x-yampi-hmac-sha256") ||
    request.headers.get("x-yampi-signature") ||
    ""
  ).trim();
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function validShopifySignature(
  request: Request,
  raw: string,
  secret: string,
): boolean {
  const signature = (
    request.headers.get("x-shopify-hmac-sha256") ||
    ""
  ).trim();
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validStripeSignature(
  request: Request,
  raw: string,
  secret: string,
): boolean {
  const header = (request.headers.get("stripe-signature") || "").trim();
  if (!header) return false;

  let timestamp = "";
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const [k, v] = part.split("=").map((s) => s?.trim());
    if (k === "t") timestamp = v || "";
    if (k === "v1" && v) signatures.push(v);
  }

  if (!timestamp || signatures.length === 0 || !/^\d{10,13}$/.test(timestamp)) {
    return false;
  }

  const timestampMs = Number(timestamp.length === 10 ? `${timestamp}000` : timestamp);
  if (!Number.isSafeInteger(timestampMs) || Math.abs(Date.now() - timestampMs) > 300_000) {
    return false;
  }

  const payloadToSign = `${timestamp}.${raw}`;
  const expected = createHmac("sha256", secret).update(payloadToSign, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  for (const sig of signatures) {
    if (/^[a-f0-9]{64}$/i.test(sig)) {
      const sigBuf = Buffer.from(sig, "hex");
      if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
        return true;
      }
    }
  }

  return false;
}


function extractPayloadProductName(provider: string, payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (provider === "hotmart") {
    const data = (p.data && typeof p.data === "object" ? p.data : {}) as Record<string, unknown>;
    const product = (data.product && typeof data.product === "object" ? data.product : {}) as Record<string, unknown>;
    const name = String(product.name || data.product_name || p.prod_name || p.product_name || "").trim();
    return name || null;
  }
  if (provider === "kiwify") {
    const order = (p.Order && typeof p.Order === "object" ? p.Order : {}) as Record<string, unknown>;
    const prod1 = (p.Product && typeof p.Product === "object" ? p.Product : {}) as Record<string, unknown>;
    const prod2 = (order.Product && typeof order.Product === "object" ? order.Product : {}) as Record<string, unknown>;
    const name = String(prod1.product_name || prod2.product_name || p.product_name || "").trim();
    return name || null;
  }
  if (provider === "cakto") {
    const prod = (p.product && typeof p.product === "object" ? p.product : {}) as Record<string, unknown>;
    const name = String(prod.title || prod.name || p.product_name || "").trim();
    return name || null;
  }
  if (provider === "yampi") {
    const resource = (p.resource && typeof p.resource === "object" ? p.resource : p.data && typeof p.data === "object" ? p.data : p) as Record<string, unknown>;
    const items = Array.isArray(resource.items)
      ? resource.items
      : Array.isArray((resource.items as Record<string, unknown>)?.data)
        ? ((resource.items as Record<string, unknown>).data as unknown[])
        : [];
    const firstItem = (items[0] && typeof items[0] === "object" ? items[0] : {}) as Record<string, unknown>;
    const sku = (firstItem.sku && typeof firstItem.sku === "object" ? firstItem.sku : {}) as Record<string, unknown>;
    const skuData = (sku.data && typeof sku.data === "object" ? sku.data : sku) as Record<string, unknown>;
    const name = String(skuData.title || firstItem.title || firstItem.name || firstItem.item_sku || "").trim();
    return name || null;
  }
  if (provider === "wiapy") {
    const checkout = (p.checkout && typeof p.checkout === "object" ? p.checkout : {}) as Record<string, unknown>;
    const products = Array.isArray(p.products) ? (p.products as unknown[]) : [];
    const firstProd = (products[0] && typeof products[0] === "object" ? products[0] : {}) as Record<string, unknown>;
    const name = String(checkout.title || firstProd.title || firstProd.name || p.product_name || "").trim();
    return name || null;
  }
  if (provider === "kirvano") {
    const products = Array.isArray(p.products) ? (p.products as unknown[]) : [];
    const firstProd = (products[0] && typeof products[0] === "object" ? products[0] : {}) as Record<string, unknown>;
    const name = String(firstProd.name || firstProd.title || p.product_name || "").trim();
    return name || null;
  }
  if (provider === "perfectpay") {
    const prod = (p.product && typeof p.product === "object" ? p.product : {}) as Record<string, unknown>;
    const plan = (p.plan && typeof p.plan === "object" ? p.plan : {}) as Record<string, unknown>;
    const name = String(prod.name || prod.title || plan.name || plan.offer_name || p.product_name || "").trim();
    return name || null;
  }
  if (provider === "cartpanda") {
    const items = Array.isArray(p.line_items) ? (p.line_items as unknown[]) : [];
    const firstItem = (items[0] && typeof items[0] === "object" ? items[0] : {}) as Record<string, unknown>;
    const prod = (p.product && typeof p.product === "object" ? p.product : {}) as Record<string, unknown>;
    const name = String(firstItem.title || firstItem.name || prod.name || prod.title || p.product_name || "").trim();
    return name || null;
  }
  if (provider === "shopify") {
    const items = Array.isArray(p.line_items) ? (p.line_items as unknown[]) : [];
    const firstItem = (items[0] && typeof items[0] === "object" ? items[0] : {}) as Record<string, unknown>;
    const name = String(firstItem.title || firstItem.name || p.title || p.name || "").trim();
    return name || null;
  }
  if (provider === "ticto") {
    const item = (p.item && typeof p.item === "object" ? p.item : {}) as Record<string, unknown>;
    const items = Array.isArray(p.items) ? (p.items as unknown[]) : [];
    const firstItem = (items[0] && typeof items[0] === "object" ? items[0] : {}) as Record<string, unknown>;
    const name = String(item.product_name || item.offer_name || firstItem.product_name || firstItem.title || p.product_name || "").trim();
    return name || null;
  }
  if (provider === "monetizze") {
    const prod = (p.produto && typeof p.produto === "object" ? p.produto : p.product && typeof p.product === "object" ? p.product : {}) as Record<string, unknown>;
    const name = String(prod.nome || prod.name || prod.title || p.product_name || "").trim();
    return name || null;
  }
  if (provider === "greenn") {
    const prod = (p.product && typeof p.product === "object" ? p.product : {}) as Record<string, unknown>;
    const name = String(prod.name || prod.title || p.product_name || "").trim();
    return name || null;
  }
  if (provider === "lastlink") {
    const data = (p.Data && typeof p.Data === "object" ? p.Data : p.data && typeof p.data === "object" ? p.data : p) as Record<string, unknown>;
    const products = Array.isArray(data.Products) ? (data.Products as unknown[]) : [];
    const firstProd = (products[0] && typeof products[0] === "object" ? products[0] : {}) as Record<string, unknown>;
    const offer = (data.Offer && typeof data.Offer === "object" ? data.Offer : {}) as Record<string, unknown>;
    const name = String(firstProd.Name || firstProd.name || offer.Name || offer.name || p.product_name || "").trim();
    return name || null;
  }
  if (provider === "hubla") {
    const eventObj = (p.event && typeof p.event === "object" ? p.event : p.data && typeof p.data === "object" ? p.data : p) as Record<string, unknown>;
    const prod = (eventObj.product && typeof eventObj.product === "object" ? eventObj.product : {}) as Record<string, unknown>;
    const products = Array.isArray(eventObj.products) ? (eventObj.products as unknown[]) : [];
    const firstProd = (products[0] && typeof products[0] === "object" ? products[0] : {}) as Record<string, unknown>;
    const name = String(prod.name || prod.title || firstProd.name || firstProd.title || p.product_name || "").trim();
    return name || null;
  }
  const generic = (p.product && typeof p.product === "object" ? p.product : {}) as Record<string, unknown>;
  const name = String(generic.name || generic.title || p.product_name || "").trim();
  return name || null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string; integration: string }> },
) {
  const { provider, integration } = await params;

  if (
    !paymentProviders.includes(provider as PaymentProvider) ||
    !z.string().uuid().safeParse(integration).success
  ) {
    return NextResponse.json({ error: "Endpoint inválido." }, { status: 404 });
  }

  try {
    const service = admin();
    const { data: i } = await service
      .from("utm_integrations")
      .select(
        "id,workspace_id,offer_id,name,external_product_id,external_offer_id,currency",
      )
      .eq("id", integration)
      .eq("provider", provider)
      .single();

    if (!i) {
      return NextResponse.json(
        { error: "Integração inexistente." },
        { status: 404 },
      );
    }

    const { data: credentials } = await service
      .from("utm_credentials")
      .select("webhook_hash,webhook_secret_ciphertext")
      .eq("integration_id", integration)
      .single();

    let payload: unknown;
    let raw: string | undefined;
    try {
      if (provider === "cakto" || provider === "yampi" || provider === "shopify" || provider === "stripe") {
        raw = await rawBody(request);
        payload = JSON.parse(raw);
      } else {
        payload = await body(request);
      }
    } catch {
      return NextResponse.json(
        { error: "JSON inválido ou muito grande." },
        { status: 400 },
      );
    }

    const signedCaktoRequest =
      provider === "cakto" &&
      raw !== undefined &&
      credentials?.webhook_secret_ciphertext &&
      validCaktoSignature(
        request,
        raw,
        decrypt(credentials.webhook_secret_ciphertext),
      );
    const signedYampiRequest =
      provider === "yampi" &&
      raw !== undefined &&
      credentials?.webhook_secret_ciphertext &&
      validYampiSignature(
        request,
        raw,
        decrypt(credentials.webhook_secret_ciphertext),
      );
    const signedShopifyRequest =
      provider === "shopify" &&
      raw !== undefined &&
      credentials?.webhook_secret_ciphertext &&
      validShopifySignature(
        request,
        raw,
        decrypt(credentials.webhook_secret_ciphertext),
      );
    const signedStripeRequest =
      provider === "stripe" &&
      raw !== undefined &&
      credentials?.webhook_secret_ciphertext &&
      validStripeSignature(
        request,
        raw,
        decrypt(credentials.webhook_secret_ciphertext),
      );
    const token = extractWebhookToken(provider, request, payload);
    const legacyTokenMatches =
      !!credentials?.webhook_hash && matches(token, credentials.webhook_hash);
    const authenticated =
      (provider === "cakto" && credentials?.webhook_secret_ciphertext && signedCaktoRequest) ||
      (provider === "yampi" && credentials?.webhook_secret_ciphertext && signedYampiRequest) ||
      (provider === "shopify" && credentials?.webhook_secret_ciphertext && signedShopifyRequest) ||
      (provider === "stripe" && credentials?.webhook_secret_ciphertext && signedStripeRequest) ||
      legacyTokenMatches;
    if (!authenticated) {
      return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    }

    if (!(await rateLimit(`webhook:${integration}`, 300))) {
      return NextResponse.json(
        { error: "Limite de requisições." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const adapter = paymentAdapters[provider as PaymentProvider];
    if (!adapter) {
      return NextResponse.json(
        { error: "Provedor não implementado." },
        { status: 400 },
      );
    }

    let normalizedEvents;
    const receivedAt = new Date().toISOString();
    try {
      normalizedEvents = adapter.normalize(payload, {
        receivedAt,
        fallbackCurrency: i.currency,
      });
      if (!normalizedEvents || normalizedEvents.length === 0) {
        throw new Error("Nenhum evento normalizado produzido.");
      }
    } catch {
      const { error } = await service.from("utm_webhook_logs").upsert(
        {
          workspace_id: i.workspace_id,
          integration_id: integration,
          event_id: `invalid:${digest(JSON.stringify(payload))}`,
          status: "invalid",
          reason: "Evento, valor ou data não reconhecidos.",
        },
        { onConflict: "integration_id,event_id", ignoreDuplicates: true },
      );
      return NextResponse.json(
        { received: !error, status: "invalid" },
        { status: error ? 503 : 400 },
      );
    }

    const webhookProductName = extractPayloadProductName(provider, payload);
    // Starts as "ignored" so a batch where every event fails to resolve to a
    // known/discoverable product (the `continue` below) truthfully reports
    // nothing was recorded, instead of keeping a stale "processed" default
    // that made the sender — and this route's own caller — believe a sale
    // had been saved when it hadn't.
    let lastResultStatus = "ignored";
    for (const event of normalizedEvents) {
      // Hotmart sometimes sends the canonical numeric product ID while an
      // integration manually created from a checkout link was saved with a
      // different identifier. Rebind only when the product name is an exact
      // match and the configured offer still matches; never loosen this for
      // other providers or unrelated products. Only applies to a hub that
      // was itself configured for a specific product (legacy single-product
      // connections) — auto-discovered satellites never need this.
      const hubOfferMatches = !i.external_offer_id || event.offerId === i.external_offer_id;
      const canRepairHotmartProductId =
        provider === "hotmart" &&
        Boolean(i.offer_id) &&
        event.productId !== i.external_product_id &&
        hubOfferMatches &&
        hotmartProductNamesMatch(i.name, webhookProductName);

      if (canRepairHotmartProductId) {
        const { error: repairError } = await service
          .from("utm_integrations")
          .update({ external_product_id: event.productId })
          .eq("id", integration);
        if (repairError) {
          return NextResponse.json(
            { error: "Falha temporária ao corrigir o produto da integração." },
            { status: 503 },
          );
        }
        i.external_product_id = event.productId;
      }

      // Converte status do evento normalizado para persistência em utm_sales
      const isApproved = [
        "purchase_approved",
        "upsell_approved",
        "downsell_approved",
        "order_bump_approved",
        "subscription_created",
        "subscription_renewed",
      ].includes(event.type);

      const isRefunded = event.type === "purchase_refunded";
      const isChargeback = event.type === "chargeback_created";
      const isCanceled = [
        "purchase_canceled",
        "purchase_expired",
        "subscription_canceled",
      ].includes(event.type);

      const dbStatus = isApproved
        ? "approved"
        : isRefunded
          ? "refunded"
          : isChargeback
            ? "chargeback"
            : isCanceled
              ? "canceled"
              : "pending";

      const dbPayment = {
        event_id: webhookEventIdentity(event),
        transaction_id: event.externalTransactionId,
        product_id: event.productId,
        external_offer_id: event.offerId || "",
        product_type: event.productType,
        parent_transaction_id: event.parentTransactionId,
        status: dbStatus,
        amount: event.grossAmount ?? 0,
        gross_amount: event.grossAmount ?? 0,
        fee_amount: event.fees ?? 0,
        fee_currency: event.grossCurrency || i.currency,
        net_amount: event.netAmount ?? ((event.grossAmount ?? 0) - (event.fees ?? 0)),
        net_currency: event.netCurrency || event.grossCurrency || i.currency,
        currency: event.grossCurrency || i.currency,
        country: event.country,
        attribution: event.attribution,
        occurred_at: event.occurredAt,
        is_test: event.isTest,
        buyer_name: event.buyer?.name || null,
        buyer_email: event.buyer?.email || null,
      };

      const target = await resolveProductTarget(
        service,
        i,
        provider,
        event.productId,
        event.offerId || null,
        isApproved,
        webhookProductName,
        event.grossCurrency,
      );

      if (!target) {
        // An empty productId means the adapter couldn't find a product field
        // in this payload at all. Otherwise, this product has never been seen
        // approved before — Hotmart-style connectivity tests and pending/
        // canceled events for a still-unknown product intentionally never
        // create anything, so a burst of test pings can't fill the account
        // with fake offers.
        const reason = !event.productId
          ? "Produto não identificado no payload recebido."
          : `Produto ainda não confirmado por uma venda aprovada (recebido=${event.productId}).`;
        await service.from("utm_webhook_logs").upsert(
          {
            workspace_id: i.workspace_id,
            integration_id: i.id,
            event_id: `product_mismatch:${webhookEventIdentity(event)}`,
            status: "ignored",
            reason,
            payment: dbPayment,
            is_test: event.isTest,
          },
          { onConflict: "integration_id,event_id", ignoreDuplicates: true },
        );
        continue;
      }

      const { data: trackingEvents } = await service
        .from("utm_events")
        .select("id,workspace_id,offer_id,link_id,event_type,session_id,url,attribution,created_at")
        .eq("workspace_id", i.workspace_id)
        .or(`offer_id.eq.${target.offer_id},offer_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(5000);
      const evidence = resolveSaleAttributionEvidence(event.attribution, trackingEvents || [], target.offer_id, event.occurredAt);
      dbPayment.attribution = evidence.attribution;

      const { data, error } = await service.rpc("utm_process_payment", {
        p_integration: target.id,
        p_payment: dbPayment,
      });

      if (error) {
        return NextResponse.json(
          { error: "Falha temporária ao persistir." },
          { status: 503 },
        );
      }

      lastResultStatus = data;

      if (data === "processed" && !event.isTest) {
        const eventName = isApproved ? "Purchase" : isRefunded ? "Refund" : isChargeback ? "Chargeback" : null;

        if (eventName) {
          const eventId = `tx_${event.externalTransactionId}_${event.productType}`;
          const { error: outboxError } = await service.from("utm_capi_outbox").upsert({
            workspace_id: i.workspace_id,
            offer_id: target.offer_id,
            event_id: eventId,
            event_name: eventName,
            event_source_url: "",
            user_data_ciphertext: encrypt(JSON.stringify({
              email: event.buyer?.email || null,
              firstName: event.buyer?.name || null,
              fbp: evidence.attribution.fbp || null,
              fbc: evidence.attribution.fbc || null,
            })),
            value: eventName === "Purchase" ? event.grossAmount ?? null : null,
            currency: eventName === "Purchase" ? event.grossCurrency || i.currency || null : null,
            occurred_at: event.occurredAt,
            status: "pending",
            next_attempt_at: new Date().toISOString(),
          }, { onConflict: "workspace_id,offer_id,event_id,event_name", ignoreDuplicates: true });
          if (outboxError) throw new Error("CAPI_OUTBOX_WRITE_FAILED");
        }

        const { data: offer } = await service
          .from("utm_offers")
          .select("name")
          .eq("id", target.offer_id)
          .maybeSingle();

        if (
          webhookProductName &&
          offer?.name &&
          (offer.name === target.name || /^\d+$/.test(offer.name))
        ) {
          await service
            .from("utm_offers")
            .update({ name: webhookProductName })
            .eq("id", target.offer_id);

          await service
            .from("utm_integrations")
            .update({ name: `${provider.toUpperCase()} · ${webhookProductName}` })
            .eq("id", target.id);

          offer.name = webhookProductName;
        }

        if (isApproved) {
          const pushResult = await notifySalePush(i.workspace_id, {
            amount: event.grossAmount ?? 0,
            currency: event.grossCurrency || i.currency || "BRL",
            buyerName: event.buyer?.name || null,
            productName: offer?.name || null,
            provider: provider,
          });
          if (!pushResult.ok && pushResult.reason !== "no_subscribers") {
            console.error("Push de venda não entregue", {
              integration: target.id,
              eventId: webhookEventIdentity(event),
              reason: pushResult.reason,
            });
            await service
              .from("utm_webhook_logs")
              .update({ reason: "Notificação push não entregue." })
              .eq("integration_id", target.id)
              .eq("event_id", webhookEventIdentity(event));
          }
        }
      }
      if (data === "processed") {
        const { error: attributionError } = await service.from("utm_sales").update({
          attribution: evidence.attribution,
          attribution_source: evidence.source,
          attribution_confidence: evidence.confidence,
          attribution_reason: evidence.reason,
          attribution_session_id: evidence.attribution.session_id || null,
        }).eq("integration_id", target.id).eq("transaction_id", event.externalTransactionId).eq("product_type", event.productType).eq("is_test", event.isTest);
        if (attributionError) throw new Error("ATTRIBUTION_PERSISTENCE_FAILED");

        if (evidence.attribution.session_id && evidence.confidence === "high") {
          await service
            .from("utm_events")
            .update({ offer_id: target.offer_id })
            .eq("workspace_id", i.workspace_id)
            .eq("session_id", evidence.attribution.session_id)
            .is("offer_id", null);
        }
      }
    }

    return NextResponse.json(
      { received: true, status: lastResultStatus },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Serviço temporariamente indisponível." },
      { status: 503 },
    );
  }
}
