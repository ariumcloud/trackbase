import { normalizePayment } from "./payments";
import {
  normalizedPaymentEventSchema,
  redactPaymentPayload,
  type PaymentAdapter,
  type PaymentEventType,
} from "./payment-contract";

function existingAdapter(provider: "hotmart" | "cakto"): PaymentAdapter {
  return {
    provider,
    normalize(payload, context) {
      const payment = normalizePayment(
        provider,
        payload,
        context.fallbackCurrency,
      );
      const states: Record<string, PaymentEventType> = {
        approved: "purchase_approved",
        pending: "payment_pending",
        refunded: "purchase_refunded",
        chargeback: "chargeback_created",
        canceled: "purchase_canceled",
        partial_refund: "purchase_refunded",
      };
      const additions = {
        upsell: "upsell_approved",
        downsell: "downsell_approved",
        order_bump: "order_bump_approved",
      } as const;
      const type =
        payment.status === "approved" && payment.product_type !== "main"
          ? additions[payment.product_type]
          : states[payment.status];
      return [
        normalizedPaymentEventSchema.parse({
          provider,
          externalTransactionId: payment.transaction_id,
          externalEventId: payment.event_id,
          type,
          productId: payment.product_id,
          offerId: payment.external_offer_id || null,
          productType: payment.product_type,
          parentProductId: null,
          parentTransactionId: payment.parent_transaction_id,
          grossAmount: payment.gross_amount,
          netAmount: payment.net_amount,
          fees: payment.fee_amount,
          grossCurrency: payment.currency,
          netCurrency: payment.currency,
          country: payment.country?.toUpperCase() || null,
          buyer: { name: payment.buyer_name, email: payment.buyer_email },
          attribution: payment.attribution,
          campaignId: payment.attribution.utm_campaign || null,
          adsetId: payment.attribution.utm_term || null,
          adId: payment.attribution.utm_content || null,
          creativeId: payment.attribution.utm_creative || null,
          clickId: payment.attribution.fbclid || null,
          occurredAt: payment.occurred_at,
          receivedAt: context.receivedAt,
          isTest: payment.is_test,
          rawPayload: redactPaymentPayload(payload),
        }),
      ];
    },
  };
}
export const hotmartAdapter = existingAdapter("hotmart");
export const caktoAdapter = existingAdapter("cakto");
export const paymentAdapters = { hotmart: hotmartAdapter, cakto: caktoAdapter };
