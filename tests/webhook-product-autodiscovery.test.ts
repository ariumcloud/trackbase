import test from "node:test";
import assert from "node:assert/strict";
import { resolveProductTarget, type Hub } from "../src/lib/gateway-offers";
import { admin } from "../src/lib/supabase/server";

test("webhook product auto-discovery resolves known products and only creates new ones from real approved sales on catalog providers", async (t) => {
  const originalFetch = global.fetch;
  const originalWebSocket = (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
  const envKeys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-private-service-credential";
  if (!originalWebSocket) {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class WebSocket {};
  }

  const workspace = "10000000-0000-4000-8000-000000000001";
  const hub: Hub = {
    id: "20000000-0000-4000-8000-00000000000h",
    workspace_id: workspace,
    offer_id: "30000000-0000-4000-8000-000000000001",
    name: "HOTMART · Produto Legado",
    external_product_id: "8456069",
    external_offer_id: null,
    currency: "BRL",
  };
  const satellite = {
    id: "20000000-0000-4000-8000-00000000000s",
    offer_id: "30000000-0000-4000-8000-000000000002",
    name: "HOTMART · Já descoberto",
    external_offer_id: null,
  };
  let createdOfferInsert: Record<string, unknown> | null = null;
  let createdIntegrationInsert: Record<string, unknown> | null = null;
  let parentLinkUpdate: Record<string, unknown> | null = null;
  let credentialInserted: Record<string, unknown> | null = null;

  const respond = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

  global.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://supabase.test");
    const method = init?.method || "GET";

    if (url.pathname.endsWith("/utm_integrations") && method === "GET") {
      // Satellite lookup: only "already-discovered-42" resolves to the fixture satellite.
      const isKnownSatellite = url.search.includes("already-discovered-42");
      return respond(isKnownSatellite ? [satellite] : []);
    }
    if (url.pathname.endsWith("/utm_offers") && method === "POST") {
      createdOfferInsert = JSON.parse(String(init?.body));
      return respond({ id: "30000000-0000-4000-8000-000000000099" });
    }
    if (url.pathname.endsWith("/utm_integrations") && method === "POST") {
      createdIntegrationInsert = JSON.parse(String(init?.body));
      return respond({ id: "20000000-0000-4000-8000-000000000099" });
    }
    if (url.pathname.endsWith("/utm_integrations") && method === "PATCH") {
      parentLinkUpdate = JSON.parse(String(init?.body));
      return respond([]);
    }
    if (url.pathname.endsWith("/utm_credentials") && method === "GET") {
      return respond({ api_credentials_ciphertext: "hub-credential-ciphertext" });
    }
    if (url.pathname.endsWith("/utm_credentials") && method === "POST") {
      credentialInserted = JSON.parse(String(init?.body));
      return respond({});
    }
    throw new Error(`Unexpected test request: ${method} ${url.pathname}${url.search}`);
  };

  try {
    const service = admin();

    await t.test("an event matching the hub's own configured product resolves to the hub, no queries needed", async () => {
      const target = await resolveProductTarget(service, hub, "hotmart", "8456069", null, true, "Produto Legado", "BRL");
      assert.deepEqual(target, { id: hub.id, offer_id: hub.offer_id, name: hub.name });
    });

    await t.test("an event for a product already discovered before resolves to its own satellite", async () => {
      const target = await resolveProductTarget(service, hub, "hotmart", "already-discovered-42", null, false, null, "BRL");
      assert.deepEqual(target, { id: satellite.id, offer_id: satellite.offer_id, name: satellite.name });
    });

    await t.test("an unknown product with no approved sale yet resolves to nothing — never creates a fake offer", async () => {
      for (const isApproved of [false]) {
        const target = await resolveProductTarget(service, hub, "hotmart", "never-seen-before", null, isApproved, "Anything", "BRL");
        assert.equal(target, null);
      }
      assert.equal(createdOfferInsert, null);
    });

    await t.test("an empty productId never resolves, even if the event is approved", async () => {
      const target = await resolveProductTarget(service, hub, "hotmart", "", null, true, "Anything", "BRL");
      assert.equal(target, null);
      assert.equal(createdOfferInsert, null);
    });

    await t.test("a genuinely new, approved sale on a catalog provider auto-creates the offer and links it to the hub", async () => {
      const target = await resolveProductTarget(service, hub, "hotmart", "brand-new-product", null, true, "Novo Produto Real", "USD");
      assert.deepEqual(target, {
        id: "20000000-0000-4000-8000-000000000099",
        offer_id: "30000000-0000-4000-8000-000000000099",
        name: "Novo Produto Real",
      });
      assert.equal((createdOfferInsert as Record<string, unknown>).name, "Novo Produto Real");
      assert.equal((createdOfferInsert as Record<string, unknown>).external_product_id, "brand-new-product");
      assert.equal((createdIntegrationInsert as Record<string, unknown>).status, "connected");
      assert.equal((parentLinkUpdate as Record<string, unknown>).parent_integration_id, hub.id);
      assert.equal((credentialInserted as Record<string, unknown>).api_credentials_ciphertext, "hub-credential-ciphertext");
    });

    await t.test("the exact same new-product scenario on a non-catalog provider never attempts to create anything", async () => {
      createdOfferInsert = null;
      createdIntegrationInsert = null;
      const kirvanoHub: Hub = { ...hub, id: "20000000-0000-4000-8000-00000000000k" };
      const target = await resolveProductTarget(service, kirvanoHub, "kirvano", "brand-new-product", null, true, "Novo Produto Real", "BRL");
      assert.equal(target, null);
      assert.equal(createdOfferInsert, null);
      assert.equal(createdIntegrationInsert, null);
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
