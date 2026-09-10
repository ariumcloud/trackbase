import test from "node:test";
import assert from "node:assert/strict";
import { metaLinkClicks } from "../src/lib/meta-clicks";

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
