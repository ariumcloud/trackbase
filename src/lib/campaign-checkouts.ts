type CheckoutEvent = {
  id: string;
  workspace_id: string;
  offer_id: string | null;
  event_type: string;
  session_id: string | null;
  attribution: Record<string, string> | null;
};

/** One checkout session per offer. Conflicting targets stay unattributed. */
export function campaignCheckouts(
  events: CheckoutEvent[],
  kind: "campaign" | "adset" | "ad",
  knownIds: Set<string>,
  selectedOffer = "all",
) {
  const sessions = new Map<string, Set<string>>();
  const field = kind === "campaign" ? "utm_campaign" : kind === "adset" ? "utm_term" : "utm_content";
  for (const event of events) {
    if (event.event_type !== "checkout" || (selectedOffer !== "all" && event.offer_id !== selectedOffer)) continue;
    const key = JSON.stringify([event.workspace_id, event.offer_id, event.session_id || event.id]);
    const targets = sessions.get(key) || new Set<string>();
    const target = event.attribution?.[field]?.trim();
    if (target) targets.add(target);
    sessions.set(key, targets);
  }
  const counts = new Map<string, number>();
  let unattributed = 0;
  for (const targets of sessions.values()) {
    const target = [...targets][0];
    if (targets.size !== 1 || !knownIds.has(target) || /\{\{|%7b%7b/i.test(target)) {
      unattributed++;
      continue;
    }
    counts.set(target, (counts.get(target) || 0) + 1);
  }
  return { counts, unattributed, total: sessions.size };
}
