import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/mining/offers/route";
import { GET as monitors } from "../src/app/api/mining/monitors/route";
import { PUT as redeem } from "../src/app/api/mining/extension/route";
import { digest } from "../src/lib/security";

test("capture endpoints validate bearer, current membership, workspace, payload and idempotent response", async () => {
  const original = global.fetch;
  const originalWs = (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
  if (!("WebSocket" in globalThis) || !globalThis.WebSocket) {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class WebSocket {};
  }
  const env = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-placeholder";
  const workspace = "00000000-0000-4000-8000-000000000001",
    other = "00000000-0000-4000-8000-000000000002",
    token = "a".repeat(64);
  let plan = "liso",
    status = "active",
    role = "owner",
    expires = new Date(Date.now() + 100000).toISOString(),
    missingUser = false,
    duplicate = false,
    writes = 0;
  global.fetch = async (input, init) => {
    const url = new URL(String(input));
    const respond = (v: unknown) =>
      new Response(JSON.stringify(v), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (url.pathname.endsWith("utm_extension_grants")) {
      assert.equal(url.searchParams.get("token_hash"), `eq.${digest(token)}`);
      return respond({
        user_id: workspace,
        workspace_id: workspace,
        status,
        expires_at: expires,
      });
    }
    if (url.pathname.endsWith("utm_members")) {
      assert.equal(url.searchParams.get("workspace_id"), `eq.${workspace}`);
      return respond({ role });
    }
    if (url.pathname.endsWith("utm_workspaces")) return respond({ plan });
    if (url.pathname.includes("/auth/v1/admin/users/"))
      return respond({ user: missingUser ? null : { id: workspace } });
    if (url.pathname.endsWith("utm_rate_limit")) return respond(true);
    if (url.pathname.endsWith("utm_mining_capture")) {
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.p_workspace, workspace);
      writes++;
      return respond({ offer: { id: workspace }, duplicate });
    }
    if (url.pathname.endsWith("utm_mining_monitors")) {
      assert.equal(url.searchParams.get("workspace_id"), `eq.${workspace}`);
      return respond([]);
    }
    if (url.pathname.endsWith("utm_extension_redeem")) return respond(null);
    throw new Error(`Unexpected test URL ${url.pathname}`);
  };
  const request = (
    w = workspace,
    authorization = `Bearer ${token}`,
    capture: object = { library_id: "123456789", advertiser: "Teste" },
  ) =>
    new Request("https://app.test/api/mining/offers", {
      method: "POST",
      headers: { authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: w, capture }),
    });
  try {
    assert.equal((await POST(request())).status, 201);
    plan = "devedor";
    assert.equal((await POST(request())).status, 403);
    plan = "liso";
    duplicate = true;
    assert.equal((await (await POST(request())).json()).duplicate, true);
    const before = writes;
    assert.equal((await POST(request(other))).status, 401);
    status = "revoked";
    assert.equal((await POST(request())).status, 401);
    status = "active";
    expires = "2000-01-01";
    assert.equal((await POST(request())).status, 401);
    expires = new Date(Date.now() + 100000).toISOString();
    role = "viewer";
    assert.equal((await POST(request())).status, 403);
    role = "owner";
    missingUser = true;
    assert.equal((await POST(request())).status, 401);
    missingUser = false;
    assert.equal((await POST(request(workspace, "Bearer bad"))).status, 401);
    assert.equal(
      (
        await POST(
          request(workspace, `Bearer ${token}`, { advertiser: "No ID" }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await POST(
          request(workspace, `Bearer ${token}`, {
            library_id: "123456789",
            advertiser: "Teste",
            landing_url: "http://localhost",
          }),
        )
      ).status,
      400,
    );
    assert.equal(writes, before);
    assert.equal(
      (
        await monitors(
          new Request(
            `https://app.test/api/mining/monitors?workspace=${workspace}`,
            { headers: { authorization: `Bearer ${token}` } },
          ),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await redeem(
          new Request("https://app.test/api/mining/extension", {
            method: "PUT",
            body: JSON.stringify({ verifier: token }),
          }),
        )
      ).status,
      401,
    );
  } finally {
    global.fetch = original;
    if (originalWs === undefined) {
      delete (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
    } else {
      (globalThis as unknown as { WebSocket: unknown }).WebSocket = originalWs;
    }
    if (env.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
    if (env.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = env.key;
  }
});
