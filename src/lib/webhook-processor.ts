import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, digest, encrypt } from "@/lib/security";
import { webhookEventIdentity, type PaymentProvider } from "@/lib/payment-contract";
import { paymentAdapters } from "@/lib/payment-adapters";
import { hotmartProductNamesMatch } from "@/lib/payment-product-matching";
import { notifySalePush } from "@/lib/push-notifications";
import { resolveSaleAttributionEvidence } from "@/lib/attribution";
import { resolveProductTarget } from "@/lib/gateway-offers";

export type WebhookIntegration = {
  id: string;
  workspace_id: string;
  offer_id: string | null;
  name: string;
  external_product_id: string | null;
  external_offer_id: string | null;
  currency: string | null;
};

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
    // Order fields live under `data` (an object in V1, an array in V2).
    const d = (Array.isArray(p.data) ? p.data[0] : p.data) as Record<string, unknown> | undefined;
    const src = (d && typeof d === "object" ? d : p) as Record<string, unknown>;
    const prod = (src.product && typeof src.product === "object" ? src.product : {}) as Record<string, unknown>;
    const name = String(prod.title || prod.name || src.product_name || "").trim();
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

/**
 * Normalizes and persists an already-authenticated payment webhook. Shared by
 * the HTTP route and the inbox replay so a delivery that failed once is
 * processed exactly like a fresh one (every step below is replay-safe).
 */
export async function processPaymentWebhook(
  service: SupabaseClient,
  provider: string,
  integration: string,
  i: WebhookIntegration,
  payload: unknown,
): Promise<NextResponse> {
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
        fallbackCurrency: i.currency ?? undefined,
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
              firstName: event.buyer?.name?.trim().split(/s+/)[0] || null,
              lastName: event.buyer?.name?.trim().split(/s+/).slice(1).join(" ") || null,
              phone: event.buyer?.phone || null,
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
          // Offerless clicks never queue a CAPI PageView/InitiateCheckout
          // live (utm_track_event has no offer to attach a pixel config to
          // yet) -- now that this sale revealed the offer, queue those same
          // events retroactively for the rows being backfilled, using
          // whatever was captured on the click itself (fbp/fbc via
          // attribution; no client IP/UA, since those were never persisted
          // on utm_events). Best-effort: a failure here must not affect the
          // sale that was already recorded above.
          const { data: backfilled } = await service
            .from("utm_events")
            .update({ offer_id: target.offer_id })
            .eq("workspace_id", i.workspace_id)
            .eq("session_id", evidence.attribution.session_id)
            .is("offer_id", null)
            .select("event_id,event_type,url,attribution");

          const retroactiveCapiRows = (backfilled || []).filter(
            (row): row is typeof row & { event_id: string } =>
              Boolean(row.event_id) && (row.event_type === "pageview" || row.event_type === "checkout"),
          );
          if (retroactiveCapiRows.length) {
            try {
              const outboxRows = retroactiveCapiRows.map((row) => ({
                workspace_id: i.workspace_id,
                offer_id: target.offer_id,
                event_id: row.event_id,
                event_name: row.event_type === "pageview" ? "PageView" : "InitiateCheckout",
                event_source_url: row.url || "",
                user_data_ciphertext: encrypt(JSON.stringify({
                  fbp: (row.attribution as Record<string, string> | null)?.fbp || null,
                  fbc: (row.attribution as Record<string, string> | null)?.fbc || null,
                })),
              }));
              await service
                .from("utm_capi_outbox")
                .upsert(outboxRows, { onConflict: "workspace_id,offer_id,event_id,event_name", ignoreDuplicates: true });
            } catch {
              // Sale and its attribution are already persisted; losing the
              // retroactive pixel signal here is not worth failing the webhook.
            }
          }
        }
      }
    }

    return NextResponse.json(
      { received: true, status: lastResultStatus },
      { status: 200 },
    );
}

/** Parks an authenticated webhook whose processing failed, for the cron to replay. */
export async function enqueueWebhook(
  service: SupabaseClient,
  provider: string,
  i: WebhookIntegration,
  payload: unknown,
  cause: unknown,
): Promise<boolean> {
  try {
    const { error } = await service.from("utm_webhook_inbox").insert({
      workspace_id: i.workspace_id,
      integration_id: i.id,
      provider,
      payload_ciphertext: encrypt(JSON.stringify(payload)),
      last_error: cause instanceof Error ? cause.name : "PROCESSING_FAILED",
      next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

const INBOX_MAX_ATTEMPTS = 8;

/** Replays queued webhooks with exponential backoff (1m, 2m, 4m ... capped at 1h). */
export async function processWebhookInbox(service: SupabaseClient, limit = 10) {
  const summary = { claimed: 0, done: 0, retried: 0, failed: 0 };
  const { data: rows } = await service
    .from("utm_webhook_inbox")
    .select("id,integration_id,provider,payload_ciphertext,attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(limit);

  for (const row of rows ?? []) {
    // Optimistic claim so overlapping cron runs never replay the same row.
    const { data: claimed } = await service
      .from("utm_webhook_inbox")
      .update({ status: "processing", attempts: row.attempts + 1, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed?.length) continue;
    summary.claimed++;

    let ok = false;
    let reason = "PROCESSING_FAILED";
    try {
      const { data: integration } = await service
        .from("utm_integrations")
        .select("id,workspace_id,offer_id,name,external_product_id,external_offer_id,currency")
        .eq("id", row.integration_id)
        .eq("provider", row.provider)
        .maybeSingle();
      if (!integration) {
        ok = true; // integration was deleted; nothing left to process
      } else {
        const res = await processPaymentWebhook(
          service,
          row.provider,
          row.integration_id,
          integration as WebhookIntegration,
          JSON.parse(decrypt(row.payload_ciphertext)),
        );
        ok = res.status !== 503;
      }
    } catch (error) {
      reason = error instanceof Error ? error.name : reason;
    }

    const attempts = row.attempts + 1;
    const terminal = !ok && attempts >= INBOX_MAX_ATTEMPTS;
    await service
      .from("utm_webhook_inbox")
      .update({
        status: ok ? "done" : terminal ? "failed" : "pending",
        last_error: ok ? null : reason,
        next_attempt_at: new Date(Date.now() + Math.min(60 * 2 ** (attempts - 1), 3_600) * 1_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (ok) summary.done++;
    else if (terminal) summary.failed++;
    else summary.retried++;
  }
  return summary;
}
