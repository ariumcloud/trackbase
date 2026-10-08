import test from "node:test";
import assert from "node:assert/strict";
import { caktoAdapter } from "../src/lib/payment-adapters";

const order = (id: string) => ({
  id, amount: 97, fees: 5, paidAt: "2026-10-08T12:00:00Z", status: "paid",
  customer: { name: "Maria Silva", email: "m@x.com", phone: "11999999999" },
  product: { id: "p1", name: "Produto" }, offer_type: "main",
});
const ctx = { receivedAt: "2026-10-08T12:00:01Z", fallbackCurrency: "BRL" };

test("Cakto V2: data como array gera um evento por pedido", () => {
  const ev = caktoAdapter.normalize({ event: "purchase_approved", data: [order("a"), order("b")] }, ctx);
  assert.equal(ev.length, 2);
  assert.equal(ev[1].externalTransactionId, "b");
  assert.equal(ev[0].buyer?.phone, "11999999999");
  assert.equal(ev[0].occurredAt, "2026-10-08T12:00:00.000Z");
});

test("Cakto: refund_requested não é reembolso; renovação é aprovada", () => {
  const t = (event: string) => caktoAdapter.normalize({ event, data: order("c") }, ctx)[0].type;
  assert.equal(t("refund_requested"), "payment_pending");
  assert.equal(t("refund"), "purchase_refunded");
  assert.equal(t("subscription_renewed"), "subscription_renewed");
});
