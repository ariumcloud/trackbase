import { z } from "zod";

export const trackPayloadSchema = z.object({
  key: z.string().trim().min(8).max(100),
  event_type: z.enum([
    "pageview",
    "cta",
    "cta_click",
    "cta_view",
    "checkout",
    "scroll",
    "scroll_25",
    "scroll_50",
    "scroll_75",
    "scroll_90",
  ]),
  event_id: z.string().trim().max(100).optional(),
  session_id: z.string().trim().min(1).max(80),
  url: z.string().max(2048),
  scroll_depth: z.number().min(0).max(100).optional(),
  attribution: z
    .record(
      z.string().regex(/^[a-zA-Z0-9_]{1,50}$/),
      z.string().max(300),
    )
    .optional()
    .default({}),
});

export type TrackPayload = z.infer<typeof trackPayloadSchema>;

/**
 * The factory has no runtime dependencies so the public tracker can receive this
 * exact implementation as JavaScript, without maintaining a second matcher.
 */
export function createCheckoutUrlMatcher() {
  const matcher = {
    normalizeCheckoutUrl(value: string, base?: string): URL | null {
      if (typeof value !== "string") return null;
      const input = value.trim();
      if (!input || /^[?#]/.test(input) || /[\\\u0000-\u001f\u007f]/.test(input)) return null;

      try {
        let candidate = input;
        if (candidate.startsWith("//")) candidate = `https:${candidate}`;
        else if (/^[^/?#:@]+\.[^/?#:@]+:\d+(?:[/?#]|$)/.test(candidate)) candidate = `https://${candidate}`;
        else if (/^[a-z][a-z\d+.-]*:/i.test(candidate)) {
          if (!/^https?:\/\//i.test(candidate)) return null;
        } else if (/^(?:\/|\.\.?\/)/.test(candidate)) {
          if (!base) return null;
        } else candidate = `https://${candidate}`;

        const url = new URL(candidate, base);
        if (!/^https?:$/.test(url.protocol) || !url.hostname || url.username || url.password) return null;
        // Encoded separators can be interpreted differently by checkout servers.
        if (/%(?:2f|5c|00)/i.test(url.pathname)) return null;
        url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
        url.pathname = url.pathname.replace(/\/+$/, "") || "/";
        url.hash = "";
        return url;
      } catch {
        return null;
      }
    },

    matchesCheckoutUrl(target: string, pattern: string): boolean {
      const url = matcher.normalizeCheckoutUrl(target);
      const rule = matcher.normalizeCheckoutUrl(pattern);
      if (!url || !rule) return false;
      // An HTTPS checkout rule must never accept an HTTP downgrade. An HTTP rule
      // may accept its HTTPS upgrade, while host and explicit port stay exact.
      if (rule.protocol === "https:" && url.protocol !== "https:") return false;
      if (url.hostname !== rule.hostname || url.port !== rule.port) return false;
      if (rule.pathname !== "/" && url.pathname !== rule.pathname && !url.pathname.startsWith(`${rule.pathname}/`)) return false;

      // Keep business parameters configured on the offer (e.g. Hotmart's off).
      // Extra destination parameters are allowed; a configured parameter must have
      // exactly its configured values, preventing ambiguous duplicate values.
      for (const name of new Set(rule.searchParams.keys())) {
        // checkoutMode is Hotmart's own display-mode flag (single-step vs.
        // modal, etc.) copied along whenever a checkout link is shared from
        // their dashboard — it never identifies which offer was bought, and
        // the real checkout URL a visitor lands on frequently drops or
        // changes it. Treating it as a required business parameter rejected
        // real checkouts whenever it didn't happen to match verbatim.
        if (/^(?:utm_|trackbase_)/i.test(name) || /^(?:fbclid|fbc|fbp|_fbc|_fbp|gclid|dclid|gbraid|wbraid|ttclid|msclkid|sck|xcod|src|session_id|checkoutmode)$/i.test(name)) continue;
        const expected = rule.searchParams.getAll(name).sort();
        const received = url.searchParams.getAll(name).sort();
        if (expected.length !== received.length || expected.some((value, index) => value !== received[index])) return false;
      }
      return true;
    },

    matchingCheckoutOffers<T extends { checkout_url: string | null }>(target: string, offers: T[]): T[] {
      return offers.filter((offer) => Boolean(offer.checkout_url) && matcher.matchesCheckoutUrl(target, offer.checkout_url!));
    },
  };

  return matcher;
}

export const { normalizeCheckoutUrl, matchesCheckoutUrl, matchingCheckoutOffers } = createCheckoutUrlMatcher();

/**
 * Validação estrita de domínios autorizados para checkout.
 * Rejeita qualquer domínio falso, prefixos ou sufixos manipulados.
 */
export function isAllowedCheckout(targetUrl: string, currentOrigin?: string): boolean {
  if (!targetUrl || targetUrl.startsWith("#") || /^(mailto|tel|javascript):/i.test(targetUrl)) {
    return false;
  }
  try {
    const base = currentOrigin && /^https?:\/\//i.test(currentOrigin) ? currentOrigin : "https://localhost";
    const url = new URL(targetUrl, base);
    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    if (currentOrigin && url.origin === currentOrigin) {
      return true;
    }

    const host = url.hostname.toLowerCase();

    const allowedSuffixes = [
      "hotmart.com",
      "kiwify.com.br",
      "kiwify.com",
      "cakto.com",
      "cakto.com.br",
      "kirvano.com",
      "kirvano.com.br",
      "eduzz.com",
      "monetizze.com.br",
      "wiapy.com",
      "wiapy.com.br",
      "lowfy.com",
      "lowfy.com.br",
      "lowfy.app",
      "braip.com",
      "ticto.com.br",
      "ticto.app",
      "greenn.com.br",
      "perfectpay.com.br",
      "stripe.com",
    ];

    return allowedSuffixes.some((s) => host === s || host.endsWith("." + s));
  } catch {
    return false;
  }
}

/**
 * Injeta parâmetros de UTM e SCK apenas se o destino for checkout autorizado ou mesma origem.
 */
export function decorateLink(
  targetUrl: string,
  attribution: Record<string, string>,
  sessionId: string,
  currentOrigin?: string,
): string {
  if (!isAllowedCheckout(targetUrl, currentOrigin)) {
    return targetUrl;
  }

  try {
    const base = currentOrigin && /^https?:\/\//i.test(currentOrigin) ? currentOrigin : "https://localhost";
    const url = new URL(targetUrl, base);
    const host = url.hostname.toLowerCase();
    const isHotmart = host === "hotmart.com" || host.endsWith(".hotmart.com");

    const params: Array<[string, string | undefined]> = [
      ["utm_source", attribution.utm_source],
      ["utm_medium", attribution.utm_medium],
      ["utm_campaign", attribution.utm_campaign],
      ["utm_term", attribution.utm_term],
      ["utm_content", attribution.utm_content],
      ["utm_placement", attribution.utm_placement || attribution.placement],
      ["fbclid", attribution.fbclid],
    ];

    for (const [k, v] of params) {
      if (v && !url.searchParams.has(k)) {
        url.searchParams.set(k, v);
      }
    }

    // Parâmetro de rastreamento de sessão do checkout
    if (isHotmart && !url.searchParams.has("sck") && sessionId) {
      url.searchParams.set("sck", sessionId);
    }
    if (isHotmart && !url.searchParams.has("xcod") && sessionId) {
      url.searchParams.set("xcod", sessionId);
    }
    if (!url.searchParams.has("utm_sck") && sessionId) {
      url.searchParams.set("utm_sck", sessionId);
    }

    return url.toString();
  } catch {
    return targetUrl;
  }
}
