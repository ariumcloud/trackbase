import {
  normalizedPaymentEventSchema,
  redactPaymentPayload,
  type PaymentAdapter,
  type PaymentEventType,
  type PaymentProvider,
} from "./payment-contract";
import { normalizeCountryCode } from "./country";

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
  const placementAliases = new Set([
    "placement",
    "position",
    "ad_placement",
    "adplacement",
    "utm_position",
    "utm_ad_placement",
  ]);
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase();
    const normalizedKey = placementAliases.has(key) ? "utm_placement" : key;
    if (
      normalizedKey.startsWith("utm_") ||
      [
        "src",
        "sck",
        "source_sck",
        "xcod",
        "fbclid",
        "fbp",
        "fbc",
        "gclid",
        "ttclid",
      ].includes(normalizedKey)
    ) {
      if (typeof v === "string" || typeof v === "number") {
        result[normalizedKey] = String(v).slice(0, 300);
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
  return normalizeCountryCode(raw);
};

const trackingFromUrl = (raw: unknown): Record<string, string> => {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const params = new URL(raw, "https://trackbase.invalid").searchParams;
    return Object.fromEntries(params.entries());
  } catch {
    return {};
  }
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
    const buyerAddress = record(buyer.address);
    const product = record(data.product);
    const tracking = {
      ...record(root.tracking),
      ...record(data.tracking),
      ...record(data.utm),
      ...trackingFromUrl(root.checkout_url),
      ...trackingFromUrl(data.checkout_url),
      ...trackingFromUrl(purchase.checkout_url),
      ...trackingFromUrl(purchase.checkout_link),
      ...record(purchase.tracking),
      ...record(purchase.utm),
    };

    const event = str(root.event).toUpperCase();
    const isOrderBump = Boolean(purchase.order_bump);
    const isUpsell = str(purchase.type).toLowerCase() === "upsell";
    const isDownsell = str(purchase.type).toLowerCase() === "downsell";

    let type: PaymentEventType = "payment_pending";
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
    const productId = str(product.id) || str(purchase.product_id) || str(data.product_id) || "";

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
        grossCurrency: cleanCurrency(
          price.currency_value ||
            price.currency_code ||
            price.currency_value_code ||
            price.currency_code_value,
          context.fallbackCurrency,
        ),
        netCurrency: cleanCurrency(
          price.currency_value ||
            price.currency_code ||
            price.currency_value_code ||
            price.currency_code_value,
          context.fallbackCurrency,
        ),
        country: cleanCountry(
          buyer.checkout_country ||
            buyer.country ||
            buyer.country_code ||
            buyerAddress.country ||
            buyerAddress.country_code ||
            purchase.checkout_country ||
            purchase.buyer_country ||
            data.country ||
            root.country,
        ),
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

    let type: PaymentEventType = "payment_pending";
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
    const productId = str(product.product_id || root.product_id || order.product_id) || "";

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
    const address = record(data.address);
    const product = record(data.product);
    const offer = record(data.offer);
    const tracking = record(data.tracking);

    const event = str(root.event).toLowerCase();
    const isBump = Boolean(data.order_bump || str(data.type).toLowerCase().includes("bump"));
    const isUpsell = str(data.type).toLowerCase().includes("upsell");
    const isDownsell = str(data.type).toLowerCase().includes("downsell");

    let type: PaymentEventType = "payment_pending";
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
    const productId = str(product.id || data.product_id || root.product_id) || "";

    return [
      normalizedPaymentEventSchema.parse({
        provider: "cakto",
        externalTransactionId: transaction,
        externalEventId: str(root.id) || null,
        type,
        productId,
        offerId: str(offer.id || data.offer_id) || null,
        productType,
        parentProductId: null,
        parentTransactionId: str(data.parent_id || data.parent_transaction_id) || null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(data.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(data.currency, context.fallbackCurrency),
        country: cleanCountry(address.country || customer.country),
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

    let type: PaymentEventType = "payment_pending";
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
    const productId = str(product.id || data.product_id) || "";

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

    let type: PaymentEventType = "payment_pending";
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
    const productId = str(root.pro_cod || root.product_id) || "";

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

    let type: PaymentEventType = "payment_pending";
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
    const productId = str(produto.codigo || root.codigo_produto) || "";

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

    let type: PaymentEventType = "payment_pending";
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
    const productId = str(product.id || root.product_id) || "";

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

// 8. ADAPTADOR LOWFY
export const lowfyAdapter: PaymentAdapter = {
  provider: "lowfy",
  normalize(payload, context) {
    const root = record(payload);
    const data = record(root.data || root.order || root.transaction || root);
    const customer = record(data.customer || data.buyer || data.client || root.customer || root.buyer);
    const product = record(
      data.product ||
      (Array.isArray(data.items) ? data.items[0] : undefined) ||
      (Array.isArray(root.items) ? root.items[0] : undefined) ||
      root.product
    );
    const tracking = record(data.tracking || data.utm || data.utms || data.metadata || root.tracking || root.utm || root.utms || root.metadata);

    const event = str(root.event || root.type || root.status || data.event || data.type || data.status).toLowerCase();
    const paymentMethod = str(data.payment_method || root.payment_method || data.method || root.method).toLowerCase();
    const rawType = str(data.product_type || data.type || root.type).toLowerCase();
    const isBump = rawType.includes("bump") || Boolean(data.order_bump || root.order_bump);
    const isUpsell = rawType.includes("upsell");
    const isDownsell = rawType.includes("downsell");

    let type: PaymentEventType = "payment_pending";
    if (
      event.includes("approved") ||
      event.includes("paid") ||
      event.includes("pago") ||
      event.includes("aprovad") ||
      event.includes("success") ||
      event.includes("authorized") ||
      event.includes("complete") ||
      event === "order.paid" ||
      event === "payment.approved"
    ) {
      if (isBump) type = "order_bump_approved";
      else if (isUpsell) type = "upsell_approved";
      else if (isDownsell) type = "downsell_approved";
      else type = "purchase_approved";
    } else if (event.includes("refund") || event.includes("reembols") || event.includes("estorn")) {
      type = "purchase_refunded";
    } else if (event.includes("chargeback") || event.includes("disput")) {
      type = "chargeback_created";
    } else if (event.includes("cancel") || event.includes("recusad") || event.includes("failed") || event.includes("rejeit")) {
      type = "purchase_canceled";
    } else if (event.includes("pix")) {
      type = "pix_created";
    } else if (event.includes("boleto") || event.includes("billet") || event.includes("slip")) {
      type = "boleto_created";
    } else if (event.includes("pending") || event.includes("aguard") || event.includes("wait") || event.includes("criado")) {
      if (paymentMethod.includes("pix")) type = "pix_created";
      else if (paymentMethod.includes("boleto")) type = "boleto_created";
      else type = "payment_pending";
    }

    const transaction = str(data.transaction_id || data.id || data.order_id || data.code || root.transaction_id || root.id || root.order_id) || "lowfy_tx";
    const gross = num(data.amount) ?? num(data.total) ?? num(data.total_amount) ?? num(data.price) ?? num(data.value) ?? num(root.amount) ?? num(root.total) ?? 0;
    const fee = num(data.fee) ?? num(data.fees) ?? num(data.tax) ?? num(root.fee) ?? num(root.fees) ?? 0;
    const net = Math.max(0, Math.round((gross - fee) * 100) / 100);

    const productType = isBump ? "order_bump" : isUpsell ? "upsell" : isDownsell ? "downsell" : "main";
    const productId = str(product.id || data.product_id || root.product_id || data.external_id || product.name) || "";

    return [
      normalizedPaymentEventSchema.parse({
        provider: "lowfy",
        externalTransactionId: transaction,
        externalEventId: str(root.event_id || root.id || data.event_id) || null,
        type,
        productId,
        offerId: str(data.offer_id || root.offer_id || product.offer_id) || null,
        productType,
        parentProductId: null,
        parentTransactionId: str(data.parent_id || data.parent_transaction_id || root.parent_id) || null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(data.currency || root.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(data.currency || root.currency, context.fallbackCurrency),
        country: cleanCountry(customer.country || data.country),
        buyer: {
          name: str(customer.name || customer.full_name || customer.first_name) || null,
          email: str(customer.email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid) || null,
        occurredAt: parseDate(data.paid_at || data.created_at || root.created_at || root.paid_at, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: Boolean(data.is_test || root.is_test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// 9. ADAPTADOR GREENN (https://greenn.com.br/)
export const greennAdapter: PaymentAdapter = {
  provider: "greenn",
  normalize(payload, context) {
    const root = record(payload);
    const data = record(root.order || root.data || root);
    const customer = record(data.client || data.customer || root.client || root.customer);
    const product = record(data.product || root.product || (Array.isArray(data.products) ? data.products[0] : {}));
    const tracking = record(data.tracking || data.utms || root.tracking || root.utms || root.custom_fields);

    const rawStatus = str(root.event || data.current_status || data.status || root.status).toLowerCase();
    const paymentMethod = str(data.payment_method || root.payment_method).toLowerCase();
    const isBump = Boolean(data.order_bump || data.is_bump || str(data.type).toLowerCase().includes("bump") || str(product.type).toLowerCase().includes("bump"));
    const isUpsell = Boolean(str(data.type).toLowerCase().includes("upsell") || str(product.type).toLowerCase().includes("upsell"));
    const isDownsell = Boolean(str(data.type).toLowerCase().includes("downsell") || str(product.type).toLowerCase().includes("downsell"));

    let type: PaymentEventType = "payment_pending";
    if (["paid", "approved", "order_paid", "order_approved", "success", "completed"].some((s) => rawStatus.includes(s))) {
      if (isBump) type = "order_bump_approved";
      else if (isUpsell) type = "upsell_approved";
      else if (isDownsell) type = "downsell_approved";
      else type = "purchase_approved";
    } else if (rawStatus.includes("refund")) {
      type = "purchase_refunded";
    } else if (rawStatus.includes("chargeback") || rawStatus.includes("dispute")) {
      type = "chargeback_created";
    } else if (rawStatus.includes("cancel")) {
      type = "purchase_canceled";
    } else if (rawStatus.includes("wait") || rawStatus.includes("pend")) {
      if (paymentMethod.includes("pix")) type = "pix_created";
      else if (paymentMethod.includes("boleto")) type = "boleto_created";
      else type = "payment_pending";
    }

    const transaction = str(data.id || data.code || data.order_id || root.id || root.order_id) || "greenn_tx";
    const rawGross = num(data.amount) ?? num(data.total) ?? num(data.value) ?? num(root.amount) ?? num(root.total) ?? 0;
    const gross = rawGross;
    const fee = num(data.fee) ?? num(data.fees) ?? num(data.tax) ?? num(root.fee) ?? 0;
    const net = Math.max(0, Math.round((gross - fee) * 100) / 100);

    const productType = isBump ? "order_bump" : isUpsell ? "upsell" : isDownsell ? "downsell" : "main";
    const productId = str(product.id || data.product_id || root.product_id || product.name) || "";

    return [
      normalizedPaymentEventSchema.parse({
        provider: "greenn",
        externalTransactionId: transaction,
        externalEventId: str(root.event_id || root.id || data.event_id) || null,
        type,
        productId,
        offerId: str(data.offer_id || root.offer_id || product.offer_id) || null,
        productType,
        parentProductId: null,
        parentTransactionId: str(data.parent_id || data.parent_transaction_id || root.parent_id) || null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(data.currency || root.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(data.currency || root.currency, context.fallbackCurrency),
        country: cleanCountry(customer.country || data.country),
        buyer: {
          name: str(customer.name || customer.full_name || customer.first_name) || null,
          email: str(customer.email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid) || null,
        occurredAt: parseDate(data.paid_at || data.created_at || root.created_at || root.paid_at, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: Boolean(data.is_test || root.is_test || root.sandbox),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// 10. ADAPTADOR STRIPE (https://stripe.com)
export const stripeAdapter: PaymentAdapter = {
  provider: "stripe",
  normalize(payload, context) {
    const root = record(payload);
    const dataObj = record(record(root.data).object || root);
    const metadata = record(dataObj.metadata || root.metadata);
    const customerDetails = record(dataObj.customer_details || dataObj.billing_details);

    const eventType = str(root.type || root.event).toLowerCase();
    const status = str(dataObj.status || dataObj.payment_status).toLowerCase();

    const isBump = Boolean(metadata.order_bump || str(metadata.type).toLowerCase().includes("bump"));
    const isUpsell = Boolean(str(metadata.type).toLowerCase().includes("upsell"));
    const isDownsell = Boolean(str(metadata.type).toLowerCase().includes("downsell"));

    let type: PaymentEventType = "payment_pending";
    if (
      eventType === "checkout.session.completed" ||
      eventType === "payment_intent.succeeded" ||
      eventType === "charge.succeeded" ||
      eventType === "invoice.payment_succeeded" ||
      status === "paid" ||
      status === "succeeded"
    ) {
      if (isBump) type = "order_bump_approved";
      else if (isUpsell) type = "upsell_approved";
      else if (isDownsell) type = "downsell_approved";
      else type = "purchase_approved";
    } else if (eventType.includes("refund") || status.includes("refund")) {
      type = "purchase_refunded";
    } else if (eventType.includes("dispute") || status.includes("dispute")) {
      type = "chargeback_created";
    } else if (eventType.includes("failed") || eventType.includes("canceled") || status.includes("canceled")) {
      type = "purchase_canceled";
    } else if (status === "requires_action" || status === "pending" || eventType.includes("pending")) {
      type = "payment_pending";
    }

    // No Stripe os valores vêm em centavos (ex: 10000 = $100.00 / R$ 100,00)
    const rawCents = num(dataObj.amount_total) ?? num(dataObj.amount) ?? num(dataObj.amount_paid) ?? 0;
    const gross = Math.round(rawCents) / 100;
    const feeCents = num(dataObj.application_fee_amount) ?? num(dataObj.fee) ?? 0;
    const fee = Math.round(feeCents) / 100;
    const net = Math.max(0, Math.round((gross - fee) * 100) / 100);

    const transaction = str(dataObj.id || dataObj.payment_intent || dataObj.charge || root.id) || "stripe_tx";
    const productId = str(metadata.product_id || metadata.productId || dataObj.product || dataObj.client_reference_id) || "";
    const productType = isBump ? "order_bump" : isUpsell ? "upsell" : isDownsell ? "downsell" : "main";

    const tracking = {
      ...metadata,
      ...record(dataObj.client_reference_id ? { client_reference_id: dataObj.client_reference_id } : {}),
    };

    return [
      normalizedPaymentEventSchema.parse({
        provider: "stripe",
        externalTransactionId: transaction,
        externalEventId: str(root.id) || null,
        type,
        productId,
        offerId: str(metadata.offer_id || metadata.offerId) || null,
        productType,
        parentProductId: null,
        parentTransactionId: str(metadata.parent_transaction_id || metadata.parent_id) || null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(dataObj.currency || root.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(dataObj.currency || root.currency, context.fallbackCurrency),
        country: cleanCountry(customerDetails.address ? record(customerDetails.address).country : dataObj.country),
        buyer: {
          name: str(customerDetails.name || metadata.customer_name) || null,
          email: str(customerDetails.email || dataObj.customer_email || metadata.customer_email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(metadata.utm_campaign) || null,
        adsetId: str(metadata.utm_term) || null,
        adId: str(metadata.utm_content) || null,
        creativeId: str(metadata.utm_creative) || null,
        clickId: str(metadata.fbclid || metadata.click_id) || null,
        occurredAt: parseDate(dataObj.created ? new Date(Number(dataObj.created) * 1000).toISOString() : root.created ? new Date(Number(root.created) * 1000).toISOString() : null, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: Boolean(root.livemode === false || dataObj.livemode === false),
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
  lowfy: lowfyAdapter,
  greenn: greennAdapter,
  stripe: stripeAdapter,
};
