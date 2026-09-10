import test from "node:test";
import assert from "node:assert/strict";
import { gatewayWebhookUrl } from "../src/lib/webhook-url";
import { paymentProviders } from "../src/lib/payment-contract";
const id = "11111111-1111-4111-8111-111111111111";
for (const provider of paymentProviders) {
  test(`${provider}: generated webhook preserves provider and integration`, () => {
    assert.equal(gatewayWebhookUrl("https://trackbase.com.br/", provider, id), `https://trackbase.com.br/api/webhooks/${provider}/${id}`);
  });
}
test("missing, local and unsafe origins never generate unusable public callbacks", () => {
  for (const base of ["", "invalid", "http://localhost:3000", "https://127.0.0.1", "https://[::1]", "https://192.168.1.1", "https://user:pass@example.com", "javascript:alert(1)"]) {
    assert.equal(gatewayWebhookUrl(base, "hotmart", id), `https://trackbase.com.br/api/webhooks/hotmart/${id}`);
  }
});
test("callback normalizes path/query and retains separate integration addresses", () => {
  assert.equal(gatewayWebhookUrl("https://app.example.com/painel?x=1", "hotmart", id), `https://app.example.com/api/webhooks/hotmart/${id}`);
  assert.notEqual(gatewayWebhookUrl("", "hotmart", id), gatewayWebhookUrl("", "hotmart", "22222222-2222-4222-8222-222222222222"));
  assert.throws(() => gatewayWebhookUrl("", "unknown", id));
  assert.throws(() => gatewayWebhookUrl("", "hotmart", "../other"));
});
