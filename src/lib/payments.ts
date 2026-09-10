import { z } from "zod";
import { normalizeCountryCode } from "./country";

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const str = (v: unknown) =>
  typeof v === "string" || typeof v === "number" ? String(v) : "";

const number = (v: unknown) =>
  v === null || v === undefined || v === ""
    ? null
    : Number.isFinite(Number(v))
      ? Number(v)
      : null;

export const normalizedSchema = z.object({
  event_id: z.string().min(1).max(300),
  transaction_id: z.string().min(1).max(200),
  event: z.string().max(100),
  status: z.enum([
    "approved",
    "refunded",
    "chargeback",
    "canceled",
    "pending",
    "partial_refund",
  ]),
  amount: z.number().nonnegative(),
  gross_amount: z.number().nonnegative(),
  fee_amount: z.number().nonnegative(),
  net_amount: z.number(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  occurred_at: z.string().datetime(),
  product_id: z.string().max(200),
  external_offer_id: z.string().max(200),
  product_type: z.enum(["main", "order_bump", "upsell", "downsell"]),
  parent_transaction_id: z.string().max(200).nullable(),
  country: z.string().max(2).nullable(),
  attribution: z.record(z.string(), z.string()),
  buyer_email: z.string().max(200).nullable(),
  buyer_phone: z.string().max(50).nullable(),
  buyer_name: z.string().max(200).nullable(),
  is_test: z.boolean(),
});

export type Payment = z.infer<typeof normalizedSchema>;

export function normalizePayment(
  provider: "hotmart" | "cakto",
  payload: unknown,
  fallbackCurrency?: string | null,
): Payment {
  const root = record(payload),
    data = record(root.data),
    purchase = record(data.purchase),
    price = record(purchase.price),
    buyer = record(provider === "hotmart" ? data.buyer : data.customer),
    tracking = record(
      provider === "hotmart" ? purchase.tracking : data.tracking,
    );

  const event = str(root.event).toLowerCase();
  const states: Record<string, Payment["status"]> = {
    purchase_approved: "approved",
    purchase_complete: "approved",
    purchase_refunded: "refunded",
    purchase_partial_refund: "partial_refund",
    partial_refunded: "partial_refund",
    purchase_chargeback: "chargeback",
    purchase_canceled: "canceled",
    purchase_cancelled: "canceled",
    purchase_billet_printed: "pending",
    purchase_delayed: "pending",
    pix_generated: "pending",
  };

  if (!states[event]) throw new Error("Evento não suportado.");

  const transaction = str(
    provider === "hotmart" ? purchase.transaction : data.id,
  );

  const rawDate =
    provider === "hotmart"
      ? (root.creation_date ?? purchase.approved_date)
      : (data.updatedAt ?? data.paidAt ?? data.createdAt);

  const d =
    typeof rawDate === "number"
      ? new Date(rawDate < 1e12 ? rawDate * 1000 : rawDate)
      : new Date(str(rawDate));

  if (!Number.isFinite(d.getTime()))
    throw new Error("Data do evento ausente ou inválida.");

  const attribution = Object.fromEntries(
    Object.entries(tracking)
      .filter(
        ([k, v]) =>
          (k.startsWith("utm_") || ["source_sck", "sck", "fbp", "fbc"].includes(k)) &&
          typeof v === "string",
      )
      .map(([k, v]) => [k, String(v).slice(0, 300)]),
  );

  const grossAmount = number(
    provider === "hotmart" ? price.value : (data.amount ?? data.gross_amount),
  );
  if (grossAmount === null) throw new Error("Valor de venda ausente.");

  // Identificação de taxas
  const fee = number(
    provider === "hotmart"
      ? (record(purchase.fee).total_fee ?? record(purchase.fee).fixed_fee)
      : (data.fee ?? data.fees),
  ) ?? 0;

  const netAmount = Math.max(0, Math.round((grossAmount - fee) * 100) / 100);

  // Identificação de tipo de produto
  let productType: Payment["product_type"] = "main";
  const rawType = str(
    provider === "hotmart"
      ? (purchase.order_bump ? "order_bump" : purchase.type)
      : (data.type ?? (data.order_bump ? "order_bump" : "")),
  ).toLowerCase();

  if (rawType.includes("bump")) {
    productType = "order_bump";
  } else if (rawType.includes("upsell")) {
    productType = "upsell";
  } else if (rawType.includes("downsell")) {
    productType = "downsell";
  }

  const parentTransaction = str(
    provider === "hotmart"
      ? purchase.parent_purchase_transaction
      : (data.parent_id ?? data.parent_transaction_id),
  ) || null;

  return normalizedSchema.parse({
    event_id: str(root.id) || `${transaction}:${event}:${productType}:${d.toISOString()}`,
    transaction_id: transaction,
    event,
    status: states[event],
    amount: grossAmount,
    gross_amount: grossAmount,
    fee_amount: fee,
    net_amount: netAmount,
    currency:
      (
        str(
          provider === "hotmart"
            ? (price.currency_value ??
              price.currency_code ??
              price.currency_value_code ??
              price.currency_code_value)
            : (data.currency ?? data.currency_code),
        ) ||
        fallbackCurrency ||
        null
      )?.toUpperCase() ?? null,
    occurred_at: d.toISOString(),
    product_id: str(record(data.product).id),
    external_offer_id: str(
      provider === "hotmart"
        ? record(purchase.offer).code
        : record(data.offer).id,
    ),
    product_type: productType,
    parent_transaction_id: parentTransaction,
    country: normalizeCountryCode(
      purchase.checkout_country ||
        record(buyer).checkout_country ||
        data.country ||
        buyer.country,
    ),
    attribution,
    buyer_email: str(buyer.email) || null,
    buyer_phone: str(buyer.phone ?? buyer.checkout_phone) || null,
    buyer_name: str(buyer.name) || null,
    is_test:
      root.is_test === true || root.test === true || data.is_test === true,
  });
}
