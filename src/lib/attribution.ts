const PLACEMENT_KEYS = [
  "utm_placement",
  "utm_position",
  "utm_ad_placement",
  "placement",
  "position",
  "ad_placement",
  "adplacement",
] as const;

const SESSION_KEYS = [
  "session_id",
  "sck",
  "utm_sck",
  "source_sck",
  "xcod",
  "src",
] as const;

const TRACKING_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_creative",
  "utm_placement",
  "utm_position",
  "utm_ad_placement",
  "src",
  "sck",
  "utm_sck",
  "source_sck",
  "xcod",
  "fbclid",
  "fbp",
  "fbc",
  "gclid",
  "ttclid",
]);

export type AttributionMap = Record<string, string>;

function normalizeKey(key: string): string {
  const normalized = key.toLowerCase();
  if (["placement", "position", "ad_placement", "adplacement"].includes(normalized)) {
    return "utm_placement";
  }
  return normalized;
}

function addValues(target: AttributionMap, input: Record<string, unknown> | null | undefined) {
  if (!input) return;
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = normalizeKey(rawKey);
    if (!TRACKING_KEYS.has(key)) continue;
    if (typeof rawValue !== "string" && typeof rawValue !== "number") continue;
    const value = String(rawValue).trim();
    if (value && !/^\{\{[^}]+\}\}$/.test(value)) target[key] = value.slice(0, 300);
  }
}

function urlAttribution(url: string | null | undefined): AttributionMap {
  if (!url) return {};
  try {
    const params = new URL(url, "https://trackbase.invalid").searchParams;
    const result: AttributionMap = {};
    for (const [key, value] of params.entries()) addValues(result, { [key]: value });
    return result;
  } catch {
    return {};
  }
}

export function mergeAttribution(
  ...inputs: Array<Record<string, unknown> | null | undefined>
): AttributionMap {
  const result: AttributionMap = {};
  for (const input of inputs) addValues(result, input);
  return result;
}

type TrackingEventLike = {
  offer_id?: string | null;
  session_id?: string | null;
  attribution?: Record<string, string> | null;
  url?: string | null;
};

/**
 * Rebuilds the attribution that was present in a visitor session. The tracker
 * sends UTMs on the first pageview and can omit them from later scroll/CTA
 * events, so the session must be merged before it is used for a payment join.
 */
export function sessionAttributionMap(
  events: TrackingEventLike[],
  offerId?: string | null,
): Map<string, AttributionMap> {
  const result = new Map<string, AttributionMap>();
  for (const event of events) {
    if (offerId && event.offer_id !== offerId) continue;
    const sessionId = String(event.session_id || "").trim();
    if (!sessionId) continue;
    const current = result.get(sessionId) || {};
    Object.assign(current, urlAttribution(event.url), mergeAttribution(event.attribution));
    // Keep the session reference available for direct SCK/XCOD joins.
    current.session_id = sessionId;
    result.set(sessionId, current);
  }
  return result;
}

/**
 * Resolves a payment to a tracked session only when the webhook carries a
 * deterministic session/click reference. An empty webhook must remain
 * unattributed; guessing the last checkout would assign sales to the wrong ad.
 */
export function resolveSaleAttribution(
  saleAttribution: Record<string, string> | null | undefined,
  events: TrackingEventLike[],
  offerId?: string | null,
): AttributionMap {
  const direct = mergeAttribution(saleAttribution);
  const sessions = sessionAttributionMap(events, offerId);
  const references = SESSION_KEYS.map((key) => direct[key]).filter(Boolean);
  const clickKeys = ["fbclid", "fbp", "fbc", "gclid", "ttclid"] as const;

  const candidates = [...sessions.entries()].filter(([sessionId, attr]) => {
    if (references.includes(sessionId)) return true;
    return clickKeys.some((key) => direct[key] && direct[key] === attr[key]);
  });

  if (candidates.length !== 1) return direct;
  return { ...candidates[0][1], ...direct };
}

function valueFrom(
  attribution: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string | null {
  if (!attribution) return null;
  for (const key of keys) {
    const value = attribution[key];
    if (typeof value !== "string" && typeof value !== "number") continue;
    const normalized = String(value).trim();
    if (normalized) return normalized.slice(0, 300);
  }
  return null;
}

/** Placement passed by Meta or preserved by the landing-page tracker. */
export function placementValue(
  attribution: Record<string, unknown> | null | undefined,
): string | null {
  const value = valueFrom(attribution, PLACEMENT_KEYS);
  return value && !/^\{\{[^}]+\}\}$/.test(value) ? value : null;
}

/** Identifiers used to join a payment webhook back to the tracked session. */
export function sessionReference(
  attribution: Record<string, unknown> | null | undefined,
): string | null {
  return valueFrom(attribution, SESSION_KEYS);
}
