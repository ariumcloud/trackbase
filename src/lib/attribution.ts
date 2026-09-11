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
const SCK_KEYS = ["sck", "utm_sck", "source_sck"] as const;

const TRACKING_KEYS = new Set([
  "session_id",
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
    // Hotmart/UTMFY can use a composite xcod containing campaign, ad set,
    // ad and placement names. Keep it intact so the webhook can join it to
    // the checkout URL instead of losing the only deterministic reference.
    const limit = key === "xcod" ? 2048 : 300;
    if (value && !/\{\{|\}\}|%7b%7b/i.test(value)) target[key] = value.slice(0, limit);
  }
}

function sameGatewayReference(
  direct: AttributionMap,
  candidate: AttributionMap,
): boolean {
  if (direct.xcod && direct.xcod === candidate.xcod) return true;
  return SCK_KEYS.some((directKey) =>
    SCK_KEYS.some(
      (candidateKey) =>
        direct[directKey] && direct[directKey] === candidate[candidateKey],
    ),
  );
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
  created_at?: string;
  occurred_at?: string;
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
  occurredAt?: string,
): AttributionMap {
  return resolveSaleAttributionEvidence(saleAttribution, events, offerId, occurredAt).attribution;
}

export function resolveSaleAttributionEvidence(
  saleAttribution: Record<string, string> | null | undefined,
  events: TrackingEventLike[],
  offerId?: string | null,
  occurredAt?: string,
): {
  attribution: AttributionMap;
  source: "session_id" | "click_id" | "gateway_tracking" | "none";
  confidence: "high" | "medium" | "none";
  reason: string;
} {
  const direct = mergeAttribution(saleAttribution);
  const eligible = events.filter((event) => !occurredAt || Boolean(event.occurred_at || event.created_at) && Date.parse(event.occurred_at || event.created_at!) <= Date.parse(occurredAt));
  const sessions = sessionAttributionMap(eligible, offerId);
  const references = SESSION_KEYS.map((key) => direct[key]).filter(Boolean);
  const clickKeys = ["fbclid", "fbc", "gclid", "ttclid"] as const;

  const candidates = [...sessions.entries()].filter(([sessionId, attr]) => {
    if (references.includes(sessionId)) return true;
    // Hotmart may return SCK/XCOD/SRC as gateway tracking values rather than
    // echoing Trackbase's session_id. Match the exact value stored on the
    // tracked event, but only accept it when it identifies one session.
    if (sameGatewayReference(direct, attr)) return true;
    return clickKeys.some((key) => direct[key] && direct[key] === attr[key]);
  });

  if (candidates.length !== 1) {
    const hasGatewayTracking = Boolean(direct.utm_content || direct.utm_campaign || direct.utm_term);
    return {
      attribution: hasGatewayTracking ? direct : {},
      source: hasGatewayTracking ? "gateway_tracking" : "none",
      confidence: hasGatewayTracking ? "medium" : "none",
      reason: candidates.length > 1 ? "multiple_session_matches" : "no_deterministic_match",
    };
  }
  // A reused session carrying different creatives is ambiguous, even with one session ID.
  for (const key of ["utm_content", "utm_term", "utm_campaign"]) {
    const values = new Set(eligible.filter((e) => e.session_id === candidates[0][0] && (!offerId || e.offer_id === offerId)).flatMap((e) => [mergeAttribution(urlAttribution(e.url), e.attribution)[key]]).filter(Boolean));
    if (values.size > 1 || (direct[key] && candidates[0][1][key] && direct[key] !== candidates[0][1][key])) return { attribution: {}, source: "none", confidence: "none", reason: "ambiguous_session_creative" };
  }
  const candidateSessionId = candidates[0][0];
  const candidateAttribution = candidates[0][1];
  const source = references.some((value) => value === candidateSessionId)
    ? "session_id"
    : clickKeys.some((key) => direct[key] && direct[key] === candidateAttribution[key])
      ? "click_id"
      : "gateway_tracking";
  return { attribution: { ...candidates[0][1], ...direct }, source, confidence: "high", reason: "unique_deterministic_match" };
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
