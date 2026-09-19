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

test("Hotmart v2.0: payload real com order_bump como objeto não deve virar order_bump_approved quando is_order_bump for false", () => {
  const payload = {
    id: "evt_hotmart_real_v2",
    creation_date: 1672531199000,
    event: "PURCHASE_APPROVED",
    version: "2.0.0",
    data: {
      product: { id: 998877, name: "Produto Principal Hotmart" },
      buyer: { name: "Maria Silva", email: "maria@example.com" },
      purchase: {
        transaction: "HP00000000000001",
        order_date: 1672531199000,
        approved_date: 1672531199000,
        status: "APPROVED",
        price: { value: 197.0, currency_value: "BRL" },
        fee: { total_fee: 19.7 },
        order_bump: {
          is_order_bump: false,
          parent_purchase_transaction: "",
        },
      },
    },
  };

  const [event] = paymentAdapters.hotmart.normalize(payload, { receivedAt });
  assert.equal(event.productType, "main");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.parentTransactionId, null);
});

test("Hotmart v2.0: payload real com order_bump como objeto e is_order_bump: true deve capturar parent_purchase_transaction dentro do objeto", () => {
  const payload = {
    id: "evt_hotmart_real_v2_bump",
    creation_date: 1672531199000,
    event: "PURCHASE_APPROVED",
    version: "2.0.0",
    data: {
      product: { id: 445566, name: "Order Bump Ebook" },
      buyer: { name: "Maria Silva", email: "maria@example.com" },
      purchase: {
        transaction: "HP00000000000002",
        order_date: 1672531199000,
        approved_date: 1672531199000,
        status: "APPROVED",
        price: { value: 47.0, currency_value: "BRL" },
        fee: { total_fee: 4.7 },
        order_bump: {
          is_order_bump: true,
          parent_purchase_transaction: "HP00000000000001",
        },
      },
    },
  };

  const [event] = paymentAdapters.hotmart.normalize(payload, { receivedAt });
  assert.equal(event.productType, "order_bump");
  assert.equal(event.type, "order_bump_approved");
  assert.equal(event.parentTransactionId, "HP00000000000001");
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

test("Kiwify: normaliza status refused como purchase_canceled e extrai clickId de src/sck", () => {
  const refusedPayload = {
    order_status: "refused",
    order_id: "KW-REFUSED-01",
    payment_method: "credit_card",
    gross_amount: 19700,
    created_at: "2026-09-19T10:00:00Z",
    Customer: {
      full_name: "Cliente Recusado",
      email: "recusado@example.com",
    },
    Product: {
      product_id: "kiwi-prod-refused",
    },
    tracking_parameters: {
      utm_source: "meta",
      src: "campanha_recusa",
      sck: "checkout_refused",
    },
  };

  const [refusedEvent] = paymentAdapters.kiwify.normalize(refusedPayload, { receivedAt });
  assert.equal(refusedEvent.type, "purchase_canceled");
  assert.equal(refusedEvent.externalTransactionId, "KW-REFUSED-01");
  assert.equal(refusedEvent.clickId, "campanha_recusa");
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

  const [cbEvent] = paymentAdapters.cakto.normalize(
    { ...payload, event: "purchase_chargeback" },
    { receivedAt },
  );
  assert.equal(cbEvent.type, "chargeback_created");
});

test("Cakto: normaliza purchase_refused como purchase_canceled, vincula parentProductId e captura clickId de src/sck", () => {
  const refusedPayload = {
    event: "purchase_refused",
    data: {
      id: "CK-REFUSED-01",
      amount: 197.0,
      fee: 19.7,
      currency: "BRL",
      offer_type: "upsell",
      parent_order: "CK-MAIN-01",
      parent_product_id: "prod_main_cakto",
      product: { id: "prod_upsell_cakto" },
      customer: { name: "Cliente Recusado", email: "recusado@cakto.com", country: "BR" },
      checkoutUrl: "https://pay.cakto.com.br/checkout?src=campanha_insta&sck=link_bio",
      tracking: { src: "campanha_insta", sck: "link_bio" },
    },
  };

  const [refusedEvent] = paymentAdapters.cakto.normalize(refusedPayload, { receivedAt });
  assert.equal(refusedEvent.provider, "cakto");
  assert.equal(refusedEvent.type, "purchase_canceled");
  assert.equal(refusedEvent.productType, "upsell");
  assert.equal(refusedEvent.parentTransactionId, "CK-MAIN-01");
  assert.equal(refusedEvent.parentProductId, "prod_main_cakto");
  assert.equal(refusedEvent.clickId, "campanha_insta");
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

test("Kirvano: venda com produto principal e 2 order bumps gera IDs distintos para cada bump e vincula parentTransactionId e parentProductId", () => {
  const payload = {
    event: "SALE_APPROVED",
    sale_id: "D2RP8RQ7",
    checkout_id: "Q8J1N6K3",
    payment_method: "CREDIT_CARD",
    total_price: "R$ 199,70",
    customer: {
      name: "João da Silva",
      document: "23875090127",
      email: "joao@example.com",
      phone_number: "5511987654321",
    },
    products: [
      {
        id: "1bb763ee-4a35-416c-a577-eb1420234be1",
        name: "Mercado de Ações no Brasil",
        offer_id: "1643bb4a-15a1-4a3c-8a61-878a13538049",
        price: "R$ 119,90",
        is_order_bump: false,
      },
      {
        id: "59f9c574-788b-44fa-81a8-45c81adeeba7",
        name: "Excel para Investidores",
        offer_id: "7c3cf544-0d35-478b-a816-909a949c5fb9",
        price: "R$ 49,90",
        is_order_bump: true,
      },
      {
        id: "8c719e7f-3a4c-47ba-9e7f-3a4cd7ba1234",
        name: "Comunidade VIP",
        offer_id: "9e7f-offer-vip",
        price: "R$ 29,90",
        is_order_bump: true,
      },
    ],
    utm: {
      src: "google",
      utm_source: "broadcast",
      utm_medium: "email",
      utm_campaign: "register",
      utm_term: "codes",
      utm_content: "link",
    },
  };

  const events = paymentAdapters.kirvano.normalize(payload, { receivedAt });
  assert.equal(events.length, 3);

  const [main, bump1, bump2] = events;
  assert.equal(main.externalTransactionId, "D2RP8RQ7");
  assert.equal(main.productId, "1bb763ee-4a35-416c-a577-eb1420234be1");
  assert.equal(main.productType, "main");
  assert.equal(main.type, "purchase_approved");
  assert.equal(main.clickId, "google");

  assert.equal(bump1.externalTransactionId, "D2RP8RQ7:59f9c574-788b-44fa-81a8-45c81adeeba7");
  assert.equal(bump1.productId, "59f9c574-788b-44fa-81a8-45c81adeeba7");
  assert.equal(bump1.productType, "order_bump");
  assert.equal(bump1.type, "order_bump_approved");
  assert.equal(bump1.parentTransactionId, "D2RP8RQ7");
  assert.equal(bump1.parentProductId, "1bb763ee-4a35-416c-a577-eb1420234be1");

  assert.equal(bump2.externalTransactionId, "D2RP8RQ7:8c719e7f-3a4c-47ba-9e7f-3a4cd7ba1234");
  assert.equal(bump2.productId, "8c719e7f-3a4c-47ba-9e7f-3a4cd7ba1234");
  assert.equal(bump2.productType, "order_bump");
  assert.equal(bump2.type, "order_bump_approved");
  assert.equal(bump2.parentTransactionId, "D2RP8RQ7");
  assert.equal(bump2.parentProductId, "1bb763ee-4a35-416c-a577-eb1420234be1");
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

test("Eduzz: normaliza trans_status 1 e 6 com PIX (7) gerando pix_created e Boleto (1) gerando boleto_created", () => {
  const pixPayload = {
    trans_status: 1, // Aberta
    trans_paymentmethod: 7, // PIX
    trans_cod: "EDZ-PIX-1",
    trans_value: 150.0,
    currency: "BRL",
    pro_cod: "eduzz_prod_pix",
    cus_name: "Cliente PIX Eduzz",
    cus_email: "pix@example.com",
    cus_country: "BR",
    trans_createdate: "2026-09-19T10:00:00Z",
    tracker_utm_source: "instagram",
    tracker_src: "instabio",
  };

  const [pixEvent] = paymentAdapters.eduzz.normalize(pixPayload, { receivedAt });
  assert.equal(pixEvent.type, "pix_created");
  assert.equal(pixEvent.externalTransactionId, "EDZ-PIX-1");
  assert.equal(pixEvent.grossAmount, 150.0);
  assert.equal(pixEvent.clickId, "instabio");

  const boletoPayload = {
    trans_status: 6, // Aguardando pagamento
    trans_paymentmethod: 1, // Boleto
    trans_cod: "EDZ-BOL-1",
    trans_value: 200.0,
    currency: "BRL",
    pro_cod: "eduzz_prod_bol",
    cus_name: "Cliente Boleto Eduzz",
    cus_email: "boleto@example.com",
    cus_country: "BR",
    trans_createdate: "2026-09-19T10:00:00Z",
  };

  const [boletoEvent] = paymentAdapters.eduzz.normalize(boletoPayload, { receivedAt });
  assert.equal(boletoEvent.type, "boleto_created");
  assert.equal(boletoEvent.externalTransactionId, "EDZ-BOL-1");
  assert.equal(boletoEvent.grossAmount, 200.0);
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

test("Monetizze: calcula taxas explicitas e taxas default de plataforma, e vincula parentProductId", () => {
  const payloadWithTaxas = {
    tipoPost: "Finalizada",
    codigoVenda: "MON-TAX-01",
    valor: 100.0,
    taxas: 9.4,
    tipo_venda: "order_bump",
    parent_codigo: "MON-PARENT-01",
    parent_produto: "mon_prod_parent",
    produto: { codigo: "mon_prod_bump" },
    comprador: { nome: "Comprador Bump", email: "bump@monetizze.com", pais: "BR" },
  };

  const [event] = paymentAdapters.monetizze.normalize(payloadWithTaxas, { receivedAt });
  assert.equal(event.provider, "monetizze");
  assert.equal(event.type, "order_bump_approved");
  assert.equal(event.productType, "order_bump");
  assert.equal(event.grossAmount, 100.0);
  assert.equal(event.fees, 9.4);
  assert.equal(event.netAmount, 90.6);
  assert.equal(event.parentTransactionId, "MON-PARENT-01");
  assert.equal(event.parentProductId, "mon_prod_parent");

  // Fallback para DEFAULT_PLATFORM_FEES (7.9% + R$ 1,50) quando taxas não vem informada
  const payloadDefaultFee = {
    tipoPost: "Finalizada",
    codigoVenda: "MON-DEF-01",
    valor: 100.0,
    produto: { codigo: "mon_prod_def" },
    comprador: { nome: "Comprador Default", email: "default@monetizze.com" },
  };

  const [defEvent] = paymentAdapters.monetizze.normalize(payloadDefaultFee, { receivedAt });
  // 100 * 0.079 + 1.50 = 9.40
  assert.equal(defEvent.fees, 9.4);
  assert.equal(defEvent.netAmount, 90.6);
});

test("Lowfy: pedido com múltiplos produtos e order bump divide em uma venda por item rateando o total", () => {
  const payload = {
    event: "order.paid",
    data: {
      id: "LOW-MULTI-100",
      status: "paid",
      total: 250.0,
      fee: 15.0,
      currency: "BRL",
      customer: {
        name: "Cliente Lowfy",
        email: "cliente@lowfy.com",
        country: "BR",
      },
      items: [
        {
          id: "item_main_1",
          product_id: "prod_main_101",
          name: "Produto Principal",
          price: 200.0,
          quantity: 1,
          is_order_bump: false,
        },
        {
          id: "item_bump_2",
          product_id: "prod_bump_102",
          name: "Order Bump",
          price: 50.0,
          quantity: 1,
          is_order_bump: true,
        },
      ],
      tracking: {
        utm_source: "google",
        utm_campaign: "pmax",
        src: "gads_src",
        sck: "sck_val",
      },
    },
  };

  const events = paymentAdapters.lowfy.normalize(payload, { receivedAt });
  assert.equal(events.length, 2);

  const [main, bump] = events;
  assert.equal(main.provider, "lowfy");
  assert.equal(main.externalTransactionId, "LOW-MULTI-100:item_main_1");
  assert.equal(main.productId, "prod_main_101");
  assert.equal(main.productType, "main");
  assert.equal(main.type, "purchase_approved");
  assert.equal(main.grossAmount, 200);
  assert.equal(main.fees, 12);
  assert.equal(main.netAmount, 188);
  assert.equal(main.clickId, "gads_src");

  assert.equal(bump.provider, "lowfy");
  assert.equal(bump.externalTransactionId, "LOW-MULTI-100:item_bump_2");
  assert.equal(bump.productId, "prod_bump_102");
  assert.equal(bump.productType, "order_bump");
  assert.equal(bump.type, "order_bump_approved");
  assert.equal(bump.grossAmount, 50);
  assert.equal(bump.fees, 3);
  assert.equal(bump.netAmount, 47);
  assert.equal(bump.parentTransactionId, "LOW-MULTI-100");
  assert.equal(bump.parentProductId, "prod_main_101");
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

test("Stripe: checkout.session.completed e charge.refunded devem compartilhar o payment_intent como externalTransactionId para não orfanar o reembolso", () => {
  const checkoutPayload = {
    type: "checkout.session.completed",
    id: "evt_checkout_123",
    data: {
      object: {
        id: "cs_test_session_abc",
        payment_intent: "pi_test_main_tx_999",
        amount_total: 10000,
        currency: "usd",
        payment_status: "paid",
        metadata: { product_id: "prod_stripe_1" },
      },
    },
  };

  const refundPayload = {
    type: "charge.refunded",
    id: "evt_refund_456",
    data: {
      object: {
        id: "ch_test_charge_xyz",
        payment_intent: "pi_test_main_tx_999",
        amount: 10000,
        amount_refunded: 10000,
        currency: "usd",
        refunded: true,
        metadata: { product_id: "prod_stripe_1" },
      },
    },
  };

  const [saleEvent] = paymentAdapters.stripe.normalize(checkoutPayload, { receivedAt });
  const [refundEvent] = paymentAdapters.stripe.normalize(refundPayload, { receivedAt });

  assert.equal(saleEvent.type, "purchase_approved");
  assert.equal(refundEvent.type, "purchase_refunded");
  // O externalTransactionId deve ser estritamente o mesmo para que o UPSERT em utm_sales
  // atualize a venda original em vez de criar uma linha órfã com id ch_...
  assert.equal(saleEvent.externalTransactionId, "pi_test_main_tx_999");
  assert.equal(refundEvent.externalTransactionId, "pi_test_main_tx_999");
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
  assert.equal(event.externalTransactionId, "YP-100234:67890");
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

test("Yampi: pedido com múltiplos produtos e order bump divide em uma venda por item rateando o total", () => {
  const payload = {
    event: "order.paid",
    resource: {
      id: 999111,
      number: "YP-MULTI-999",
      status: { data: { alias: "paid" } },
      value_total: 250.0, // R$ 250,00 total do pedido
      value_tax: 10.0,
      currency: "BRL",
      customer: {
        data: {
          name: "Comprador Yampi Multi",
          email: "yampi_multi@example.com",
        },
      },
      items: {
        data: [
          {
            product_id: 1001,
            sku_id: 5001,
            price: 200.0,
            quantity: 1,
            is_order_bump: false,
          },
          {
            product_id: 1002,
            sku_id: 5002,
            price: 50.0,
            quantity: 1,
            is_order_bump: true,
          },
        ],
      },
      utm_source: "google",
      utm_campaign: "performance_max",
    },
  };

  const events = paymentAdapters.yampi.normalize(payload, { receivedAt });
  assert.equal(events.length, 2);

  const [main, bump] = events;
  assert.equal(main.externalTransactionId, "YP-MULTI-999:5001");
  assert.equal(main.productId, "1001");
  assert.equal(main.productType, "main");
  assert.equal(main.type, "purchase_approved");
  assert.equal(main.grossAmount, 200);

  assert.equal(bump.externalTransactionId, "YP-MULTI-999:5002");
  assert.equal(bump.productId, "1002");
  assert.equal(bump.productType, "order_bump");
  assert.equal(bump.type, "order_bump_approved");
  assert.equal(bump.grossAmount, 50);
  assert.equal(bump.parentTransactionId, "YP-MULTI-999");
  assert.equal(bump.parentProductId, "1001");

  // A soma dos dois itens precisa bater com o total do pedido (R$ 250,00)
  assert.equal(main.grossAmount + bump.grossAmount, 250);
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

test("Wiapy: compra com produto principal e order bump divide em uma venda por item rateando o total", () => {
  const payload = {
    order: {
      id: "WPY-MULTI-100",
      total: 12600, // R$ 126,00 em centavos
      payment: {
        id: "PAY-WPY-999",
        status: "paid",
        payment_method: "credit_card",
        amount: 12600,
        fee: 1260,
      },
      customer: {
        name: "Comprador Wiapy Multi",
        email: "multi@wiapy.com",
        country: "BR",
      },
      products: [
        {
          id: "prod_main_course",
          title: "Curso Principal",
          price: 9700, // R$ 97,00
          is_order_bump: false,
        },
        {
          id: "prod_bump_ebook",
          title: "Ebook Adicional",
          price: 2900, // R$ 29,00
          is_order_bump: true,
        },
      ],
      tracking: {
        utm_source: "instagram",
        utm_campaign: "feed",
      },
    },
  };

  const events = paymentAdapters.wiapy.normalize(payload, { receivedAt });
  assert.equal(events.length, 2);

  const [main, bump] = events;
  assert.equal(main.externalTransactionId, "PAY-WPY-999:prod_main_course");
  assert.equal(main.productId, "prod_main_course");
  assert.equal(main.productType, "main");
  assert.equal(main.type, "purchase_approved");
  assert.equal(main.grossAmount, 97);

  assert.equal(bump.externalTransactionId, "PAY-WPY-999:prod_bump_ebook");
  assert.equal(bump.productId, "prod_bump_ebook");
  assert.equal(bump.productType, "order_bump");
  assert.equal(bump.type, "order_bump_approved");
  assert.equal(bump.grossAmount, 29);
  assert.equal(bump.parentTransactionId, "PAY-WPY-999");
  assert.equal(bump.parentProductId, "prod_main_course");

  // A soma dos dois itens precisa bater com o total do pedido (R$ 126,00)
  assert.equal(main.grossAmount + bump.grossAmount, 126);
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

test("PerfectPay: normaliza order bump com vínculo de parentTransactionId, parentProductId e tracking flat/clickId", () => {
  const bumpPayload = {
    sale_status_enum: 2,
    code: "PP-BUMP-123",
    payment_format_enum_key: "orderbump",
    parent_sale_code: "PP-MAIN-001",
    parent_product_code: "PROD_MAIN_PP",
    sale_amount: 47.0,
    customer: {
      full_name: "Comprador Bump",
      email: "bump@perfectpay.com.br",
    },
    product: {
      code: "PROD_BUMP_PP",
      name: "Ebook Adicional",
    },
    // PerfectPay costuma enviar parâmetros flat em postback
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "search_camp",
    gclid: "gclid_pp_999",
    sck: "sck_insta",
  };

  const [event] = paymentAdapters.perfectpay.normalize(bumpPayload, { receivedAt });
  assert.equal(event.provider, "perfectpay");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.externalTransactionId, "PP-BUMP-123");
  assert.equal(event.productId, "PROD_BUMP_PP");
  assert.equal(event.productType, "order_bump");
  assert.equal(event.parentTransactionId, "PP-MAIN-001");
  assert.equal(event.parentProductId, "PROD_MAIN_PP");
  assert.equal(event.clickId, "gclid_pp_999");
  assert.equal(event.attribution.utm_source, "google");
  assert.equal(event.attribution.sck, "sck_insta");
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
  assert.equal(event.externalTransactionId, "CP-123456:789");
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

test("Cartpanda: pedido com múltiplos produtos no carrinho divide em uma venda por item rateando o total", () => {
  const payload = {
    event: "order.paid",
    order: {
      id: 888111,
      order_number: "CP-888111",
      financial_status: "paid",
      total_price: "300.00",
      currency: "BRL",
      created_at: "2026-09-19T14:30:00Z",
      customer: {
        first_name: "Cliente",
        last_name: "Multi",
        email: "multi@cartpanda.com",
      },
      line_items: [
        {
          id: 101,
          product_id: 201,
          variant_id: 301,
          title: "Produto 1",
          price: "100.00",
          quantity: 1,
        },
        {
          id: 102,
          product_id: 202,
          variant_id: 302,
          title: "Produto 2",
          price: "100.00",
          quantity: 2,
        },
      ],
    },
  };

  const events = paymentAdapters.cartpanda.normalize(payload, { receivedAt });
  assert.equal(events.length, 2);

  const [item1, item2] = events;
  assert.equal(item1.externalTransactionId, "CP-888111:101");
  assert.equal(item1.productId, "201");
  assert.equal(item1.grossAmount, 100);

  assert.equal(item2.externalTransactionId, "CP-888111:102");
  assert.equal(item2.productId, "202");
  assert.equal(item2.grossAmount, 200);

  // Soma dos itens bate com o total do pedido (R$ 300,00)
  assert.equal(item1.grossAmount + item2.grossAmount, 300);
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
  // Sufixado pelo item (order:line_item) para não colidir com outros
  // produtos do mesmo pedido -- ver teste de pedido com múltiplos itens.
  assert.equal(event.externalTransactionId, "9876543210:111");
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
  // Mesmo external_transaction_id (order:line_item) da venda original,
  // para o UPSERT em utm_sales atualizar aquela linha em vez de criar outra.
  assert.equal(event.externalTransactionId, "9876543210:111");
  assert.equal(event.productId, "222");
  assert.equal(event.grossAmount, 150);
});

test("Shopify: pedido com 2 produtos diferentes vira 2 vendas, cada uma com seu produto e sua fatia do total", () => {
  const payload = {
    id: 555000111,
    financial_status: "paid",
    total_price: "300.00",
    currency: "BRL",
    created_at: "2026-09-19T15:00:00Z",
    customer: { first_name: "Compradora", last_name: "Multi", email: "multi@shopify.com" },
    line_items: [
      { id: 11, product_id: 100, variant_id: 1000, title: "Camiseta", price: "100.00", quantity: 1 },
      { id: 12, product_id: 200, variant_id: 2000, title: "Boné", price: "100.00", quantity: 2 },
    ],
  };

  const events = paymentAdapters.shopify.normalize(payload, { receivedAt });
  assert.equal(events.length, 2);

  const [shirt, cap] = events;
  assert.equal(shirt.externalTransactionId, "555000111:11");
  assert.equal(shirt.productId, "100");
  assert.equal(shirt.grossAmount, 100);

  assert.equal(cap.externalTransactionId, "555000111:12");
  assert.equal(cap.productId, "200");
  assert.equal(cap.grossAmount, 200);

  // As duas fatias somam o total do pedido, nenhuma receita perdida nem duplicada.
  assert.equal(shirt.grossAmount + cap.grossAmount, 300);
});

test("Shopify: normaliza clickId com gclid, ttclid e _fbc, e vincula order bump via properties do line_item", () => {
  const payload = {
    id: 777000222,
    financial_status: "paid",
    total_price: "200.00",
    currency: "BRL",
    created_at: "2026-09-19T15:00:00Z",
    landing_site: "https://minhaloja.com.br/?utm_source=google&utm_medium=cpc&gclid=gclid_shopify_999",
    customer: { first_name: "Ana", last_name: "Silva", email: "ana@shopify.com" },
    note_attributes: [
      { name: "_fbc", value: "fb.1.12345.67890" },
      { name: "sck", value: "campanha_gads" },
    ],
    line_items: [
      {
        id: 101,
        product_id: 1001,
        title: "Kit Principal",
        price: "150.00",
        quantity: 1,
      },
      {
        id: 102,
        product_id: 2002,
        title: "Garantia Estendida (Bump)",
        price: "50.00",
        quantity: 1,
        properties: [
          { name: "_is_bump", value: "true" },
          { name: "_parent_product_id", value: "1001" },
        ],
      },
    ],
  };

  const [main, bump] = paymentAdapters.shopify.normalize(payload, { receivedAt });
  assert.equal(main.clickId, "gclid_shopify_999");
  assert.equal(main.attribution.sck, "campanha_gads");
  assert.equal(main.productType, "main");

  assert.equal(bump.productType, "order_bump");
  assert.equal(bump.parentProductId, "1001");
  assert.equal(bump.parentTransactionId, "777000222:101");
  assert.equal(bump.clickId, "gclid_shopify_999");
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

test("Ticto: pedido com produto principal e order bump não deve duplicar o faturamento no evento principal", () => {
  const payload = {
    status: "approved",
    order: {
      order_id: "TICTO-ORDER-100",
      paid_amount: 15000, // Total pago pelo cliente = R$ 150,00
      order_date: "2026-09-19T17:00:00Z",
    },
    customer: {
      name: "Comprador Ticto",
      email: "comprador@ticto.com.br",
    },
    item: {
      product_id: 101,
      product_name: "Curso Principal",
      offer_id: 201,
      amount: 10000, // Item principal = R$ 100,00
    },
    bumps: [
      {
        product_id: 301,
        product_name: "Order Bump Ebook",
        offer_id: 401,
        offer_price: 5000, // Bump = R$ 50,00
      },
    ],
  };

  const events = paymentAdapters.ticto.normalize(payload, { receivedAt });
  assert.equal(events.length, 2);

  const [main, bump] = events;
  assert.equal(main.productType, "main");
  assert.equal(main.grossAmount, 100); // Deve ser 100, NÃO 150!
  assert.equal(bump.productType, "order_bump");
  assert.equal(bump.grossAmount, 50);

  // A soma dos eventos deve ser exatamente o total pago (R$ 150,00), sem superfaturamento
  assert.equal(main.grossAmount + bump.grossAmount, 150);
});


test("Greenn: normaliza webhook com saleMetas, currentSale, taxas padrão e UTMs", () => {
  const payload = {
    type: "sale",
    event: "saleUpdated",
    currentStatus: "paid",
    currentSale: {
      id: "grn_sale_9876",
      amount: 297.0,
      method: "credit_card",
      created_at: "2026-09-19T14:00:00Z",
    },
    client: {
      name: "Comprador Greenn",
      email: "cliente@greenn.com.br",
    },
    product: {
      id: "grn_prod_123",
      name: "Formação Digital",
    },
    saleMetas: [
      { meta_key: "utm_source", meta_value: "facebook" },
      { meta_key: "utm_medium", meta_value: "cpc" },
      { meta_key: "utm_campaign", meta_value: "campanha_escala" },
      { meta_key: "fbclid", meta_value: "fb_click_123" },
    ],
  };

  const [event] = paymentAdapters.greenn.normalize(payload, { receivedAt });
  assert.equal(event.provider, "greenn");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.externalTransactionId, "grn_sale_9876");
  assert.equal(event.productId, "grn_prod_123");
  assert.equal(event.grossAmount, 297);
  // Taxa padrão Greenn: 4.99% + R$ 1.00 => 297 * 0.0499 + 1.00 = 14.8203 + 1.00 = 15.82
  assert.equal(event.fees, 15.82);
  assert.equal(event.netAmount, 281.18);
  assert.equal(event.buyer?.name, "Comprador Greenn");
  assert.equal(event.buyer?.email, "cliente@greenn.com.br");
  assert.equal(event.attribution.utm_source, "facebook");
  assert.equal(event.attribution.utm_medium, "cpc");
  assert.equal(event.attribution.utm_campaign, "campanha_escala");
  assert.equal(event.clickId, "fb_click_123");
});

test("Greenn: normaliza order bump com vínculo de parentTransactionId, parentProductId e clickId", () => {
  const bumpPayload = {
    type: "sale",
    event: "saleUpdated",
    currentStatus: "paid",
    sale: {
      id: "grn_sale_bump_456",
      amount: 47.0,
      method: "credit_card",
      is_order_bump: true,
      parent_sale_id: "grn_sale_main_100",
      parent_product_id: "grn_prod_main_50",
    },
    client: {
      name: "Comprador Bump",
      email: "bump@greenn.com.br",
    },
    product: {
      id: "grn_prod_bump_99",
      name: "Ebook Adicional",
    },
    saleMetas: [
      { meta_key: "gclid", meta_value: "gclid_greenn_test_123" },
      { meta_key: "sck", meta_value: "sck_greenn_origem" },
    ],
  };

  const [bumpEvent] = paymentAdapters.greenn.normalize(bumpPayload, { receivedAt });
  assert.equal(bumpEvent.provider, "greenn");
  assert.equal(bumpEvent.type, "purchase_approved");
  assert.equal(bumpEvent.externalTransactionId, "grn_sale_bump_456");
  assert.equal(bumpEvent.productId, "grn_prod_bump_99");
  assert.equal(bumpEvent.productType, "order_bump");
  assert.equal(bumpEvent.parentTransactionId, "grn_sale_main_100");
  assert.equal(bumpEvent.parentProductId, "grn_prod_main_50");
  assert.equal(bumpEvent.clickId, "gclid_greenn_test_123");

  const upsellPayload = {
    type: "sale",
    event: "saleUpdated",
    currentStatus: "paid",
    sale: {
      id: "grn_sale_upsell_789",
      amount: 97.0,
      method: "credit_card",
      type: "upsell",
      parent_sale_id: "grn_sale_main_100",
      parent_product_id: "grn_prod_main_50",
    },
    product: { id: "grn_prod_upsell_88" },
    client: { name: "Comprador Upsell", email: "upsell@greenn.com.br" },
  };

  const [upsellEvent] = paymentAdapters.greenn.normalize(upsellPayload, { receivedAt });
  assert.equal(upsellEvent.productType, "upsell");
  assert.equal(upsellEvent.parentTransactionId, "grn_sale_main_100");
  assert.equal(upsellEvent.parentProductId, "grn_prod_main_50");
});

test("Monetizze: normaliza status 6 (completa) e postback com chave_unica e formaPagamento", () => {
  const payload = {
    chave_unica: "chave_monetizze_abc",
    tipoPost: "6", // Completa
    produto: {
      codigo: "prod_mon_55",
      nome: "Ebook Monetizze",
    },
    venda: {
      codigo: "venda_9988",
      valor: "97.00",
      valorRecebido: "87.84",
      dataFinalizada: "2026-09-19T14:30:00Z",
      utm_source: "google",
      utm_medium: "search",
      utm_campaign: "fundo_de_funil",
      src: "track_src_1",
    },
    comprador: {
      nome: "Comprador Monetizze",
      email: "aluno@monetizze.com.br",
      pais: "BR",
    },
  };

  const [event] = paymentAdapters.monetizze.normalize(payload, { receivedAt });
  assert.equal(event.provider, "monetizze");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.externalTransactionId, "venda_9988");
  assert.equal(event.externalEventId, "chave_monetizze_abc");
  assert.equal(event.productId, "prod_mon_55");
  assert.equal(event.grossAmount, 97);
  assert.equal(event.netAmount, 87.84);
  assert.equal(event.fees, 9.16);
  assert.equal(event.buyer?.name, "Comprador Monetizze");
  assert.equal(event.attribution.utm_source, "google");
  assert.equal(event.attribution.utm_campaign, "fundo_de_funil");
  assert.equal(event.clickId, "track_src_1");

  // Testar status 1 com PIX
  const [pixEvent] = paymentAdapters.monetizze.normalize(
    {
      ...payload,
      tipoPost: "1",
      venda: { ...payload.venda, formaPagamento: "PIX" },
    },
    { receivedAt },
  );
  assert.equal(pixEvent.type, "pix_created");
});

test("Lastlink: normaliza Purchase_Order_Confirmed com order bump, taxas e UTMs normalizadas", () => {
  const payload = {
    Id: "evt_lastlink_001",
    IsTest: false,
    Event: "Purchase_Order_Confirmed",
    CreatedAt: "2026-09-19T17:00:00Z",
    Data: {
      Purchase: {
        Id: "pur_lastlink_123",
        TransactionId: "LL-TX-9999",
        Total: 247.0,
        PaymentMethod: "CREDIT_CARD",
        ApprovedAt: "2026-09-19T17:01:00Z",
      },
      Buyer: {
        Name: "Membro VIP",
        Email: "membro@lastlink.com",
        Country: "BR",
      },
      Offer: {
        Id: "off_principal",
        Name: "Comunidade Exclusiva",
      },
      Products: [
        {
          Id: "prod_main_01",
          Name: "Acesso Comunidade Anual",
          Price: 197.0,
          IsOrderBump: false,
        },
        {
          Id: "prod_bump_02",
          Name: "Masterclass Bônus",
          Price: 50.0,
          IsOrderBump: true,
        },
      ],
      Utm: {
        UtmSource: "instagram",
        UtmMedium: "stories",
        UtmCampaign: "arrasta_cima",
        UtmContent: "story_1",
        Src: "ig_stories",
      },
    },
  };

  const events = paymentAdapters.lastlink.normalize(payload, { receivedAt });
  assert.equal(events.length, 2);

  const [main, bump] = events;
  assert.equal(main.provider, "lastlink");
  assert.equal(main.type, "purchase_approved");
  assert.equal(main.externalTransactionId, "LL-TX-9999");
  assert.equal(main.productId, "prod_main_01");
  assert.equal(main.productType, "main");
  assert.equal(main.grossAmount, 197);
  // Taxa Lastlink item principal: 8.9% + R$ 1.50 => 197 * 0.089 + 1.50 = 17.533 + 1.50 = 19.03
  assert.equal(main.fees, 19.03);
  assert.equal(main.netAmount, 177.97);
  assert.equal(main.buyer?.name, "Membro VIP");
  assert.equal(main.buyer?.email, "membro@lastlink.com");
  assert.equal(main.attribution.utm_source, "instagram");
  assert.equal(main.attribution.utm_medium, "stories");
  assert.equal(main.attribution.utm_campaign, "arrasta_cima");
  assert.equal(main.attribution.utm_content, "story_1");
  assert.equal(main.clickId, "ig_stories");

  assert.equal(bump.provider, "lastlink");
  assert.equal(bump.type, "order_bump_approved");
  assert.equal(bump.externalTransactionId, "LL-TX-9999-bump-1");
  assert.equal(bump.productId, "prod_bump_02");
  assert.equal(bump.productType, "order_bump");
  assert.equal(bump.grossAmount, 50);
  // Taxa Lastlink bump: 8.9% => 50 * 0.089 = 4.45
  assert.equal(bump.fees, 4.45);
  assert.equal(bump.netAmount, 45.55);
  assert.equal(bump.parentProductId, "prod_main_01");
  assert.equal(bump.parentTransactionId, "LL-TX-9999");

  // Reembolso
  const [refundEvent] = paymentAdapters.lastlink.normalize(
    { ...payload, Event: "Payment_Refund" },
    { receivedAt },
  );
  assert.equal(refundEvent.type, "purchase_refunded");
});

test("Lastlink: normaliza Purchase_Order_Generated com PIX e Boleto, e extrai clickId de Gclid", () => {
  const pixPayload = {
    Id: "evt_lastlink_pix_01",
    Event: "Purchase_Order_Generated",
    Data: {
      Purchase: {
        Id: "pur_ll_pix_1",
        TransactionId: "LL-PIX-123",
        Total: 97.0,
        PaymentMethod: "PIX",
      },
      Buyer: {
        Name: "Comprador Pix",
        Email: "pix@lastlink.com",
      },
      Offer: {
        Id: "off_pix",
      },
      Utm: {
        Gclid: "gclid_lastlink_12345",
        Sck: "sck_origem_ll",
      },
    },
  };

  const [pixEvent] = paymentAdapters.lastlink.normalize(pixPayload, { receivedAt });
  assert.equal(pixEvent.provider, "lastlink");
  assert.equal(pixEvent.type, "pix_created");
  assert.equal(pixEvent.clickId, "gclid_lastlink_12345");
  assert.equal(pixEvent.attribution.sck, "sck_origem_ll");

  const boletoPayload = {
    Id: "evt_lastlink_bol_01",
    Event: "Purchase_Order_Generated",
    Data: {
      Purchase: {
        Id: "pur_ll_bol_1",
        TransactionId: "LL-BOL-456",
        Total: 150.0,
        PaymentMethod: "BOLETO",
      },
      Buyer: { Name: "Comprador Boleto", Email: "boleto@lastlink.com" },
      Offer: { Id: "off_bol" },
    },
  };

  const [boletoEvent] = paymentAdapters.lastlink.normalize(boletoPayload, { receivedAt });
  assert.equal(boletoEvent.type, "boleto_created");
});

test("Hubla: normaliza webhook v2 com invoice.payment_succeeded, totalCents, receivers e cookies UTM", () => {
  const payload = {
    type: "invoice.payment_succeeded",
    version: "2.0.0",
    event: {
      product: {
        id: "hubla_prd_777",
        name: "Clube de Assinaturas",
      },
      invoice: {
        id: "inv_hubla_888",
        status: "paid",
        paymentMethod: "credit_card",
        currency: "BRL",
        amount: {
          totalCents: 9700, // R$ 97,00
          subtotalCents: 9700,
        },
        receivers: [
          {
            role: "platform",
            totalCents: 1112, // R$ 11,12 de taxa retida pela Hubla
          },
          {
            role: "seller",
            totalCents: 8588, // R$ 85,88 líquido do produtor
          },
        ],
        payer: {
          firstName: "João",
          lastName: "Silva",
          email: "joao.silva@hubla.com",
        },
        billingAddress: {
          countryCode: "BR",
        },
        paymentSession: {
          cookies: {
            fbclid: "fb_hubla_click_999",
            fbp: "fb.1.12345.67890",
          },
          utm: {
            source: "meta_ads",
            medium: "feed",
            campaign: "black_november",
            content: "video_criativo_3",
            term: "publico_lookalike",
          },
          params: {
            SCK: "sck_hubla_1",
          },
        },
      },
    },
  };

  const [event] = paymentAdapters.hubla.normalize(payload, { receivedAt });
  assert.equal(event.provider, "hubla");
  assert.equal(event.type, "purchase_approved");
  assert.equal(event.externalTransactionId, "inv_hubla_888");
  assert.equal(event.productId, "hubla_prd_777");
  assert.equal(event.grossAmount, 97);
  assert.equal(event.fees, 11.12);
  assert.equal(event.netAmount, 85.88);
  assert.equal(event.buyer?.name, "João Silva");
  assert.equal(event.buyer?.email, "joao.silva@hubla.com");
  assert.equal(event.attribution.utm_source, "meta_ads");
  assert.equal(event.attribution.utm_medium, "feed");
  assert.equal(event.attribution.utm_campaign, "black_november");
  assert.equal(event.attribution.utm_content, "video_criativo_3");
  assert.equal(event.attribution.utm_term, "publico_lookalike");
  assert.equal(event.clickId, "fb_hubla_click_999");

  // Fatura criada com PIX
  const [pixEvent] = paymentAdapters.hubla.normalize(
    {
      type: "invoice.created",
      event: {
        ...payload.event,
        invoice: {
          ...payload.event.invoice,
          status: "unpaid",
          paymentMethod: "pix",
        },
      },
    },
    { receivedAt },
  );
  assert.equal(pixEvent.type, "pix_created");
});

test("Hubla: normaliza evento subscription.canceled como purchase_canceled", () => {
  const payload = {
    type: "subscription.canceled",
    id: "evt_sub_canc_123",
    event: {
      subscription: {
        id: "sub_hubla_999",
        status: "canceled",
        productId: "hubla_prd_sub_1",
      },
      user: {
        name: "Carlos Cancelado",
        email: "carlos@hubla.com",
      },
    },
  };

  const [event] = paymentAdapters.hubla.normalize(payload, { receivedAt });
  assert.equal(event.provider, "hubla");
  assert.equal(event.type, "purchase_canceled");
  assert.equal(event.externalTransactionId, "sub_hubla_999");
  assert.equal(event.productId, "hubla_prd_sub_1");
  assert.equal(event.buyer?.name, "Carlos Cancelado");
  assert.equal(event.buyer?.email, "carlos@hubla.com");
});


