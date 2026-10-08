/**
 * Checkout detection for links that are not bound to an offer (the "Utmify
 * model": the offer is discovered by the first sale, so there is no
 * `checkout_url` to compare against beforehand).
 *
 * A fragment is a plain, lowercase piece of a destination URL such as
 * "pay.cakto.com.br". A click on a link whose destination contains one of the
 * fragments is reported as InitiateCheckout by the tracker.
 */

// Well-known checkout hosts. Used when the workspace has not defined its own
// InitiateCheckout URL in the pixel settings.
export const DEFAULT_CHECKOUT_FRAGMENTS = [
  "pay.cakto.com.br",
  "pay.hotmart.com",
  "pay.kiwify.com.br",
  "pay.kirvano.com",
  "sun.eduzz.com",
  "checkout.perfectpay.com.br",
  "pay.lastlink.com",
  "pay.hub.la",
] as const;

/** "https://www.Pay.Cakto.com.br/abc?x=1" -> "pay.cakto.com.br/abc"; null when unusable. */
export function normalizeCheckoutFragment(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let value = input.trim().toLowerCase();
  if (!value || /\s/.test(value)) return null;
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "");
  value = value.split(/[?#]/)[0].replace(/\/+$/, "");
  // Too short a fragment would match almost every link on the page.
  if (value.length < 4 || value.length > 200) return null;
  if (!/^[a-z0-9._~\-/%]+$/.test(value)) return null;
  return value;
}

/** Accepts "a.com, b.com" / "a.com b.com" and returns the unique usable fragments. */
export function parseCheckoutFragments(input: unknown): string[] {
  if (typeof input !== "string") return [];
  const unique = new Set<string>();
  for (const part of input.split(/[\s,;]+/)) {
    const fragment = normalizeCheckoutFragment(part);
    if (fragment) unique.add(fragment);
  }
  return [...unique];
}

type RuleRow = { trigger_config: unknown };

/** Fragments for the tracker config: the workspace's own rules, or the gateway defaults. */
export function resolveCheckoutFragments(pixelRules: RuleRow[]): string[] {
  const custom = new Set<string>();
  for (const rule of pixelRules) {
    const config = (rule.trigger_config && typeof rule.trigger_config === "object" ? rule.trigger_config : {}) as Record<string, unknown>;
    const fragment = normalizeCheckoutFragment(config.pattern);
    if (fragment) custom.add(fragment);
  }
  if (custom.size) return [...custom];
  return [...DEFAULT_CHECKOUT_FRAGMENTS];
}

/** Checkout link carried by a gateway payload, without query string or hash. */
export function checkoutUrlFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const first = Array.isArray(root.data) ? root.data[0] : root.data;
  const data = (first && typeof first === "object" ? first : {}) as Record<string, unknown>;
  const raw = [data.checkoutUrl, data.checkout_url, root.checkoutUrl, root.checkout_url].find(
    (value) => typeof value === "string" && value.trim(),
  );
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}` || null;
  } catch {
    return null;
  }
}
