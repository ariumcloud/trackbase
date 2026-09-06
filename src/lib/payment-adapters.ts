import {
  normalizedPaymentEventSchema,
  redactPaymentPayload,
  type PaymentAdapter,
  type PaymentEventType,
  type PaymentProvider,
} from "./payment-contract";

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const str = (v: unknown): string =>
  typeof v === "string" || typeof v === "number" ? String(v).trim() : "";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const parseDate = (v: unknown, fallback: string): string => {
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v.trim());
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return fallback;
};

const extractAttribution = (raw: unknown): Record<string, string> => {
  const obj = record(raw);
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase();
    if (
      key.startsWith("utm_") ||
      ["src", "sck", "source_sck", "fbclid", "fbp", "fbc", "gclid", "ttclid"].includes(key)
    ) {
      if (typeof v === "string" || typeof v === "number") {
        result[key] = String(v).slice(0, 300);
      }
    }
  }
  return result;
};

const cleanCurrency = (raw: unknown, fallback: string = "BRL"): string => {
  const s = str(raw).toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : fallback;
};

const cleanCountry = (raw: unknown): string | null => {
  const s = str(raw).toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
};

// 1. ADAPTADOR HOTMART
export const hotmartAdapter: PaymentAdapter = {
  provider: "hotmart",
  normalize(payload, context) {
    const root = record(payload);
    const data = record(root.data);
    const purchase = record(data.purchase);
    const price = record(purchase.price);
    const feeObj = record(purchase.fee);
    const buyer = record(data.buyer);
    const product = record(data.product);
    const tracking = record(purchase.tracking);

    const event = str(root.event).toUpperCase();
    const isOrderBump = Boolean(purchase.order_bump);
    const isUpsell = str(purchase.type).toLowerCase() === "upsell";
    const isDownsell = str(purchase.type).toLowerCase() === "downsell";

    let type: PaymentEventType = "purchase_approved";
    if (["PURCHASE_APPROVED", "PURCHASE_COMPLETE"].includes(event)) {
      if (isOrderBump) type = "order_bump_approved";
      else if (isUpsell) type = "upsell_approved";
      else if (isDownsell) type = "downsell_approved";
      else type = "purchase_approved";
    } else if (event === "PURCHASE_REFUNDED" || event === "PURCHASE_PARTIAL_REFUND") {
      type = "purchase_refunded";
    } else if (event === "PURCHASE_CHARGEBACK") {
      type = "chargeback_created";
    } else if (event === "PURCHASE_CANCELED" || event === "PURCHASE_CANCELLED") {
      type = "purchase_canceled";
    } else if (event === "PURCHASE_EXPIRED") {
      type = "purchase_expired";
    } else if (event === "PIX_GENERATED") {
      type = "pix_created";
    } else if (event === "PURCHASE_BILLET_PRINTED" || event === "PURCHASE_DELAYED") {
      type = "boleto_created";
    } else if (event.includes("SUBSCRIPTION") && event.includes("CANCEL")) {
      type = "subscription_canceled";
    }

    const transaction = str(purchase.transaction) || str(root.id) || "unknown_tx";
    const gross = num(price.value) ?? num(data.amount) ?? 0;
    const fee = num(feeObj.total_fee) ?? num(feeObj.fixed_fee) ?? 0;
    const net = Math.max(0, Math.round((gross - fee) * 100) / 100);

    const productType = isOrderBump ? "order_bump" : isUpsell ? "upsell" : isDownsell ? "downsell" : "main";
    const productId = str(product.id) || str(purchase.product_id) || str(data.product_id) || "prod";

    return [
      normalizedPaymentEventSchema.parse({
        provider: "hotmart",
        externalTransactionId: transaction,
        externalEventId: str(root.id) || null,
        type,
        productId,
        offerId: str(purchase.offer_code) || str(data.offer_code) || null,
        productType,
        parentProductId: null,
        parentTransactionId: str(purchase.parent_purchase_transaction) || null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(price.currency_code_value || price.currency_value_code, context.fallbackCurrency),
        netCurrency: cleanCurrency(price.currency_code_value || price.currency_value_code, context.fallbackCurrency),
        country: cleanCountry(buyer.checkout_country || buyer.country),
        buyer: {
          name: str(buyer.name) || null,
          email: str(buyer.email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid) || null,
        occurredAt: parseDate(root.creation_date || purchase.approved_date || purchase.order_date, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: Boolean(data.is_test || root.is_test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// 2. ADAPTADOR KIWIFY
export const kiwifyAdapter: PaymentAdapter = {
  provider: "kiwify",
  normalize(payload, context) {
    const root = record(payload);
    const order = record(root.Order);
    const commissions = record(root.Commissions || order.Commissions);
    const customer = record(root.Customer || order.Customer);
    const product = record(root.Product || order.Product);
    const tracking = record(root.tracking_parameters || order.tracking_parameters);

    const status = str(root.order_status || order.order_status).toLowerCase();
    const paymentMethod = str(root.payment_method || order.payment_method).toLowerCase();
    const isBump = Boolean(root.order_bump || order.order_bump);
    const isUpsell = Boolean(root.upsell || order.upsell);

    let type: PaymentEventType = "purchase_approved";
    if (status === "paid") {
      if (isBump) type = "order_bump_approved";
      else if (isUpsell) type = "upsell_approved";
      else type = "purchase_approved";
    } else if (status === "refunded") {
      type = "purchase_refunded";
    } else if (status === "chargedback" || status === "chargeback") {
      type = "chargeback_created";
    } else if (status === "canceled" || status === "cancelled") {
      type = "purchase_canceled";
    } else if (status === "expired") {
      type = "purchase_expired";
    } else if (status === "waiting_payment") {
      if (paymentMethod === "pix") type = "pix_created";
      else if (paymentMethod === "boleto") type = "boleto_created";
      else type = "payment_pending";
    }

    const transaction = str(root.order_id || order.order_id) || str(root.id) || "kiwify_tx";
    const gross = (num(commissions.charge_amount) ?? num(root.gross_amount) ?? num(order.gross_amount) ?? 0) / (commissions.charge_amount ? 100 : 1);
    const fee = (num(commissions.kiwify_fee) ?? num(root.fee) ?? 0) / (commissions.kiwify_fee ? 100 : 1);
    const net = Math.max(0, Math.round((gross - fee) * 100) / 100);

    const productType = isBump ? "order_bump" : isUpsell ? "upsell" : "main";
    const productId = str(product.product_id || root.product_id || order.product_id) || "prod";

    return [
      normalizedPaymentEventSchema.parse({
        provider: "kiwify",
        externalTransactionId: transaction,
        externalEventId: str(root.event_id) || null,
        type,
        productId,
        offerId: str(product.offer_id || root.offer_id) || null,
        productType,
        parentProductId: null,
        parentTransactionId: str(root.parent_order_id || order.parent_order_id) || null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(commissions.currency || root.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(commissions.currency || root.currency, context.fallbackCurrency),
        country: cleanCountry(customer.country),
        buyer: {
          name: str(customer.full_name || customer.name) || null,
          email: str(customer.email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid) || null,
        occurredAt: parseDate(root.paid_at || root.created_at || order.created_at, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: Boolean(root.is_test || order.is_test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// 3. ADAPTADOR CAKTO
export const caktoAdapter: PaymentAdapter = {
  provider: "cakto",
  normalize(payload, context) {
    const root = record(payload);
    const data = record(root.data);
    const customer = record(data.customer);
    const tracking = record(data.tracking);

    const event = str(root.event).toLowerCase();
    const isBump = Boolean(data.order_bump || str(data.type).toLowerCase().includes("bump"));
    const isUpsell = str(data.type).toLowerCase().includes("upsell");
    const isDownsell = str(data.type).toLowerCase().includes("downsell");

    let type: PaymentEventType = "purchase_approved";
    if (["purchase_approved", "purchase_complete", "paid"].includes(event)) {
      if (isBump) type = "order_bump_approved";
      else if (isUpsell) type = "upsell_approved";
      else if (isDownsell) type = "downsell_approved";
      else type = "purchase_approved";
    } else if (event.includes("refund")) {
      type = "purchase_refunded";
    } else if (event.includes("chargeback")) {
      type = "chargeback_created";
    } else if (event.includes("cancel")) {
      type = "purchase_canceled";
    } else if (event.includes("pix")) {
      type = "pix_created";
    } else if (event.includes("billet") || event.includes("boleto")) {
      type = "boleto_created";
    } else {
      type = "payment_pending";
    }

    const transaction = str(data.id || root.id || data.transaction_id) || "cakto_tx";
    const gross = num(data.amount) ?? num(data.gross_amount) ?? 0;
    const fee = num(data.fee) ?? num(data.fees) ?? 0;
    const net = Math.max(0, Math.round((gross - fee) * 100) / 100);

    const productType = isBump ? "order_bump" : isUpsell ? "upsell" : isDownsell ? "downsell" : "main";
    const productId = str(data.product_id || root.product_id) || "prod";

    return [
      normalizedPaymentEventSchema.parse({
        provider: "cakto",
        externalTransactionId: transaction,
        externalEventId: str(root.id) || null,
        type,
        productId,
        offerId: str(data.offer_id) || null,
        productType,
        parentProductId: null,
        parentTransactionId: str(data.parent_id || data.parent_transaction_id) || null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(data.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(data.currency, context.fallbackCurrency),
        country: cleanCountry(customer.country),
        buyer: {
          name: str(customer.name) || null,
          email: str(customer.email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid) || null,
        occurredAt: parseDate(data.updatedAt || data.paidAt || data.createdAt, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: Boolean(data.is_test || root.is_test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// 4. ADAPTADOR KIRVANO
export const kirvanoAdapter: PaymentAdapter = {
  provider: "kirvano",
  normalize(payload, context) {
    const root = record(payload);
    const data = record(root.data || root);
    const customer = record(data.customer);
    const product = record(data.product);
    const tracking = record(data.utm || data.tracking);

    const event = str(root.event || data.event || data.status).toUpperCase();
    const rawType = str(data.type).toUpperCase();
    const isBump = rawType.includes("BUMP") || Boolean(data.order_bump);
    const isUpsell = rawType.includes("UPSELL");
    const isDownsell = rawType.includes("DOWNSELL");

    let type: PaymentEventType = "purchase_approved";
    if (["SALE_APPROVED", "PURCHASE_APPROVED", "PAID"].includes(event)) {
      if (isBump) type = "order_bump_approved";
      else if (isUpsell) type = "upsell_approved";
      else if (isDownsell) type = "downsell_approved";
      else type = "purchase_approved";
    } else if (event.includes("REFUND")) {
      type = "purchase_refunded";
    } else if (event.includes("CHARGEBACK")) {
      type = "chargeback_created";
    } else if (event.includes("CANCEL")) {
      type = "purchase_canceled";
    } else if (event.includes("PIX")) {
      type = "pix_created";
    } else if (event.includes("SLIP") || event.includes("BOLETO")) {
      type = "boleto_created";
    } else {
      type = "payment_pending";
    }

    const transaction = str(data.transaction_id || data.id || root.id) || "kirvano_tx";
    const gross = num(data.total_amount) ?? num(data.amount) ?? 0;
    const fee = num(data.fee) ?? num(data.taxes) ?? 0;
    const net = Math.max(0, Math.round((gross - fee) * 100) / 100);

    const productType = isBump ? "order_bump" : isUpsell ? "upsell" : isDownsell ? "downsell" : "main";
    const productId = str(product.id || data.product_id) || "prod";

    return [
      normalizedPaymentEventSchema.parse({
        provider: "kirvano",
        externalTransactionId: transaction,
        externalEventId: str(root.event_id || root.id) || null,
        type,
        productId,
        offerId: str(data.offer_id) || null,
        productType,
        parentProductId: null,
        parentTransactionId: str(data.parent_id || data.parent_transaction_id) || null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(data.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(data.currency, context.fallbackCurrency),
        country: cleanCountry(customer.country),
        buyer: {
          name: str(customer.name) || null,
          email: str(customer.email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid) || null,
        occurredAt: parseDate(data.paid_at || data.created_at, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: Boolean(data.is_test || root.is_test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// 5. ADAPTADOR EDUZZ
export const eduzzAdapter: PaymentAdapter = {
  provider: "eduzz",
  normalize(payload, context) {
    const root = record(payload);
    const tracking = record(root.tracker || root.tracking);

    // Mapeamento de status numérico da Eduzz:
    // 3 = Paga, 4 = Cancelada, 6 = Aguardando, 7 = Reembolsada, 9 = Chargeback
    const status = Number(root.trans_status || root.status);
    const isBump = Boolean(root.trans_order_bump || root.order_bump);

    let type: PaymentEventType = "purchase_approved";
    if (status === 3) {
      type = isBump ? "order_bump_approved" : "purchase_approved";
    } else if (status === 7) {
      type = "purchase_refunded";
    } else if (status === 9) {
      type = "chargeback_created";
    } else if (status === 4) {
      type = "purchase_canceled";
    } else if (status === 6) {
      type = "payment_pending";
    }

    const transaction = str(root.trans_cod || root.id || root.trans_key) || "eduzz_tx";
    const gross = num(root.trans_value) ?? num(root.amount) ?? 0;
    const fee = num(root.trans_taxa_total) ?? num(root.trans_taxa_eduzz) ?? 0;
    const net = Math.max(0, Math.round((gross - fee) * 100) / 100);

    const productType = isBump ? "order_bump" : "main";
    const productId = str(root.pro_cod || root.product_id) || "prod";

    return [
      normalizedPaymentEventSchema.parse({
        provider: "eduzz",
        externalTransactionId: transaction,
        externalEventId: str(root.trans_key || root.id) || null,
        type,
        productId,
        offerId: null,
        productType,
        parentProductId: null,
        parentTransactionId: str(root.trans_parent_cod) || null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(root.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(root.currency, context.fallbackCurrency),
        country: cleanCountry(root.cus_country),
        buyer: {
          name: str(root.cus_name) || null,
          email: str(root.cus_email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign || root.tracker_utm_campaign) || null,
        adsetId: str(tracking.utm_term || root.tracker_utm_term) || null,
        adId: str(tracking.utm_content || root.tracker_utm_content) || null,
        creativeId: str(tracking.utm_creative || root.tracker_utm_creative) || null,
        clickId: str(tracking.fbclid || root.tracker_fbclid) || null,
        occurredAt: parseDate(root.trans_paid || root.trans_created, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: Boolean(root.is_test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// 6. ADAPTADOR MONETIZZE
export const monetizzeAdapter: PaymentAdapter = {
  provider: "monetizze",
  normalize(payload, context) {
    const root = record(payload);
    const venda = record(root.venda);
    const produto = record(root.produto);
    const comprador = record(root.comprador);
    const tracking = record(root.utm || root.tracking);

    const status = str(root.tipoPost || root.status || venda.status).toLowerCase();
    const isBump = str(root.tipo_venda || venda.tipo_venda).toLowerCase().includes("bump") || Boolean(root.order_bump);

    let type: PaymentEventType = "purchase_approved";
    if (status.includes("finalizada") || status === "2" || status === "aprovada") {
      type = isBump ? "order_bump_approved" : "purchase_approved";
    } else if (status.includes("devolvida") || status === "4" || status.includes("reembolsada")) {
      type = "purchase_refunded";
    } else if (status.includes("bloqueada") || status === "5" || status.includes("chargeback")) {
      type = "chargeback_created";
    } else if (status.includes("cancelada") || status === "3") {
      type = "purchase_canceled";
    } else if (status.includes("aguardando") || status === "1") {
      type = "payment_pending";
    }

    const transaction = str(root.codigoVenda || venda.codigo || root.id) || "monetizze_tx";
    const gross = num(root.valor) ?? num(venda.valor) ?? num(root.amount) ?? 0;
    const fee = num(root.taxas) ?? num(venda.taxas) ?? 0;
    const net = Math.max(0, Math.round((gross - fee) * 100) / 100);

    const productType = isBump ? "order_bump" : "main";
    const productId = str(produto.codigo || root.codigo_produto) || "prod";

    return [
      normalizedPaymentEventSchema.parse({
        provider: "monetizze",
        externalTransactionId: transaction,
        externalEventId: str(root.chave_unica || root.id) || null,
        type,
        productId,
        offerId: null,
        productType,
        parentProductId: null,
        parentTransactionId: str(root.parent_codigo) || null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(root.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(root.currency, context.fallbackCurrency),
        country: cleanCountry(comprador.pais),
        buyer: {
          name: str(comprador.nome) || null,
          email: str(comprador.email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid) || null,
        occurredAt: parseDate(venda.dataFinalizada || venda.dataInicio || root.data, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: Boolean(root.is_test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// 7. ADAPTADOR WIAPY
export const wiapyAdapter: PaymentAdapter = {
  provider: "wiapy",
  normalize(payload, context) {
    const root = record(payload);
    const customer = record(root.customer);
    const product = record(root.product);
    const tracking = record(root.tracking || root.utms);

    const status = str(root.event || root.status).toLowerCase();
    const paymentMethod = str(root.payment_method).toLowerCase();
    const isBump = Boolean(root.order_bump || str(root.type).toLowerCase().includes("bump"));
    const isUpsell = str(root.type).toLowerCase().includes("upsell");

    let type: PaymentEventType = "purchase_approved";
    if (["approved", "paid", "payment_approved", "success"].includes(status)) {
      if (isBump) type = "order_bump_approved";
      else if (isUpsell) type = "upsell_approved";
      else type = "purchase_approved";
    } else if (status.includes("refund")) {
      type = "purchase_refunded";
    } else if (status.includes("chargeback")) {
      type = "chargeback_created";
    } else if (status.includes("cancel")) {
      type = "purchase_canceled";
    } else if (status.includes("pending") || status.includes("waiting")) {
      if (paymentMethod === "pix") type = "pix_created";
      else if (paymentMethod === "boleto") type = "boleto_created";
      else type = "payment_pending";
    }

    const transaction = str(root.transaction_id || root.id) || "wiapy_tx";
    const gross = num(root.amount) ?? num(root.total) ?? 0;
    const fee = num(root.fee) ?? num(root.fees) ?? 0;
    const net = Math.max(0, Math.round((gross - fee) * 100) / 100);

    const productType = isBump ? "order_bump" : isUpsell ? "upsell" : "main";
    const productId = str(product.id || root.product_id) || "prod";

    return [
      normalizedPaymentEventSchema.parse({
        provider: "wiapy",
        externalTransactionId: transaction,
        externalEventId: str(root.id) || null,
        type,
        productId,
        offerId: str(root.offer_id) || null,
        productType,
        parentProductId: null,
        parentTransactionId: str(root.parent_transaction_id || root.parent_id) || null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(root.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(root.currency, context.fallbackCurrency),
        country: cleanCountry(customer.country),
        buyer: {
          name: str(customer.name) || null,
          email: str(customer.email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid) || null,
        occurredAt: parseDate(root.paid_at || root.created_at || root.occurred_at, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: Boolean(root.is_test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

export const paymentAdapters: Record<PaymentProvider, PaymentAdapter> = {
  hotmart: hotmartAdapter,
  kiwify: kiwifyAdapter,
  cakto: caktoAdapter,
  kirvano: kirvanoAdapter,
  eduzz: eduzzAdapter,
  monetizze: monetizzeAdapter,
  wiapy: wiapyAdapter,
};
