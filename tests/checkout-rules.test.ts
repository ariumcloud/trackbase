import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CHECKOUT_FRAGMENTS,
  checkoutUrlFromPayload,
  normalizeCheckoutFragment,
  parseCheckoutFragments,
  resolveCheckoutFragments,
} from "../src/lib/checkout-rules";

test("normaliza o que o usuário digita no campo de checkout", () => {
  assert.equal(normalizeCheckoutFragment("pay.cakto.com.br"), "pay.cakto.com.br");
  assert.equal(normalizeCheckoutFragment("https://www.Pay.Cakto.com.br/bbk99hm?utm_source=x#a"), "pay.cakto.com.br/bbk99hm");
  assert.equal(normalizeCheckoutFragment("pay.cakto"), "pay.cakto");
  assert.equal(normalizeCheckoutFragment("ab"), null); // curto demais: casaria com qualquer link
  assert.equal(normalizeCheckoutFragment("pay cakto"), null);
  assert.equal(normalizeCheckoutFragment("<script>"), null);
  assert.equal(normalizeCheckoutFragment(undefined), null);
});

test("aceita vários checkouts separados por vírgula ou espaço, sem repetir", () => {
  assert.deepEqual(parseCheckoutFragments("pay.cakto.com.br, pay.hotmart.com  pay.cakto.com.br;x"), [
    "pay.cakto.com.br",
    "pay.hotmart.com",
  ]);
  assert.deepEqual(parseCheckoutFragments(""), []);
});

test("regras do pixel têm prioridade; sem regra valem os checkouts conhecidos", () => {
  assert.deepEqual(resolveCheckoutFragments([{ trigger_config: { pattern: "https://pay.exemplo.com/p1" } }]), ["pay.exemplo.com/p1"]);
  assert.deepEqual(resolveCheckoutFragments([{ trigger_config: {} }, { trigger_config: null }]), [...DEFAULT_CHECKOUT_FRAGMENTS]);
  assert.ok(DEFAULT_CHECKOUT_FRAGMENTS.includes("pay.cakto.com.br"));
});

test("aprende o link de checkout do payload da Cakto sem query nem barra final", () => {
  const v1 = { event: "purchase_approved", data: { checkoutUrl: "https://pay.cakto.com.br/bbk99hm/?utm_source=meta&sck=s_1" } };
  assert.equal(checkoutUrlFromPayload(v1), "https://pay.cakto.com.br/bbk99hm");
  assert.equal(checkoutUrlFromPayload({ data: [{ checkoutUrl: "https://pay.cakto.com.br/x?a=1" }] }), "https://pay.cakto.com.br/x");
  assert.equal(checkoutUrlFromPayload({ data: { checkoutUrl: "http://inseguro.com/x" } }), null);
  assert.equal(checkoutUrlFromPayload({ data: { checkoutUrl: "https://user:pw@pay.com/x" } }), null);
  assert.equal(checkoutUrlFromPayload({ data: {} }), null);
  assert.equal(checkoutUrlFromPayload(null), null);
});
