import test from "node:test";
import assert from "node:assert/strict";
import { sameOrigin } from "../src/lib/security";

test("proteção de origem aceita o domínio da própria implantação", () => {
  const previous = process.env.APP_URL;
  process.env.APP_URL = "https://app.trackbase.com";
  try {
    assert.doesNotThrow(() =>
      sameOrigin(
        new Request("https://preview.trackbase.com/api/meta/accounts", {
          headers: { origin: "https://preview.trackbase.com" },
        }),
      ),
    );
  } finally {
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
  }
});

test("proteção de origem rejeita um site externo", () => {
  assert.throws(() =>
    sameOrigin(
      new Request("https://app.trackbase.com/api/meta/accounts", {
        headers: { origin: "https://site-malicioso.com" },
      }),
    ),
  );
});
