import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLink, metaDefaults, mergeAttribution } from "../src/lib/utm";
import { normalizePayment } from "../src/lib/payments";
import { calculate, dayInZone } from "../src/lib/metrics";
test("UTMs preservam macros, query e fragmento", () => {
  const r = buildLink("https://example.com/quiz?product=1#cta", metaDefaults);
  assert.ok(r.full.includes("product=1"));
  assert.ok(r.full.endsWith("#cta"));
  assert.ok(r.parameters.includes("{{campaign.id}}"));
  assert.ok(!r.parameters.includes("product=1"));
});
test("links rejeitam protocolos executáveis e credenciais", () => {
  assert.throws(() => buildLink("javascript:alert(1)", {}));
  assert.throws(() => buildLink("https://user:secret@example.com", {}));
});
test("atribuição mantém origem ao navegar sem UTMs e troca campanha completa", () => {
  assert.deepEqual(mergeAttribution({ utm_campaign: "A" }, {}), {
    utm_campaign: "A",
  });
  assert.deepEqual(
    mergeAttribution(
      { utm_campaign: "A", utm_content: "old" },
      { utm_campaign: "B" },
    ),
    { utm_campaign: "B" },
  );
});
test("Hotmart usa formato documentado e rejeita valor ausente", () => {
  const p = {
    id: "event",
    event: "PURCHASE_APPROVED",
    creation_date: 1724330400000,
    data: {
      product: { id: 12 },
      purchase: {
        transaction: "HP123",
        price: { value: 49.9, currency_value: "USD" },
        offer: { code: "sale" },
        tracking: { utm_campaign: "123" },
      },
    },
  };
  const r = normalizePayment("hotmart", p);
  assert.equal(r.currency, "USD");
  assert.equal(r.amount, 49.9);
  assert.equal(r.product_id, "12");
  assert.equal(r.attribution.utm_campaign, "123");
  assert.throws(() =>
    normalizePayment("hotmart", {
      ...p,
      data: { ...p.data, purchase: { transaction: "HP123" } },
    }),
  );
});
test("Cakto lê data.amount e moeda configurada sem presumir BRL", () => {
  const p = {
    secret: "never-store",
    event: "purchase_approved",
    data: {
      id: "order",
      amount: 5.55,
      product: { id: "prod" },
      offer: { id: "offer" },
      paidAt: "2024-08-22T11:39:57-03:00",
    },
  };
  assert.equal(normalizePayment("cakto", p).currency, null);
  const r = normalizePayment("cakto", p, "EUR");
  assert.equal(r.currency, "EUR");
  assert.equal(r.amount, 5.55);
  assert.ok(!JSON.stringify(r).includes("never-store"));
});
test("eventos desconhecidos e datas inválidas não viram vendas", () => {
  assert.throws(() =>
    normalizePayment("cakto", { event: "unexpected", data: {} }),
  );
  assert.throws(() =>
    normalizePayment("cakto", {
      event: "purchase_approved",
      data: { id: "a", amount: 1 },
    }),
  );
});
test("cálculos separam moedas, testes e reembolsos; divisão por zero é indisponível", () => {
  const sale = {
    currency: "BRL",
    amount: 200,
    status: "approved",
    is_test: false,
    occurred_at: "2026-09-06T01:00:00Z",
  };
  const r = calculate(
    [
      sale,
      { ...sale, currency: "USD" },
      { ...sale, is_test: true },
      { ...sale, status: "refunded" },
    ],
    [{ currency: "BRL", spend: 100, impressions: 1000, clicks: 50 }],
    "BRL",
  );
  assert.equal(r.revenue, 200);
  assert.equal(r.roas, 2);
  assert.equal(r.ctr, 5);
  assert.equal(r.cpc, 2);
  assert.equal(r.purchases, 1);
  assert.equal(calculate([], [], "BRL").spend, null);
  assert.equal(calculate([], [], "BRL").roas, null);
});
test("timezone respeita virada do dia no Brasil", () =>
  assert.equal(
    dayInZone(new Date("2026-09-06T01:00:00Z"), "America/Sao_Paulo"),
    "2026-09-05",
  ));
