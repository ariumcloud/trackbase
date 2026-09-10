export type ExchangeRates = Record<string, number>;

export function normalizeCurrency(value: string | null | undefined): string {
  const currency = (value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "";
}

/**
 * Converts an amount using rates quoted from USD.
 * Returns null when the source or target rate is unavailable so callers never
 * label an unconverted amount with the target currency.
 */
export function convertCurrencyAmount(
  value: number | null | undefined,
  sourceCurrency: string | null | undefined,
  targetCurrency: string,
  rates: ExchangeRates | null | undefined,
): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  const source = normalizeCurrency(sourceCurrency);
  const target = normalizeCurrency(targetCurrency);
  if (!source || !target) return null;
  if (source === target) return amount;

  const sourceRate = source === "USD" ? 1 : rates?.[source];
  const targetRate = target === "USD" ? 1 : rates?.[target];
  if (!sourceRate || !targetRate) return null;
  return (amount / sourceRate) * targetRate;
}

export function formatCurrencyAmount(
  value: number | null | undefined,
  currency: string,
  locale?: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  const normalized = normalizeCurrency(currency) || "BRL";
  return new Intl.NumberFormat(
    locale || (normalized === "USD" ? "en-US" : "pt-BR"),
    { style: "currency", currency: normalized },
  ).format(Number(value));
}
