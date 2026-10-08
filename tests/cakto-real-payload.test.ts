import test from "node:test";
import assert from "node:assert/strict";
import { caktoAdapter } from "../src/lib/payment-adapters";

// Shape of Cakto's own "send test webhook" delivery (purchase_approved).
const payload = {
  event: "purchase_approved",
  secret: "redacted",
  data: {
    id: "5c32441e-5a42-4bcf-a057-6f8574d59b96",
    fbc: "fb.1.1700000000000.AbCdEf",
    fbp: "fb.1.1700000000000.123456789",
    sck: "sess_123",
    fees: 0,
    amount: 90,
    baseAmount: 100,
    paidAt: "2026-10-08T20:24:39.086094+00:00",
    createdAt: "2026-10-08T20:24:30.000000+00:00",
    status: "paid",
    offer: { id: "B8BcHrY", name: "Special Offer", price: 10 },
    offer_type: "main",
    product: { id: "ff3fdf61-e88f-43b5-982a-32d50f112414", name: "Produto Teste", type: "unique" },
    customer: { name: "John Doe", email: "john.doe@example.com", phone: "34999999999" },
    utm_source: "test",
    utm_campaign: "test_20261008",
    utm_content: "example",
    utm_term: "example",
    checkoutUrl: "https://pay.cakto.com.br/EXAMPLE?utm_source=test&utm_content=example",
    paymentMethod: "credit_card",
  },
};

test("Cakto payload real: valor, produto, datas e sinais de atribuição", () => {
  const [ev] = caktoAdapter.normalize(payload, { receivedAt: "2026-10-08T20:25:00Z", fallbackCurrency: "BRL" });
  assert.equal(ev.type, "purchase_approved");
  assert.equal(ev.grossAmount, 90);
  assert.equal(ev.productId, "ff3fdf61-e88f-43b5-982a-32d50f112414");
  assert.equal(ev.offerId, "B8BcHrY");
  assert.equal(ev.occurredAt, "2026-10-08T20:24:39.086Z");
  assert.equal(ev.buyer?.phone, "34999999999");
  // fbc/fbp/sck come at data root, not inside checkoutUrl: they feed CAPI matching.
  assert.equal(ev.attribution.fbc, "fb.1.1700000000000.AbCdEf");
  assert.equal(ev.attribution.fbp, "fb.1.1700000000000.123456789");
  assert.equal(ev.attribution.sck, "sess_123");
  assert.equal(ev.attribution.utm_campaign, "test_20261008");
  assert.equal(ev.campaignId, "test_20261008");
  assert.equal(ev.adId, "example");
});
