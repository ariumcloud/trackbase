import test from "node:test";
import assert from "node:assert/strict";
import { campaignCheckouts } from "../src/lib/campaign-checkouts";

const event = (id: string, session: string, target: string, offer = "offer") => ({
  id, workspace_id: "workspace", offer_id: offer, session_id: session,
  event_type: "checkout", attribution: { utm_campaign: target },
});
test("own checkouts count without Meta and deduplicate sessions within each offer", () => {
  const result = campaignCheckouts([event("1", "s", "c"), event("2", "s", "c"), event("3", "s", "c", "other")], "campaign", new Set(["c"]));
  assert.equal(result.counts.get("c"), 2);
  assert.equal(result.total, 2);
});
test("missing, unknown and conflicting targets remain unattributed", () => {
  const result = campaignCheckouts([event("1", "a", "c"), event("2", "a", "d"), event("3", "b", ""), event("4", "c", "unknown")], "campaign", new Set(["c", "d"]));
  assert.equal(result.unattributed, 3);
  assert.equal(result.counts.size, 0);
});
test("offer filters and non-checkout events do not inflate totals", () => {
  const result = campaignCheckouts([event("1", "a", "c", "other"), { ...event("2", "b", "c"), event_type: "cta_view" }, event("3", "c", "c")], "campaign", new Set(["c"]), "offer");
  assert.equal(result.total, 1);
});
