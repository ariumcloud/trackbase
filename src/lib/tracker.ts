import { z } from "zod";

export const trackPayloadSchema = z.object({
  key: z.string().trim().min(8).max(100),
  event_type: z.enum(["pageview", "cta", "checkout"]),
  session_id: z.string().trim().min(1).max(80),
  url: z.string().max(2048),
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

    // Hotmart: exato hotmart.com ou subdomínio direto (.hotmart.com)
    const isHotmart = host === "hotmart.com" || host.endsWith(".hotmart.com");

    // Cakto: exato cakto.com, cakto.com.br ou subdomínios diretos (.cakto.com, .cakto.com.br)
    const isCakto =
      host === "cakto.com" ||
      host.endsWith(".cakto.com") ||
      host === "cakto.com.br" ||
      host.endsWith(".cakto.com.br");

    return isHotmart || isCakto;
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
    if (!url.searchParams.has("utm_sck") && sessionId) {
      url.searchParams.set("utm_sck", sessionId);
    }

    return url.toString();
  } catch {
    return targetUrl;
  }
}
