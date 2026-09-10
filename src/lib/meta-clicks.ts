type MetaAction = { action_type: string; value: string | number };

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
