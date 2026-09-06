import { z } from "zod";
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
  status: z.enum(["approved", "refunded", "chargeback", "canceled", "pending"]),
  amount: z.number().nonnegative(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  occurred_at: z.string().datetime(),
  product_id: z.string().max(200),
  external_offer_id: z.string().max(200),
  country: z.string().max(2).nullable(),
  attribution: z.record(z.string(), z.string()),
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
    tracking = record(
      provider === "hotmart" ? purchase.tracking : data.tracking,
    );
  const event = str(root.event).toLowerCase();
  const states: Record<string, Payment["status"]> = {
    purchase_approved: "approved",
    purchase_complete: "approved",
    purchase_refunded: "refunded",
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
          (k.startsWith("utm_") || ["source_sck", "sck"].includes(k)) &&
          typeof v === "string",
      )
      .map(([k, v]) => [k, String(v).slice(0, 300)]),
  );
  const amount = number(provider === "hotmart" ? price.value : data.amount);
  if (amount === null) throw new Error("Valor de venda ausente.");
  return normalizedSchema.parse({
    event_id: str(root.id) || `${transaction}:${event}:${d.toISOString()}`,
    transaction_id: transaction,
    event,
    status: states[event],
    amount,
    currency:
      (
        str(
          provider === "hotmart"
            ? price.currency_value
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
    country: str(record(purchase.checkout_country).iso) || null,
    attribution,
    is_test:
      root.is_test === true || root.test === true || data.is_test === true,
  });
}
