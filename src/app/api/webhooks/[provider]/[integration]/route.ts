import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/server";
import { body, decrypt, digest, matches, rateLimit, rawBody } from "@/lib/security";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sendCapiEvent } from "@/lib/capi";
import {
  paymentProviders,
  webhookEventIdentity,
  type PaymentProvider,
} from "@/lib/payment-contract";
import { paymentAdapters } from "@/lib/payment-adapters";
import { hotmartProductNamesMatch } from "@/lib/payment-product-matching";
import { notifySalePush } from "@/lib/push-notifications";
import { z } from "zod";

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
      String(p.secret || p.token || "")
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
      String(p.chave_unica || p.token || p.secret || "")
    );
  }
  if (provider === "wiapy") {
    return (
      request.headers.get("x-wiapy-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.secret || p.token || "")
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
  return "";
}

function validCaktoSignature(request: Request, raw: string, secret: string) {
  const timestamp = request.headers.get("x-cakto-timestamp");
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
      if (provider === "cakto") {
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
    const token = extractWebhookToken(provider, request, payload);
    const legacyTokenMatches =
      !!credentials?.webhook_hash && matches(token, credentials.webhook_hash);
    const authenticated =
      provider === "cakto" && credentials?.webhook_secret_ciphertext
        ? signedCaktoRequest
        : legacyTokenMatches;
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
    let configuredProductId = i.external_product_id;
    let lastResultStatus = "processed";
    for (const event of normalizedEvents) {
      // Hotmart sometimes sends the canonical numeric product ID while an
      // integration created from a checkout link was saved with a different
      // identifier. Rebind only when the product name is an exact match and
      // the configured offer still matches; never loosen this for other
      // providers or unrelated products.
      const productMatches = event.productId === configuredProductId;
      const offerMatches = !i.external_offer_id || event.offerId === i.external_offer_id;
      const canRepairHotmartProductId =
        provider === "hotmart" &&
        !productMatches &&
        offerMatches &&
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
        configuredProductId = event.productId;
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
        net_amount: event.netAmount ?? ((event.grossAmount ?? 0) - (event.fees ?? 0)),
        currency: event.grossCurrency || i.currency,
        country: event.country,
        attribution: event.attribution,
        occurred_at: event.occurredAt,
        is_test: event.isTest,
        buyer_name: event.buyer?.name || null,
        buyer_email: event.buyer?.email || null,
      };

      if (!productMatches && !canRepairHotmartProductId || !offerMatches) {
        await service.from("utm_webhook_logs").upsert(
          {
            workspace_id: i.workspace_id,
            integration_id: integration,
            event_id: `product_mismatch:${webhookEventIdentity(event)}`,
            status: "ignored",
            reason: `Produto/oferta não corresponde à integração (recebido=${event.productId}; esperado=${configuredProductId}).`,
            payment: dbPayment,
            is_test: event.isTest,
          },
          { onConflict: "integration_id,event_id", ignoreDuplicates: true },
        );
        continue;
      }

      const { data, error } = await service.rpc("utm_process_payment", {
        p_integration: integration,
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
        const eventName = isApproved ? "Purchase" : isRefunded ? "Refund" : null;

        if (eventName) {
          await sendCapiEvent({
            workspaceId: i.workspace_id,
            offerId: i.offer_id,
            eventName,
            eventId: `tx_${event.externalTransactionId}_${event.productType}`,
            customData: {
              value: event.grossAmount ?? 0,
              currency: event.grossCurrency || i.currency,
            },
            userData: {
              email: event.buyer?.email || null,
              firstName: event.buyer?.name || null,
              fbp: event.attribution?.fbp || null,
              fbc: event.attribution?.fbc || null,
            },
          }).catch(() => {});
        }

        const { data: offer } = await service
          .from("utm_offers")
          .select("name")
          .eq("id", i.offer_id)
          .maybeSingle();

        if (
          webhookProductName &&
          offer?.name &&
          (offer.name === i.external_product_id || /^\d+$/.test(offer.name))
        ) {
          await service
            .from("utm_offers")
            .update({ name: webhookProductName })
            .eq("id", i.offer_id);

          await service
            .from("utm_integrations")
            .update({ name: `${provider.toUpperCase()} · ${webhookProductName}` })
            .eq("id", integration);

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
              integration,
              eventId: webhookEventIdentity(event),
              reason: pushResult.reason,
            });
            await service
              .from("utm_webhook_logs")
              .update({ reason: "Notificação push não entregue." })
              .eq("integration_id", integration)
              .eq("event_id", webhookEventIdentity(event));
          }
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
