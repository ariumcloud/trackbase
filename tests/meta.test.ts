import test from "node:test";
import assert from "node:assert/strict";
import { MetaError, graph, listMetaAccounts, normalizeAdAccountId } from "../src/lib/meta";

test("contas Meta normalizam IDs com e sem act_", () => {
  assert.equal(normalizeAdAccountId("123"), "act_123");
  assert.equal(normalizeAdAccountId("act_123"), "act_123");
  assert.equal(normalizeAdAccountId("invalid"), null);
});

test("descoberta agrega contas diretas e de Business Manager", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    const data = path.endsWith("/me/permissions")
      ? { data: [{ permission: "ads_read", status: "granted" }, { permission: "business_management", status: "granted" }] }
      : path.endsWith("/me/adaccounts")
        ? { data: [{ id: "123", name: "Direta", currency: "BRL", timezone_name: "America/Sao_Paulo" }] }
        : path.endsWith("/me/businesses")
          ? { data: [{ id: "bm1", name: "Empresa A" }] }
          : path.endsWith("/bm1/owned_ad_accounts")
            ? { data: [{ id: "act_456", name: "Business", currency: "USD", timezone_name: "UTC" }] }
            : { data: [] };
    return Response.json(data);
  };
  try {
    const result = await listMetaAccounts("token");
    assert.equal(result.businesses[0].name, "Empresa A");
    assert.deepEqual(result.accounts.map((account) => account.id), ["act_456", "act_123"]);
    assert.equal(result.accounts[0].origins[0].businessName, "Empresa A");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("erro de token expirado preserva código e etapa seguros", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: { code: 190 } }, { status: 400 });
  try {
    await assert.rejects(() => graph("me/adaccounts", "token", {}, "GET", "direct_accounts"), (error: unknown) => error instanceof MetaError && error.internalCode === "token_expired" && error.stage === "direct_accounts");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
