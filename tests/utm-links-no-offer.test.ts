import test from "node:test";
import assert from "node:assert/strict";
import { linkSchema } from "../src/lib/utm";
import { GET, POST } from "../src/app/api/track/route";

test("linkSchema accepts links without offer or with null/empty offer_id", () => {
  // 1. Ausência de offer_id
  const parsed1 = linkSchema.parse({
    name: "Link Anúncio Feed",
    url: "https://pagina.com.br/lp",
    params: { utm_source: "meta" },
  });
  assert.equal(parsed1.name, "Link Anúncio Feed");
  assert.equal(parsed1.offer_id, undefined);

  // 2. offer_id nulo
  const parsed2 = linkSchema.parse({
    name: "Link Google",
    url: "https://pagina.com.br/lp",
    offer_id: null,
    params: {},
  });
  assert.equal(parsed2.offer_id, null);

  // 3. offer_id vazio vindo de <select>
  const parsed3 = linkSchema.parse({
    name: "Link TikTok",
    url: "https://pagina.com.br/lp",
    offer_id: "",
    params: {},
  });
  assert.equal(parsed3.offer_id, null);

  // 4. offer_id UUID válido
  const validUuid = "10000000-0000-4000-8000-000000000001";
  const parsed4 = linkSchema.parse({
    name: "Link Dedicado",
    url: "https://pagina.com.br/lp",
    offer_id: validUuid,
    params: {},
  });
  assert.equal(parsed4.offer_id, validUuid);

  // 5. offer_id string inválida (não UUID) deve falhar
  assert.throws(() => {
    linkSchema.parse({
      name: "Link Quebrado",
      url: "https://pagina.com.br/lp",
      offer_id: "nao-eh-uuid",
      params: {},
    });
  });
});

test("tracking endpoint aceita GET e POST para links criados sem oferta", async (t) => {
  const originalFetch = global.fetch;
  const envKeys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENCRYPTION_KEY"] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-private-service-credential";
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

  const workspace = "10000000-0000-4000-8000-000000000001";
  const offerlessLinkKey = "link_sem_oferta_public_key_123";
  const writes: Array<{ p_key: string; p_event: { event_type: string } }> = [];

  const respond = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  global.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.endsWith("/utm_links")) {
      const publicKey = url.searchParams.get("public_key");
      if (publicKey === `eq.${offerlessLinkKey}`) {
        return respond({
          workspace_id: workspace,
          offer_id: null,
          active: true,
        });
      }
      return respond(null);
    }
    if (url.pathname.endsWith("/utm_offers")) {
      // Workspace sem ofertas ativas cadastradas ainda
      return respond([]);
    }
    if (url.pathname.endsWith("/rpc/utm_track_event")) {
      writes.push(JSON.parse(String(init?.body)));
      return respond("recorded");
    }
    throw new Error(`Unexpected test request: ${url.pathname}`);
  };

  try {
    await t.test("GET /api/track com link sem oferta retorna 200 com rules vazias em vez de 404", async () => {
      const request = new Request(`https://trackbase.test/api/track?key=${offerlessLinkKey}`);
      const response = await GET(request);
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.deepEqual(json, { rules: [] });
    });

    await t.test("POST /api/track com pageview em link sem oferta grava evento com a chave do link", async () => {
      const request = new Request("https://trackbase.test/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "192.0.2.1" },
        body: JSON.stringify({
          key: offerlessLinkKey,
          event_type: "pageview",
          session_id: "sess_visitor_no_offer_1",
          url: "https://pagina.com.br/landing?utm_source=meta",
        }),
      });
      const response = await POST(request);
      assert.equal(response.status, 200);
      const lastWrite = writes.at(-1);
      assert.ok(lastWrite);
      assert.equal(lastWrite.p_key, offerlessLinkKey);
      assert.equal(lastWrite.p_event.event_type, "pageview");
    });
  } finally {
    global.fetch = originalFetch;
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});
