type MetaAction = { action_type: string; value: string | number };

/** Aliases overlap; select one, never sum them. */
export function metaPurchases(actions?: MetaAction[]): number {
  for (const kind of ["offsite_conversion.fb_pixel_purchase", "purchase", "omni_purchase"]) {
    const value = nonNegativeNumber(actions?.find((a) => a.action_type === kind)?.value);
    if (value !== null) return value;
  }
  return 0;
}

type MetaClickSource = {
  actions?: MetaAction[];
  inline_link_clicks?: string | number;
};

function nonNegativeNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Returns Meta Ads InitiateCheckout actions across the names used by the
 * Marketing API (standard, omni and pixel/offsite variants).
 */
export function metaInitiateCheckouts(actions?: MetaAction[]): number {
  const candidates = actions || [];
  // Meta can return the same conversion under web, standard and omni action
  // names in one response. Pick one canonical value instead of summing those
  // aliases and inflating the campaign total.
  const preferredTypes = [
    "offsite_conversion.fb_pixel_initiate_checkout",
    "initiate_checkout",
    "omni_initiated_checkout",
  ];
  for (const preferredType of preferredTypes) {
    const action = candidates.find(
      (item) => String(item.action_type || "").toLowerCase() === preferredType,
    );
    const value = nonNegativeNumber(action?.value);
    if (value !== null) return value;
  }

  const fallback = candidates.find((action) => {
    const actionType = String(action.action_type || "").toLowerCase();
    return actionType.includes("initiate_checkout") || actionType.includes("initiated_checkout");
  });
  return nonNegativeNumber(fallback?.value) ?? 0;
}

/**
 * Returns the Meta Ads "link_click" action, never the aggregate "clicks"
 * metric. Older API responses may omit actions, so inline_link_clicks is kept
 * only as a compatibility fallback.
 */
export function metaLinkClicks(source: MetaClickSource): number {
  const linkClick = source.actions?.find(
    (action) => action.action_type === "link_click",
  );
  const actionValue = nonNegativeNumber(linkClick?.value);
  if (actionValue !== null) return actionValue;

  return nonNegativeNumber(source.inline_link_clicks) ?? 0;
}
