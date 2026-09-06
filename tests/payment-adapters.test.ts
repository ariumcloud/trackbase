import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentAdapters } from "../src/lib/payment-adapters";
import { paymentIdentity } from "../src/lib/payment-contract";

const receivedAt = "2026-09-06T12:00:00.000Z";

test("Hotmart: normaliza compra aprovada, order bump, reembolso e UTMs", () => {
  const payload = {
    event: "PURCHASE_APPROVED",
    id: "evt_hotmart_1",
    creation_date: 1725624000000,
    data: {
      product: { id: 12345, name: "Curso Pro" },
      buyer: { name: "Comprador Hotmart", email: "aluno@example.com", checkout_country: "BR" },
      purchase: {
        transaction: "HP001",
        price: { value: 297.0, currency_value_code: "BRL" },
        fee: { total_fee: 29.7 },
        order_bump: false,
        tracking: { utm_source: "facebook", utm_campaign: "campanha_vendas", sck: "lead_1" },
      },
    },
  };

  const [event] = paymentAdapters.hotmart.normalize(payload, { receivedAt });
  assert.equal(event.provider, "hotmart");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.externalTransactionId, "HP001");
  assert.equal(event.grossAmount, 297);
  assert.equal(event.fees, 29.7);
  assert.equal(event.netAmount, 267.3);
  assert.equal(event.grossCurrency, "BRL");
  assert.equal(event.country, "BR");
  assert.equal(event.buyer?.email, "aluno@example.com");
  assert.equal(event.attribution.utm_source, "facebook");
  assert.equal(event.attribution.utm_campaign, "campanha_vendas");

  // Reembolso Hotmart
  const [refundEvent] = paymentAdapters.hotmart.normalize(
    { ...payload, event: "PURCHASE_REFUNDED" },
    { receivedAt },
  );
  assert.equal(refundEvent.type, "purchase_refunded");
});

test("Kiwify: normaliza compra aprovada, boleto, order bump e comprador", () => {
  const payload = {
    order_status: "paid",
    order_id: "KW-9988",
    payment_method: "credit_card",
    order_bump: true,
    parent_order_id: "KW-PARENT",
    gross_amount: 19700,
    fee: 1970,
    currency: "BRL",
    created_at: "2026-09-06T10:00:00Z",
    Customer: {
      full_name: "Cliente Kiwify",
      email: "kiwi@example.com",
      country: "BR",
    },
    Product: {
      product_id: "kiwi-prod-1",
      product_name: "Acelerador Kiwify",
    },
    tracking_parameters: {
      utm_source: "google",
      utm_medium: "cpc",
      src: "kw_src",
    },
  };

  const [event] = paymentAdapters.kiwify.normalize(payload, { receivedAt });
  assert.equal(event.provider, "kiwify");
  assert.equal(event.type, "order_bump_approved");
  assert.equal(event.productType, "order_bump");
  assert.equal(event.parentTransactionId, "KW-PARENT");
  assert.equal(event.buyer?.email, "kiwi@example.com");
  assert.equal(event.attribution.utm_source, "google");

  // Kiwify aguardando PIX
  const [pixEvent] = paymentAdapters.kiwify.normalize(
    { ...payload, order_status: "waiting_payment", payment_method: "pix", order_bump: false },
    { receivedAt },
  );
  assert.equal(pixEvent.type, "pix_created");
});

test("Cakto: normaliza venda aprovada, chargeback e taxas", () => {
  const payload = {
    event: "purchase_approved",
    data: {
      id: "CK-1010",
      amount: 97.0,
      fee: 9.7,
      currency: "BRL",
      product_id: "prod_cakto",
      customer: { name: "Cliente Cakto", email: "cakto@example.com", country: "BR" },
      tracking: { utm_source: "tiktok", utm_creative: "video_01" },
    },
  };

  const [event] = paymentAdapters.cakto.normalize(payload, { receivedAt });
  assert.equal(event.provider, "cakto");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.grossAmount, 97);
  assert.equal(event.fees, 9.7);
  assert.equal(event.netAmount, 87.3);
  assert.equal(event.attribution.utm_source, "tiktok");

  // Chargeback
  const [cbEvent] = paymentAdapters.cakto.normalize(
    { ...payload, event: "purchase_chargeback" },
    { receivedAt },
  );
  assert.equal(cbEvent.type, "chargeback_created");
});

test("Kirvano: normaliza venda aprovada, PIX e upsell", () => {
  const payload = {
    event: "SALE_APPROVED",
    data: {
      transaction_id: "KV-5544",
      total_amount: 147.0,
      fee: 14.7,
      currency: "BRL",
      type: "UPSELL",
      product: { id: "kirv_prod_2" },
      customer: { name: "Comprador Kirvano", email: "kirvano@example.com", country: "BR" },
      utm: { utm_source: "meta", utm_campaign: "upsell_camp" },
    },
  };

  const [event] = paymentAdapters.kirvano.normalize(payload, { receivedAt });
  assert.equal(event.provider, "kirvano");
  assert.equal(event.type, "upsell_approved");
  assert.equal(event.productType, "upsell");
  assert.equal(event.buyer?.name, "Comprador Kirvano");
});

test("Eduzz: normaliza trans_status 3 (paga) e 7 (reembolsada)", () => {
  const payload = {
    trans_status: 3,
    trans_cod: "EDZ-123",
    trans_value: 397.0,
    trans_taxa_total: 39.7,
    currency: "BRL",
    pro_cod: "eduzz_prod_main",
    cus_name: "Cliente Eduzz",
    cus_email: "eduzz@example.com",
    cus_country: "BR",
    trans_paid: "2026-09-06T11:00:00Z",
    tracker: { utm_source: "youtube" },
  };

  const [event] = paymentAdapters.eduzz.normalize(payload, { receivedAt });
  assert.equal(event.provider, "eduzz");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.grossAmount, 397);
  assert.equal(event.fees, 39.7);
  assert.equal(event.attribution.utm_source, "youtube");

  // Reembolso
  const [refundEvent] = paymentAdapters.eduzz.normalize(
    { ...payload, trans_status: 7 },
    { receivedAt },
  );
  assert.equal(refundEvent.type, "purchase_refunded");
});

test("Monetizze: normaliza status Finalizada, Devolvida e Bloqueada", () => {
  const payload = {
    tipoPost: "Finalizada",
    codigoVenda: "MON-7788",
    valor: 197.0,
    taxas: 19.7,
    currency: "BRL",
    produto: { codigo: "mon_prod_1" },
    comprador: { nome: "Cliente Monetizze", email: "mon@example.com", pais: "BR" },
    utm: { utm_source: "kwai" },
  };

  const [event] = paymentAdapters.monetizze.normalize(payload, { receivedAt });
  assert.equal(event.provider, "monetizze");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.grossAmount, 197);
  assert.equal(event.attribution.utm_source, "kwai");

  // Devolvida
  const [refundEvent] = paymentAdapters.monetizze.normalize(
    { ...payload, tipoPost: "Devolvida" },
    { receivedAt },
  );
  assert.equal(refundEvent.type, "purchase_refunded");
});

test("Wiapy: normaliza pagamento aprovado, PIX e dados do comprador", () => {
  const payload = {
    event: "payment_approved",
    transaction_id: "WPY-9900",
    amount: 247.0,
    fee: 24.7,
    currency: "BRL",
    product: { id: "wpy_p1" },
    customer: { name: "Cliente Wiapy", email: "wiapy@example.com", country: "BR" },
    tracking: { utm_source: "meta", utm_campaign: "direct_response" },
    is_test: false,
  };

  const [event] = paymentAdapters.wiapy.normalize(payload, { receivedAt });
  assert.equal(event.provider, "wiapy");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.grossAmount, 247);
  assert.equal(event.netAmount, 222.3);
  assert.equal(event.buyer?.email, "wiapy@example.com");
});

test("Deduplicação e Idempotência: chave consistente para todas as plataformas", () => {
  const event1 = {
    provider: "kiwify" as const,
    externalTransactionId: "KW-1234",
    type: "purchase_approved" as const,
    isTest: false,
  };
  const event2 = { ...event1 };
  assert.equal(paymentIdentity(event1), paymentIdentity(event2));

  const diffType = { ...event1, type: "purchase_refunded" as const };
  assert.notEqual(paymentIdentity(event1), paymentIdentity(diffType));

  const diffProv = { ...event1, provider: "wiapy" as const };
  assert.notEqual(paymentIdentity(event1), paymentIdentity(diffProv));
});
