import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { GET, POST } from "../src/app/api/track/route";
import { matchesCheckoutUrl } from "../src/lib/tracker";

type Offer = {
  id: string;
  workspace_id: string;
  public_key: string;
  checkout_url: string | null;
  landing_url: string;
};
type TrackingWrite = {
  p_key: string;
  p_event: {
    event_type: string;
    event_id: string;
    session_id: string;
    url: string;
    attribution: Record<string, string>;
    workspace_id?: string;
  };
};

test("public tracking endpoints validate configured checkout destinations before writing", async (t) => {
  const originalFetch = global.fetch;
  const originalWebSocket = (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
  const envKeys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENCRYPTION_KEY"] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-private-service-credential";
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  if (!originalWebSocket) {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class WebSocket {};
  }

  const workspace = "10000000-0000-4000-8000-000000000001";
  const otherWorkspace = "10000000-0000-4000-8000-000000000002";
  const firstOffer: Offer = {
    id: "20000000-0000-4000-8000-000000000001",
    workspace_id: workspace,
    public_key: "offer-one-public-key",
    checkout_url: "https://pay.wiapy.com/first/",
    landing_url: "https://landing.test/first/",
  };
  const secondOffer: Offer = {
    id: "20000000-0000-4000-8000-000000000002",
    workspace_id: workspace,
    public_key: "offer-two-public-key",
    checkout_url: "https://pay.hotmart.com/SECOND",
    landing_url: "https://landing.test/second/",
  };
  let offers: Offer[] = [firstOffer, secondOffer];
  let readError = false;
  const writes: TrackingWrite[] = [];
  const workspaceReads: string[] = [];

  const respond = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

  global.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    // No network requests may escape this synthetic Supabase transport.
    assert.equal(url.origin, "https://supabase.test");
    if (url.pathname.endsWith("/utm_links")) return respond(null);
    if (url.pathname.endsWith("/utm_offers")) {
      assert.equal(url.searchParams.get("active"), "eq.true");
      if (readError) return respond({ code: "XX000", message: "Synthetic configuration read failure" }, 400);
      const publicKey = url.searchParams.get("public_key");
      if (publicKey) return respond(offers.find((offer) => `eq.${offer.public_key}` === publicKey) || null);
      const requestedWorkspace = url.searchParams.get("workspace_id");
      assert.equal(requestedWorkspace, `eq.${workspace}`);
      workspaceReads.push(requestedWorkspace!);
      const offset = Number(url.searchParams.get("offset") || "0");
      const limit = Number(url.searchParams.get("limit") || "500");
      return respond(offers.filter((offer) => `eq.${offer.workspace_id}` === requestedWorkspace).slice(offset, offset + limit));
    }
    if (url.pathname.endsWith("/rpc/utm_track_event")) {
      assert.equal(init?.method, "POST");
      writes.push(JSON.parse(String(init?.body)) as TrackingWrite);
      return respond("recorded");
    }
    throw new Error(`Unexpected test request: ${url.pathname}`);
  };

  const event = (key: string, url: string, extra: object = {}) => new Request("https://trackbase.test/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": "192.0.2.8" },
    body: JSON.stringify({
      key,
      event_type: "checkout",
      event_id: "event-checkout-unique",
      session_id: "visitor-session-unique",
      url,
      attribution: { utm_content: "creative-exact", utm_sck: "visitor-session-unique" },
      ...extra,
    }),
  });
  const config = (key: string, format = "json") => new Request(`https://trackbase.test/api/track?key=${encodeURIComponent(key)}&format=${format}`);

  try {
    await t.test("an offer-bound key cannot record another offer's checkout or a forged destination", async () => {
      const before = writes.length;
      for (const destination of [
        secondOffer.checkout_url!,
        "https://landing.test/first/",
        "https://evil.com/?redirect=https://pay.wiapy.com/first/",
        "https://pay.wiapy.com.evil.com/first/",
      ]) {
        const response = await POST(event(firstOffer.public_key, destination));
        assert.equal(response.status, 422);
        assert.equal((await response.json()).code, "UNCONFIGURED_DESTINATION");
      }
      assert.equal(writes.length, before);
    });

    await t.test("a valid checkout preserves its event, session and attribution with its bound key", async () => {
      const destination = "https://pay.wiapy.com/first/pay?utm_campaign=campaign&sck=visitor-session-unique";
      const response = await POST(event(firstOffer.public_key, destination, { workspace_id: otherWorkspace }));
      assert.equal(response.status, 200);
      const saved = writes.at(-1)!;
      assert.equal(saved.p_key, firstOffer.public_key);
      assert.equal(saved.p_event.event_type, "checkout");
      assert.equal(saved.p_event.event_id, "event-checkout-unique");
      assert.equal(saved.p_event.session_id, "visitor-session-unique");
      assert.equal(saved.p_event.url, destination);
      assert.equal(saved.p_event.attribution.utm_content, "creative-exact");
      assert.equal(saved.p_event.attribution.utm_sck, "visitor-session-unique");
      assert.equal("workspace_id" in saved.p_event, false);
    });

    await t.test("preserves a long composite Hotmart xcod in the public tracking contract", async () => {
      const xcod = "FB" + "x".repeat(1500);
      const response = await POST(event(firstOffer.public_key, firstOffer.checkout_url!, {
        attribution: { xcod },
      }));
      assert.equal(response.status, 200);
      assert.equal(writes.at(-1)!.p_event.attribution.xcod, xcod);
    });

    await t.test("a universal workspace key resolves the matching offer rather than the first active offer", async () => {
      const response = await POST(event(workspace, secondOffer.checkout_url!, { workspace_id: otherWorkspace }));
      assert.equal(response.status, 200);
      assert.equal(writes.at(-1)!.p_key, secondOffer.public_key);
      assert.equal(workspaceReads.at(-1), `eq.${workspace}`);
      assert.equal("workspace_id" in writes.at(-1)!.p_event, false);
    });

    await t.test("a universal key rejects absent and ambiguous matches without writing an event", async () => {
      const before = writes.length;
      let response = await POST(event(workspace, "https://pay.wiapy.com/unconfigured"));
      assert.equal(response.status, 422);
      assert.equal((await response.json()).code, "UNCONFIGURED_DESTINATION");
      offers = [firstOffer, { ...secondOffer, checkout_url: firstOffer.checkout_url }];
      response = await POST(event(workspace, firstOffer.checkout_url!));
      assert.equal(response.status, 422);
      assert.equal((await response.json()).code, "AMBIGUOUS_OFFER");
      assert.equal(writes.length, before);
      offers = [firstOffer, secondOffer];
    });

    await t.test("workspace resolution reads later pages before deciding that a checkout is unique", async () => {
      const before = writes.length;
      const readsBefore = workspaceReads.length;
      offers = Array.from({ length: 501 }, (_, index) => ({
        ...firstOffer,
        id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        public_key: `paginated-public-key-${index}`,
        checkout_url: index === 0 || index === 500 ? firstOffer.checkout_url : `https://pay.wiapy.com/offer-${index}/`,
      }));
      const response = await POST(event(workspace, firstOffer.checkout_url!));
      assert.equal(response.status, 422);
      assert.equal((await response.json()).code, "AMBIGUOUS_OFFER");
      assert.equal(workspaceReads.length - readsBefore, 2);
      assert.equal(writes.length, before);
      offers = [firstOffer, secondOffer];
    });

    await t.test("generic CTA clicks remain CTA clicks, while universal landing ambiguity never chooses the first offer", async () => {
      let response = await POST(event(firstOffer.public_key, firstOffer.landing_url, { event_type: "cta_click" }));
      assert.equal(response.status, 200);
      assert.equal(writes.at(-1)!.p_event.event_type, "cta_click");
      const before = writes.length;
      offers = [firstOffer, { ...secondOffer, landing_url: firstOffer.landing_url }];
      response = await POST(event(workspace, firstOffer.landing_url, { event_type: "pageview" }));
      assert.equal(response.status, 422);
      assert.equal((await response.json()).code, "AMBIGUOUS_OFFER");
      assert.equal(writes.length, before);
      offers = [firstOffer, secondOffer];
    });

    await t.test("public configuration exposes only checkout rules and excludes private keys and offer identifiers", async () => {
      const response = await GET(config(workspace));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      const configuration = await response.json();
      assert.deepEqual(configuration, { rules: [firstOffer.checkout_url, secondOffer.checkout_url] });
      const serialized = JSON.stringify(configuration);
      for (const privateValue of [firstOffer.id, firstOffer.public_key, workspace, process.env.SUPABASE_SERVICE_ROLE_KEY!]) {
        assert.equal(serialized.includes(privateValue), false);
      }
      assert.deepEqual(await (await GET(config(firstOffer.public_key))).json(), { rules: [firstOffer.checkout_url] });
    });

    await t.test("JavaScript configuration runs as a standalone browser script using the shared URL matcher", async () => {
      const response = await GET(config(workspace, "js"));
      assert.equal(response.status, 200);
      assert.match(response.headers.get("Content-Type") || "", /^application\/javascript/);
      const browser: { __TRACKBASE_CHECKOUT_CONFIG__?: Record<string, { rules: string[]; matches: typeof matchesCheckoutUrl }> } = {};
      runInNewContext(await response.text(), { window: browser, URL });
      const configuration = browser.__TRACKBASE_CHECKOUT_CONFIG__![workspace];
      assert.equal(configuration.rules.length, 2);
      const destinations = [
        "https://pay.wiapy.com/first/pay?utm_content=creative&sck=session",
        "https://pay.hotmart.com/SECOND?xcod=session",
        "https://evil.com/?next=https://pay.wiapy.com/first/",
        "http://pay.wiapy.com/first/",
        "https://pay.wiapy.com/first-other/",
      ];
      for (const destination of destinations) {
        for (const rule of configuration.rules) {
          assert.equal(configuration.matches(destination, rule), matchesCheckoutUrl(destination, rule));
        }
      }
    });

    await t.test("JavaScript configuration escapes HTML and line separators in public keys and rules", async () => {
      const maliciousKey = "public-key-</script><script>window.injected=true</script>";
      const maliciousRule = "https://pay.wiapy.com/first/?note=</script><script>window.injected=true</script>\u2028\u2029";
      offers = [{ ...firstOffer, public_key: maliciousKey, checkout_url: maliciousRule }];
      const response = await GET(config(maliciousKey, "js"));
      assert.equal(response.status, 200);
      const source = await response.text();
      assert.equal(source.includes("</script>"), false);
      assert.equal(source.includes("\u2028"), false);
      assert.equal(source.includes("\u2029"), false);
      const browser: { injected?: boolean; __TRACKBASE_CHECKOUT_CONFIG__?: Record<string, { rules: string[] }> } = {};
      runInNewContext(source, { window: browser, URL });
      assert.equal(browser.injected, undefined);
      assert.equal(browser.__TRACKBASE_CHECKOUT_CONFIG__![maliciousKey].rules[0], maliciousRule);
      offers = [firstOffer, secondOffer];
    });

    await t.test("invalid keys and failed configuration reads cannot create events", async () => {
      const before = writes.length;
      assert.equal((await POST(event("unknown-public-key", firstOffer.checkout_url!))).status, 404);
      assert.equal((await GET(config("unknown-public-key"))).status, 404);
      readError = true;
      assert.equal((await POST(event(firstOffer.public_key, firstOffer.checkout_url!))).status, 503);
      assert.equal((await GET(config(firstOffer.public_key))).status, 503);
      assert.equal(writes.length, before);
      readError = false;
    });
  } finally {
    global.fetch = originalFetch;
    if (originalWebSocket === undefined) delete (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
    else (globalThis as unknown as { WebSocket: unknown }).WebSocket = originalWebSocket;
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});
