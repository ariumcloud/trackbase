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

  const [arsEvent] = paymentAdapters.hotmart.normalize(
    {
      ...payload,
      data: {
        ...payload.data,
        purchase: {
          ...payload.data.purchase,
          price: { value: 26000, currency_value: "ARS" },
        },
      },
    },
    { receivedAt, fallbackCurrency: "USD" },
  );
  assert.equal(arsEvent.grossCurrency, "ARS");
});

test("Hotmart: normaliza país por nome e preserva placement sem prefixo UTM", () => {
  const [event] = paymentAdapters.hotmart.normalize(
    {
      event: "PURCHASE_APPROVED",
      id: "evt_hotmart_country_placement",
      creation_date: 1725624000000,
      data: {
        product: { id: 12345 },
        buyer: { name: "Comprador AR", checkout_country: "Argentina" },
        purchase: {
          transaction: "HP-AR-001",
          price: { value: 26000, currency_value: "ARS" },
          tracking: { placement: "instagram_reels", xcod: "s_session_ar_1" },
        },
      },
    },
    { receivedAt },
  );

  assert.equal(event.country, "AR");
  assert.equal(event.attribution.utm_placement, "instagram_reels");
  assert.equal(event.attribution.xcod, "s_session_ar_1");
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

test("Kirvano: normaliza venda aprovada com order bump (payload real, flat + products[])", () => {
  // Shape confirmed against help.kirvano.com's own webhook doc: flat root
  // (no "data" wrapper), sale_id (not id/transaction_id), a "products" array
  // bundling main + order bump in one call, each with is_order_bump and a
  // localized price string like Kirvano's own docs example ("R$ 169,80").
  const payload = {
    event: "SALE_APPROVED",
    sale_id: "KV-5544",
    customer: { name: "Comprador Kirvano", email: "kirvano@example.com", country: "BR" },
    products: [
      { id: "kirv_prod_main", offer_id: "kirv_offer_main", price: "R$ 119,90", is_order_bump: false },
      { id: "kirv_prod_2", offer_id: "kirv_offer_2", price: "R$ 49,90", is_order_bump: true },
    ],
    utm: { utm_source: "meta", utm_campaign: "upsell_camp" },
  };

  const [main, bump] = paymentAdapters.kirvano.normalize(payload, { receivedAt });
  assert.equal(main.provider, "kirvano");
  assert.equal(main.type, "purchase_approved");
  assert.equal(main.productType, "main");
  assert.equal(main.grossAmount, 119.9);
  assert.equal(main.buyer?.name, "Comprador Kirvano");
  assert.equal(main.attribution.utm_source, "meta");

  assert.equal(bump.type, "order_bump_approved");
  assert.equal(bump.productType, "order_bump");
  assert.equal(bump.grossAmount, 49.9);
  assert.equal(bump.parentTransactionId, "KV-5544");
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
  // Shape confirmed against ajuda.wiapy.com's webhook doc: status/amount/fee
  // live under "payment", not the payload root, and every amount is in
  // centavos ("R$ 17,70" -> 1770).
  const payload = {
    payment: { id: "WPY-9900", status: "paid", payment_method: "pix", amount: 24700, fee: 2470 },
    customer: { name: "Cliente Wiapy", email: "wiapy@example.com", country: "BR" },
    products: [{ id: "wpy_p1" }],
    tracking: { utm_source: "meta", utm_campaign: "direct_response" },
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

test("Status desconhecido não é contabilizado como compra aprovada", () => {
  const [event] = paymentAdapters.wiapy.normalize(
    {
      event: "status_desconhecido",
      transaction_id: "WPY-unknown",
      amount: 247,
      product: { id: "wpy_p1" },
    },
    { receivedAt },
  );
  assert.equal(event.type, "payment_pending");
});

test("Greenn: normaliza compra aprovada, order bump e comprador", () => {
  // Shape confirmed against ajuda.greenn.com.br's webhook doc: top-level
  // { type: "sale", event: "saleUpdated", oldStatus, currentStatus, product,
  // sale, seller, client }. "event" is always the fixed string "saleUpdated"
  // regardless of outcome -- the real status is "currentStatus", and the
  // sale's own id/amount/method live under "sale", not "order".
  const payload = {
    type: "sale",
    event: "saleUpdated",
    oldStatus: "waiting_payment",
    currentStatus: "paid",
    sale: {
      id: "GN-8877",
      amount: 197.0,
      fee: 19.7,
      method: "credit_card",
    },
    product: { id: "gn_prod_1", name: "Curso Avançado" },
    client: { name: "Cliente Greenn", email: "greenn@example.com", country: "BR" },
    tracking: { utm_source: "instagram", utm_campaign: "feed_leads" },
  };

  const [event] = paymentAdapters.greenn.normalize(payload, { receivedAt });
  assert.equal(event.provider, "greenn");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.grossAmount, 197);
  assert.equal(event.netAmount, 177.3);
  assert.equal(event.buyer?.name, "Cliente Greenn");
  assert.equal(event.attribution.utm_source, "instagram");
});

test("Stripe: normaliza checkout.session.completed, conversão de centavos e metadata", () => {
  const payload = {
    type: "checkout.session.completed",
    id: "evt_123456",
    data: {
      object: {
        id: "cs_test_abc123",
        payment_intent: "pi_test_789",
        amount_total: 9700,
        application_fee_amount: 970,
        currency: "usd",
        payment_status: "paid",
        customer_details: {
          name: "John Stripe",
          email: "john@stripe.test",
          address: { country: "US" },
        },
        metadata: {
          product_id: "prod_stripe_1",
          utm_source: "google_ads",
          utm_campaign: "scale_global",
        },
      },
    },
  };

  const [event] = paymentAdapters.stripe.normalize(payload, { receivedAt });
  assert.equal(event.provider, "stripe");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.grossAmount, 97);
  assert.equal(event.fees, 9.7);
  assert.equal(event.netAmount, 87.3);
  assert.equal(event.grossCurrency, "USD");
  assert.equal(event.buyer?.name, "John Stripe");
  assert.equal(event.attribution.utm_source, "google_ads");
});

test("Yampi: normaliza order.paid com comprador, itens e UTMs", () => {
  const payload = {
    event: "order.paid",
    time: "2026-09-19T18:00:00-03:00",
    resource: {
      id: 987654,
      number: "YP-100234",
      status: {
        data: {
          alias: "paid",
          name: "Pago",
        },
      },
      value_total: 199.9,
      value_tax: 5.0,
      currency: "BRL",
      customer: {
        data: {
          name: "Comprador Yampi",
          email: "comprador@yampi.com.br",
          phone: "11999999999",
        },
      },
      shipping_address: {
        data: {
          country: "BR",
          state: "SP",
          city: "São Paulo",
        },
      },
      items: {
        data: [
          {
            product_id: 12345,
            sku_id: 67890,
            item_sku: "SKU-CURSO-01",
            price: 199.9,
            sku: {
              data: {
                token: "token-oferta-123",
              },
            },
          },
        ],
      },
      utm_source: "instagram",
      utm_medium: "stories",
      utm_campaign: "campanha_natal",
      utm_content: "criativo_01",
      utm_term: "publico_lookalike",
    },
  };

  const [event] = paymentAdapters.yampi.normalize(payload, { receivedAt });
  assert.equal(event.provider, "yampi");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.externalTransactionId, "YP-100234");
  assert.equal(event.productId, "12345");
  assert.equal(event.offerId, "token-oferta-123");
  assert.equal(event.grossAmount, 199.9);
  assert.equal(event.fees, 5.0);
  assert.equal(event.netAmount, 194.9);
  assert.equal(event.grossCurrency, "BRL");
  assert.equal(event.buyer?.name, "Comprador Yampi");
  assert.equal(event.buyer?.email, "comprador@yampi.com.br");
  assert.equal(event.attribution.utm_source, "instagram");
  assert.equal(event.attribution.utm_campaign, "campanha_natal");
  assert.equal(event.attribution.utm_content, "criativo_01");
  assert.equal(event.country, "BR");
});

test("Yampi: normaliza status de reembolso e recusa", () => {
  const refundedPayload = {
    event: "order.status.updated",
    resource: {
      id: 555,
      number: "YP-REF-1",
      status: { data: { alias: "refunded" } },
      value_total: 100,
    },
  };
  const [refundEvent] = paymentAdapters.yampi.normalize(refundedPayload, { receivedAt });
  assert.equal(refundEvent.type, "purchase_refunded");

  const refusedPayload = {
    event: "transaction.payment.refused",
    resource: {
      id: 666,
      number: "YP-REFUSED-1",
      status: { data: { alias: "refused" } },
      value_total: 50,
    },
  };
  const [refusedEvent] = paymentAdapters.yampi.normalize(refusedPayload, { receivedAt });
  assert.equal(refusedEvent.type, "purchase_canceled");
});

test("Wiapy: normaliza compra aprovada, fallback de produto, tracking fbc e comprador", () => {
  const payload = {
    event: "order.approved",
    order: {
      id: "WIA-12345",
      total: 9700,
      payment: { amount: 9700, fee: 970 },
      customer: {
        name: "Cliente Wiapy",
        email: "cliente@wiapy.com",
        phone: "11999998888",
        document: "12345678901",
      },
      tracking: {
        utm_source: "google",
        utm_campaign: "search_brand",
        fbc: "fb.1.123456789.abcdef",
      },
    },
    checkout: {
      id: "chk_wiapy_999",
      title: "Checkout Produto Wiapy",
    },
  };

  const [event] = paymentAdapters.wiapy.normalize(payload, { receivedAt });
  assert.equal(event.provider, "wiapy");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.externalTransactionId, "WIA-12345");
  assert.equal(event.productId, "chk_wiapy_999");
  assert.equal(event.grossAmount, 97);
  assert.equal(event.fees, 9.7);
  assert.equal(event.netAmount, 87.3);
  assert.equal(event.country, "BR");
  assert.equal(event.buyer?.email, "cliente@wiapy.com");
  assert.equal(event.attribution.utm_source, "google");
  assert.equal(event.attribution.utm_campaign, "search_brand");
  assert.equal(event.clickId, "fb.1.123456789.abcdef");
});

test("Kirvano: normaliza eventos expirados como cancelados e calcula taxas da plataforma", () => {
  const expiredPayload = {
    event: "PIX_EXPIRED",
    id: "evt_kirvano_exp",
    sale_id: "KIRV-EXP-1",
    total: 100,
    products: [{ id: "prod_k1", name: "Curso Kirvano" }],
  };
  const [expiredEvent] = paymentAdapters.kirvano.normalize(expiredPayload, { receivedAt });
  assert.equal(expiredEvent.type, "purchase_canceled");
  assert.equal(expiredEvent.externalTransactionId, "KIRV-EXP-1");

  const approvedPayload = {
    event: "SALE_APPROVED",
    id: "evt_kirvano_app",
    sale_id: "KIRV-APP-1",
    total: 100,
    products: [{ id: "prod_k1", name: "Curso Kirvano" }],
    customer: { name: "Cliente Kirvano", email: "kirvano@example.com" },
  };
  const [approvedEvent] = paymentAdapters.kirvano.normalize(approvedPayload, { receivedAt });
  assert.equal(approvedEvent.type, "purchase_approved");
  // Taxa Kirvano: 7.49% + R$ 2,00 => (100 * 0.0749) + 2.0 = 9.49
  assert.equal(approvedEvent.fees, 9.49);
  assert.equal(approvedEvent.netAmount, 90.51);
});

test("PerfectPay: normaliza compra aprovada, reembolso, bumps e UTMs", () => {
  const payload = {
    sale_status_enum: 2,
    code: "PP-987654",
    sale_amount: 197.0,
    currency: "BRL",
    date_approved: "2026-09-19 12:00:00",
    customer: {
      full_name: "Comprador PerfectPay",
      email: "comprador@perfectpay.com.br",
      phone_number: "11988887777",
      identification_number: "12345678909",
    },
    product: {
      code: "PROD_PP_1",
      name: "Produto Digital PerfectPay",
    },
    plan: {
      code: "PLAN_PP_1",
      name: "Plano Anual",
    },
    metadata: {
      utm_source: "facebook",
      utm_medium: "cpc",
      utm_campaign: "escala_ads",
      utm_content: "video_1",
      utm_term: "interesses",
      src: "origem_campanha",
    },
  };

  const [event] = paymentAdapters.perfectpay.normalize(payload, { receivedAt });
  assert.equal(event.provider, "perfectpay");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.externalTransactionId, "PP-987654");
  assert.equal(event.productId, "PROD_PP_1");
  assert.equal(event.offerId, "PLAN_PP_1");
  assert.equal(event.grossAmount, 197);
  // Taxa PerfectPay: 5.9% + R$ 1.50 => 197 * 0.059 + 1.50 = 11.623 + 1.50 = 13.12
  assert.equal(event.fees, 13.12);
  assert.equal(event.netAmount, 183.88);
  assert.equal(event.buyer?.name, "Comprador PerfectPay");
  assert.equal(event.buyer?.email, "comprador@perfectpay.com.br");
  assert.equal(event.attribution.utm_source, "facebook");
  assert.equal(event.attribution.utm_campaign, "escala_ads");
  assert.equal(event.attribution.src, "origem_campanha");
  assert.equal(event.country, "BR");

  // Reembolso
  const [refundEvent] = paymentAdapters.perfectpay.normalize(
    { ...payload, sale_status_enum: 7 },
    { receivedAt },
  );
  assert.equal(refundEvent.type, "purchase_refunded");
});

test("Cartpanda: normaliza order.paid, order.refunded, line_items e UTMs", () => {
  const payload = {
    event: "order.paid",
    order: {
      id: 123456,
      order_number: "CP-123456",
      financial_status: "paid",
      total_price: "249.90",
      currency: "BRL",
      created_at: "2026-09-19T14:30:00Z",
      customer: {
        first_name: "Cliente",
        last_name: "Cartpanda",
        email: "cliente@cartpanda.com",
        phone: "21987654321",
        document: "98765432100",
      },
      line_items: [
        {
          id: 789,
          product_id: 456,
          variant_id: 123,
          title: "Camisa Cartpanda",
          price: "249.90",
          quantity: 1,
        },
      ],
      utm_source: "tiktok",
      utm_campaign: "viral_video",
    },
  };

  const [event] = paymentAdapters.cartpanda.normalize(payload, { receivedAt });
  assert.equal(event.provider, "cartpanda");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.externalTransactionId, "CP-123456");
  assert.equal(event.productId, "456");
  assert.equal(event.grossAmount, 249.9);
  // Taxa Cartpanda: 2.5% => 249.9 * 0.025 = 6.25
  assert.equal(event.fees, 6.25);
  assert.equal(event.netAmount, 243.65);
  assert.equal(event.buyer?.email, "cliente@cartpanda.com");
  assert.equal(event.attribution.utm_source, "tiktok");
  assert.equal(event.attribution.utm_campaign, "viral_video");

  // Reembolso
  const [refundEvent] = paymentAdapters.cartpanda.normalize(
    { ...payload, event: "order.refunded" },
    { receivedAt },
  );
  assert.equal(refundEvent.type, "purchase_refunded");
});

test("Shopify: normaliza orders/paid, note_attributes UTMs e landing_site", () => {
  const payload = {
    id: 9876543210,
    name: "#1001",
    financial_status: "paid",
    total_price: "150.00",
    currency: "BRL",
    created_at: "2026-09-19T15:00:00Z",
    landing_site: "https://minhaloja.com.br/?utm_source=instagram&utm_medium=bio&utm_campaign=lancamento&fbclid=fb_click_999",
    customer: {
      first_name: "Compradora",
      last_name: "Shopify",
      email: "compradora@shopify.com",
      phone: "+5511999991111",
      default_address: { country_code: "BR" },
    },
    line_items: [
      {
        id: 111,
        product_id: 222,
        variant_id: 333,
        title: "Vestido Floral",
        price: "150.00",
        quantity: 1,
      },
    ],
    note_attributes: [
      { name: "utm_content", value: "carrossel_1" },
    ],
  };

  const [event] = paymentAdapters.shopify.normalize(payload, { receivedAt });
  assert.equal(event.provider, "shopify");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.externalTransactionId, "9876543210");
  assert.equal(event.productId, "222");
  assert.equal(event.offerId, "333");
  assert.equal(event.grossAmount, 150);
  // Taxa Shopify: 2.0% => 150 * 0.02 = 3.0
  assert.equal(event.fees, 3.0);
  assert.equal(event.netAmount, 147.0);
  assert.equal(event.country, "BR");
  assert.equal(event.buyer?.name, "Compradora Shopify");
  assert.equal(event.buyer?.email, "compradora@shopify.com");
  assert.equal(event.attribution.utm_source, "instagram");
  assert.equal(event.attribution.utm_medium, "bio");
  assert.equal(event.attribution.utm_campaign, "lancamento");
  assert.equal(event.attribution.utm_content, "carrossel_1");
  assert.equal(event.clickId, "fb_click_999");
});

test("Shopify: refunds/create manda um recurso Refund distinto do Order, e precisa marcar a venda original como reembolsada", () => {
  // Shape real de um webhook `refunds/create` da Shopify: tem order_id (não
  // id), refund_line_items/transactions (não line_items/total_price), e
  // nenhum financial_status -- bem diferente do Order que orders/paid manda.
  const refundPayload = {
    id: 209908389,
    order_id: 9876543210, // mesmo id do pedido original em orders/paid
    created_at: "2026-09-19T16:00:00Z",
    processed_at: "2026-09-19T16:00:00Z",
    refund_line_items: [
      {
        id: 1,
        line_item_id: 111,
        subtotal: "150.00",
        total_tax: "0.00",
        line_item: {
          id: 111,
          product_id: 222,
          variant_id: 333,
          title: "Vestido Floral",
        },
      },
    ],
    transactions: [
      { id: 1, order_id: 9876543210, amount: "150.00", kind: "refund", gateway: "shopify_payments", status: "success", currency: "BRL" },
    ],
  };

  const [event] = paymentAdapters.shopify.normalize(refundPayload, { receivedAt });
  assert.equal(event.provider, "shopify");
  assert.equal(event.type, "purchase_refunded");
  // Mesmo external_transaction_id do pedido original (order.id lá == order_id aqui),
  // para o UPSERT em utm_sales atualizar a mesma linha em vez de criar outra.
  assert.equal(event.externalTransactionId, "9876543210");
  assert.equal(event.productId, "222");
  assert.equal(event.grossAmount, 150);
});

test("Ticto: normaliza v2.0 com centavos, bumps e remove 'Não Informado'", () => {
  const payload = {
    status: "authorized",
    order_id: "TICTO-888999",
    paid_amount: 19700, // em centavos => R$ 197,00
    created_at: "2026-09-19T16:00:00Z",
    customer: {
      name: "Aluno Ticto",
      email: "aluno@ticto.com.br",
      phone: "11977776666",
      cpf: "11122233344",
    },
    item: {
      product_id: 5001,
      product_name: "Mentoria Ticto",
      offer_id: 8001,
      offer_name: "Oferta Black Friday",
    },
    tracking: {
      utm_source: "google_ads",
      utm_campaign: "Não Informado", // Deve ser filtrado!
      utm_medium: "cpc",
      utm_content: "Não informado", // Deve ser filtrado!
      src: "funil_direto",
    },
  };

  const [event] = paymentAdapters.ticto.normalize(payload, { receivedAt });
  assert.equal(event.provider, "ticto");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.externalTransactionId, "TICTO-888999");
  assert.equal(event.productId, "5001");
  assert.equal(event.offerId, "8001");
  assert.equal(event.grossAmount, 197);
  // Taxa Ticto: 6.9% + R$ 2.49 => 197 * 0.069 + 2.49 = 13.593 + 2.49 = 16.08
  assert.equal(event.fees, 16.08);
  assert.equal(event.netAmount, 180.92);
  assert.equal(event.buyer?.name, "Aluno Ticto");
  assert.equal(event.buyer?.email, "aluno@ticto.com.br");
  assert.equal(event.attribution.utm_source, "google_ads");
  assert.equal(event.attribution.utm_medium, "cpc");
  assert.equal(event.attribution.src, "funil_direto");
  assert.equal(event.attribution.utm_campaign, undefined);
  assert.equal(event.attribution.utm_content, undefined);
  assert.equal(event.country, "BR");
});


