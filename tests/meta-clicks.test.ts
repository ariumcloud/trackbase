import test from "node:test";
import assert from "node:assert/strict";
import { metaInitiateCheckouts, metaLinkClicks } from "../src/lib/meta-clicks";

test("usa link_click da Meta e não o contador de cliques totais", () => {
  assert.equal(
    metaLinkClicks({
      actions: [
        { action_type: "link_click", value: "5" },
        { action_type: "post_engagement", value: "24" },
      ],
      inline_link_clicks: "24",
    }),
    5,
  );
});

test("mantém compatibilidade quando a API não envia actions", () => {
  assert.equal(metaLinkClicks({ inline_link_clicks: "7" }), 7);
  assert.equal(metaLinkClicks({ inline_link_clicks: "not-a-number" }), 0);
});

test("usa uma única variação canônica de InitiateCheckout sem duplicar aliases", () => {
  assert.equal(
    metaInitiateCheckouts([
      { action_type: "initiate_checkout", value: "2" },
      { action_type: "offsite_conversion.fb_pixel_initiate_checkout", value: "3" },
      { action_type: "omni_initiated_checkout", value: "1" },
      { action_type: "link_click", value: "99" },
    ]),
    3,
  );
});
