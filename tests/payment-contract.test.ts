import { test } from "node:test";
import assert from "node:assert/strict";
import {
  paymentIdentity,
  webhookEventIdentity,
  redactPaymentPayload,
  paymentEventTypes,
  normalizedPaymentEventSchema,
} from "../src/lib/payment-contract";
import { canUse, normalizePlan, plans } from "../src/lib/plans";
test("planos oficiais e compatibilidade histórica não liberam plano desconhecido", () => {
  assert.deepEqual(Object.keys(plans), ["devedor", "liso", "vorcaro"]);
  assert.equal(normalizePlan("rico"), "vorcaro");
  assert.equal(normalizePlan("classe_media"), "vorcaro");
  assert.equal(canUse("forged", "capi"), false);
  assert.equal(canUse("devedor", "mining"), false);
  assert.equal(canUse("liso", "mining"), true);
  assert.equal(canUse("vorcaro", "mining"), true);
});
test("identidade ignora IDs de entrega e separa provedor e teste", () => {
  const base = {
    provider: "hotmart" as const,
    externalTransactionId: "tx",
    type: "purchase_approved" as const,
    isTest: false,
  };
  assert.equal(paymentIdentity(base), paymentIdentity({ ...base }));
  assert.notEqual(
    paymentIdentity(base),
    paymentIdentity({ ...base, provider: "cakto" }),
  );
  assert.notEqual(
    paymentIdentity(base),
    paymentIdentity({ ...base, isTest: true }),
  );
});
test("identidade de entrega preserva transições distintas da mesma transação", () => {
  const purchase = {
    externalEventId: null,
    externalTransactionId: "tx-1",
    productType: "main" as const,
    type: "purchase_approved" as const,
  };
  assert.notEqual(
    webhookEventIdentity(purchase),
    webhookEventIdentity({ ...purchase, type: "purchase_refunded" }),
  );
  assert.equal(webhookEventIdentity(purchase), webhookEventIdentity(purchase));
});
test("payload bruto é sanitizado recursivamente sem modificar a origem", () => {
  const original = {
    secret: "private",
    data: { hottok: "private", amount: 10 },
    items: [{ api_key: "private" }],
  };
  const clean = JSON.stringify(redactPaymentPayload(original));
  assert.ok(!clean.includes("private"));
  assert.equal(original.secret, "private");
  assert.ok(clean.includes("10"));
});
test("contrato suporta todo o ciclo e moedas distintas sem conversão implícita", () => {
  for (const type of paymentEventTypes) {
    const result = normalizedPaymentEventSchema.parse({
      provider: "wiapy",
      externalTransactionId: "tx",
      externalEventId: null,
      type,
      productId: "p",
      offerId: null,
      productType: "main",
      parentProductId: null,
      parentTransactionId: null,
      grossAmount: 100,
      netAmount: 18,
      fees: null,
      grossCurrency: "ARS",
      netCurrency: "USD",
      country: "AR",
      buyer: null,
      attribution: {},
      campaignId: null,
      adsetId: null,
      adId: null,
      creativeId: null,
      clickId: null,
      occurredAt: "2026-09-06T10:00:00Z",
      receivedAt: "2026-09-06T11:00:00Z",
      isTest: true,
      rawPayload: {},
    });
    assert.equal(result.grossCurrency, "ARS");
    assert.equal(result.netCurrency, "USD");
  }
});
