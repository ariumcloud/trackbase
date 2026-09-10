import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLink, metaDefaults, mergeAttribution } from "../src/lib/utm";
import { normalizePayment } from "../src/lib/payments";
import { calculate, dayInZone } from "../src/lib/metrics";
import { convertCurrencyAmount } from "../src/lib/currency";
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

test("conversão de moeda não rotula valor bruto com a moeda de destino", () => {
  const rates = { USD: 1, ARS: 1500, BRL: 5 };
  assert.equal(convertCurrencyAmount(26000, "ARS", "USD", rates), 26000 / 1500);
  assert.equal(convertCurrencyAmount(100, "USD", "USD", rates), 100);
  assert.equal(convertCurrencyAmount(26000, "ARS", "USD", null), null);
});

test("validação estrita de checkouts autorizados rejeita domínios fraudulentos", async () => {
  const { isAllowedCheckout, decorateLink } = await import("../src/lib/tracker");

  // Válidos
  assert.equal(isAllowedCheckout("https://hotmart.com/pay"), true);
  assert.equal(isAllowedCheckout("https://pay.hotmart.com/checkout/123"), true);
  assert.equal(isAllowedCheckout("https://cakto.com/checkout"), true);
  assert.equal(isAllowedCheckout("https://pay.cakto.com.br/checkout"), true);
  assert.equal(isAllowedCheckout("https://meusite.com.br/quiz", "https://meusite.com.br"), true);

  // Fraudulentos / Inválidos
  assert.equal(isAllowedCheckout("https://fake-hotmart.com/pay"), false);
  assert.equal(isAllowedCheckout("https://hotmart.com.evil.com/pay"), false);
  assert.equal(isAllowedCheckout("https://evildomainhotmart.com/pay"), false);
  assert.equal(isAllowedCheckout("https://cakto.com.attacker.com"), false);
  assert.equal(isAllowedCheckout("https://outro-site.com.br/checkout"), false);
  assert.equal(isAllowedCheckout("javascript:alert(1)"), false);
  assert.equal(isAllowedCheckout("mailto:suporte@hotmart.com"), false);

  // Teste de decoração de links com UTMs e SCK
  const decorated = decorateLink(
    "https://pay.hotmart.com/ABC",
    { utm_source: "meta", utm_campaign: "camp_1" },
    "sess_xyz123",
  );
  assert.ok(decorated.includes("utm_source=meta"));
  assert.ok(decorated.includes("utm_campaign=camp_1"));
  assert.ok(decorated.includes("sck=sess_xyz123"));
  assert.ok(decorated.includes("utm_sck=sess_xyz123"));

  // Não decora links externos não autorizados
  const untouched = decorateLink(
    "https://golpista.com/checkout",
    { utm_source: "meta" },
    "sess_xyz123",
  );
  assert.equal(untouched, "https://golpista.com/checkout");
});

test("normalização de pagamentos extrai order bump, taxas e parent_transaction", () => {
  // Hotmart com order bump e taxas
  const hotmartBump = {
    id: "evt_bump",
    event: "PURCHASE_APPROVED",
    creation_date: 1724330400000,
    data: {
      product: { id: 99 },
      buyer: { email: "CLIENTE@EXAMPLE.COM", name: "Fulano de Tal", phone: "+55 (11) 99999-8888" },
      purchase: {
        transaction: "HP_BUMP_1",
        order_bump: true,
        parent_purchase_transaction: "HP_MAIN_1",
        price: { value: 29.9, currency_value: "BRL" },
        fee: { total_fee: 2.99 },
      },
    },
  };
  const rBump = normalizePayment("hotmart", hotmartBump);
  assert.equal(rBump.product_type, "order_bump");
  assert.equal(rBump.parent_transaction_id, "HP_MAIN_1");
  assert.equal(rBump.gross_amount, 29.9);
  assert.equal(rBump.fee_amount, 2.99);
  assert.equal(rBump.net_amount, 26.91);
  assert.equal(rBump.buyer_email, "CLIENTE@EXAMPLE.COM");

  // Cakto com upsell e taxas
  const caktoUpsell = {
    event: "purchase_approved",
    data: {
      id: "cakto_upsell_1",
      amount: 97.0,
      fee: 9.7,
      type: "upsell",
      parent_id: "cakto_main_1",
      product: { id: "p_up" },
      paidAt: "2024-08-22T11:39:57-03:00",
      buyer: { email: "comprador@teste.com" },
    },
  };
  const rCakto = normalizePayment("cakto", caktoUpsell, "BRL");
  assert.equal(rCakto.product_type, "upsell");
  assert.equal(rCakto.parent_transaction_id, "cakto_main_1");
  assert.equal(rCakto.gross_amount, 97.0);
  assert.equal(rCakto.fee_amount, 9.7);
  assert.equal(rCakto.net_amount, 87.3);
});

test("Meta CAPI aplica hashing SHA-256 somente em PII e preserva IP, UA, fbp e fbc brutos", async () => {
  const { normalizeCapiUserData, hashPii } = await import("../src/lib/capi-shared");

  const raw = {
    email: "Teste.Usuario@gmail.com",
    phone: "+55 (11) 98765-4321",
    firstName: "Maria",
    lastName: "Silva",
    clientIp: "189.120.45.10",
    clientUserAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    fbp: "fb.1.1680000000.123456789",
    fbc: "fb.1.1680000000.IwAR0abc123",
  };

  const normalized = normalizeCapiUserData(raw);

  // PII DEVE ser hashed com SHA-256 e em array conforme spec da Meta
  assert.deepEqual(normalized.em, [hashPii("teste.usuario@gmail.com")]);
  assert.deepEqual(normalized.ph, [hashPii("5511987654321")]);
  assert.deepEqual(normalized.fn, [hashPii("maria")]);
  assert.deepEqual(normalized.ln, [hashPii("silva")]);

  // NÃO deve ter email em texto claro
  assert.ok(!JSON.stringify(normalized).includes("Teste.Usuario@gmail.com"));

  // Dados técnicos NÃO DEVEM ser hasheados
  assert.equal(normalized.client_ip_address, "189.120.45.10");
  assert.equal(normalized.client_user_agent, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
  assert.equal(normalized.fbp, "fb.1.1680000000.123456789");
  assert.equal(normalized.fbc, "fb.1.1680000000.IwAR0abc123");
});
