import { z } from "zod";
export const paymentProviders = [
  "hotmart",
  "kiwify",
  "cakto",
  "kirvano",
  "eduzz",
  "monetizze",
  "wiapy",
] as const;
export type PaymentProvider = (typeof paymentProviders)[number];
export const paymentEventTypes = [
  "checkout_started",
  "payment_pending",
  "pix_created",
  "boleto_created",
  "purchase_approved",
  "subscription_created",
  "subscription_renewed",
  "subscription_canceled",
  "purchase_refunded",
  "chargeback_created",
  "purchase_canceled",
  "purchase_expired",
  "upsell_approved",
  "downsell_approved",
  "order_bump_approved",
] as const;
export type PaymentEventType = (typeof paymentEventTypes)[number];
const currency = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .nullable();
export const normalizedPaymentEventSchema = z.object({
  provider: z.enum(paymentProviders),
  externalTransactionId: z.string().min(1).max(200),
  externalEventId: z.string().max(300).nullable(),
  type: z.enum(paymentEventTypes),
  productId: z.string().max(200),
  offerId: z.string().max(200).nullable(),
  productType: z.enum([
    "main",
    "upsell",
    "downsell",
    "order_bump",
    "subscription",
    "complementary",
    "alternative",
  ]),
  parentProductId: z.string().nullable(),
  parentTransactionId: z.string().nullable(),
  grossAmount: z.number().finite().nonnegative().nullable(),
  netAmount: z.number().finite().nullable(),
  fees: z.number().finite().nonnegative().nullable(),
  grossCurrency: currency,
  netCurrency: currency,
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  buyer: z
    .object({ name: z.string().nullable(), email: z.string().nullable() })
    .nullable(),
  attribution: z.record(z.string(), z.string()),
  campaignId: z.string().nullable(),
  adsetId: z.string().nullable(),
  adId: z.string().nullable(),
  creativeId: z.string().nullable(),
  clickId: z.string().nullable(),
  occurredAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  isTest: z.boolean(),
  rawPayload: z.unknown(),
});
export type NormalizedPaymentEvent = z.infer<
  typeof normalizedPaymentEventSchema
>;
export interface PaymentAdapter {
  provider: PaymentProvider;
  normalize(
    payload: unknown,
    context: {
      receivedAt: string;
      fallbackCurrency?: string;
      timezone?: string;
    },
  ): NormalizedPaymentEvent[];
}
/** Retentativas com IDs diferentes não devem duplicar a mesma transição da transação.
 * Renovações exigem um ID de transação/cobrança próprio por parcela do provedor.
 */
export function paymentIdentity(
  event: Pick<
    NormalizedPaymentEvent,
    "provider" | "externalTransactionId" | "type" | "isTest"
  >,
): string {
  return JSON.stringify([
    event.provider,
    event.externalTransactionId,
    event.type,
    event.isTest,
  ]);
}
export function redactPaymentPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPaymentPayload);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /token|secret|password|authorization|signature|hottok|api[_-]?key/i.test(
          key,
        )
          ? "[redacted]"
          : redactPaymentPayload(item),
      ]),
    );
  return value;
}
