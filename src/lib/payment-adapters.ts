import {
  DEFAULT_PLATFORM_FEES,
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
        result[normalizedKey] = String(v).slice(0, normalizedKey === "xcod" ? 2048 : 300);
      }
    }
  }
  return result;
};

// Kirvano formats every money field as a localized string, e.g. "R$ 169,80"
// (or "R$ 1.234,56") instead of a plain number -- num() alone returns null
// for these, which is how every Kirvano amount silently became 0.
const parseBRLAmount = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[^0-9,.-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
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
    // Cakto's own docs (cakto-dece4a15.mintlify.app/webhooks/pagamento-unico)
    // show no "tracking"/"type"/"order_bump" fields at all -- bump/upsell/
    // downsell is carried in "offer_type" ("main" in their example payload),
    // and any UTMs only ever show up appended to the checkout URL.
    const tracking = { ...trackingFromUrl(data.checkoutUrl), ...record(data.tracking) };

    const event = str(root.event).toLowerCase();
    const offerType = str(data.offer_type).toLowerCase();
    const isBump = offerType.includes("bump");
    const isUpsell = offerType.includes("upsell");
    const isDownsell = offerType.includes("downsell");

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
        parentTransactionId: str(data.parent_order || data.parent_id || data.parent_transaction_id) || null,
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
// Kirvano's webhook is flat (no "data" wrapper), keys the sale by "sale_id"
// (not "id"/"transaction_id"), formats every money field as a localized
// string ("R$ 169,80", parsed by parseBRLAmount), and bundles the main
// product plus any order bump into one "products" array instead of firing a
// separate webhook per line item -- confirmed against Kirvano's own docs
// (help.kirvano.com, "Configurando Integração via Webhook"). The previous
// version read fields ("data.id", "data.product", "data.total_amount") that
// don't exist in that payload, so every Kirvano sale recorded amount=0,
// productId="" (which the webhook route treats as unidentified and drops
// entirely, per resolveProductTarget's productId check), and, on the rare
// path that didn't get dropped, collided every sale onto one fallback
// transaction id ("kirvano_tx"), overwriting each previous sale's row.
export const kirvanoAdapter: PaymentAdapter = {
  provider: "kirvano",
  normalize(payload, context) {
    const root = record(payload);
    const customer = record(root.customer);
    const tracking = record(root.utm || root.tracking);
    const products = Array.isArray(root.products) ? root.products.map(record) : [];

    const event = str(root.event || root.status).toUpperCase();

    let baseType: PaymentEventType = "payment_pending";
    if (["SALE_APPROVED", "PURCHASE_APPROVED", "PAID"].includes(event)) {
      baseType = "purchase_approved";
    } else if (event.includes("REFUND")) {
      baseType = "purchase_refunded";
    } else if (event.includes("CHARGEBACK")) {
      baseType = "chargeback_created";
    } else if (event.includes("CANCEL") || event.includes("REFUSED") || event.includes("EXPIRED")) {
      baseType = "purchase_canceled";
    } else if (event.includes("PIX")) {
      baseType = "pix_created";
    } else if (event.includes("SLIP") || event.includes("BOLETO")) {
      baseType = "boleto_created";
    }

    const saleId = str(root.sale_id) || "kirvano_tx";
    const currency = cleanCurrency(root.currency, context.fallbackCurrency);
    const isTest = Boolean(root.is_test);
    const occurredAt = parseDate(root.paid_at || root.created_at, context.receivedAt);
    const attribution = extractAttribution(tracking);
    const buyer = { name: str(customer.name) || null, email: str(customer.email) || null };
    const country = cleanCountry(customer.country);

    const feeRate = DEFAULT_PLATFORM_FEES.kirvano.percent / 100;
    const feeFixed = DEFAULT_PLATFORM_FEES.kirvano.fixed;

    const lines = products.length
      ? products
      : [record({ id: "", price: root.total_price, is_order_bump: false })];

    return lines.map((line, idx) => {
      const isBump = Boolean(line.is_order_bump);
      const productType = isBump ? "order_bump" : "main";
      const gross =
        parseBRLAmount(line.price) ??
        parseBRLAmount(line.total) ??
        (idx === 0 ? parseBRLAmount(root.total_price ?? root.total ?? root.total_amount) ?? 0 : 0);
      const fee = gross > 0 ? Number((gross * feeRate + (idx === 0 ? feeFixed : 0)).toFixed(2)) : 0;
      const net = Math.max(0, Number((gross - fee).toFixed(2)));
      const type: PaymentEventType =
        baseType === "purchase_approved" && isBump ? "order_bump_approved" : baseType;

      return normalizedPaymentEventSchema.parse({
        provider: "kirvano",
        externalTransactionId: saleId,
        externalEventId: str(root.event_id) || null,
        type,
        productId: str(line.id) || "",
        offerId: str(line.offer_id) || null,
        productType,
        parentProductId: null,
        parentTransactionId: idx > 0 ? saleId : null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: currency,
        netCurrency: currency,
        country,
        buyer,
        attribution,
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid) || null,
        occurredAt,
        receivedAt: context.receivedAt,
        isTest,
        rawPayload: redactPaymentPayload(payload),
      });
    });
  },
};

// 5. ADAPTADOR EDUZZ
export const eduzzAdapter: PaymentAdapter = {
  provider: "eduzz",
  normalize(payload, context) {
    const root = record(payload);
    // Eduzz's own webhook fields are flat, "tracker_"-prefixed keys at the
    // root (tracker_utm_source, tracker_utm_campaign, ...), not a nested
    // "tracker"/"tracking" object -- so the general attribution record (used
    // for utm_source/utm_medium, which have no dedicated column below) was
    // always empty even though the individual campaignId/adId/etc. fields
    // still worked via their root.tracker_utm_* fallback.
    const nestedTracking = record(root.tracker || root.tracking);
    const tracking: Record<string, unknown> = {
      utm_source: nestedTracking.utm_source ?? root.tracker_utm_source,
      utm_medium: nestedTracking.utm_medium ?? root.tracker_utm_medium,
      utm_campaign: nestedTracking.utm_campaign ?? root.tracker_utm_campaign,
      utm_content: nestedTracking.utm_content ?? root.tracker_utm_content,
      utm_term: nestedTracking.utm_term ?? root.tracker_utm_term,
      fbclid: nestedTracking.fbclid ?? root.tracker_fbclid,
    };

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
    // Monetizze's own callback example (github.com/Monetizze/ExemploPOSTCallback)
    // nests utm_source/utm_medium/utm_campaign/utm_content/src directly under
    // "venda", not a separate "utm"/"tracking" object -- so every Monetizze
    // sale lost its ad attribution here (extractAttribution got {} always).
    const tracking = record(root.utm || root.tracking || venda);

    const status = str(root.tipoPost || root.status || venda.status).toLowerCase();
    const isBump = str(root.tipo_venda || venda.tipo_venda).toLowerCase().includes("bump") || Boolean(root.order_bump);
    const paymentMethod = str(venda.formaPagamento || venda.meio_pagamento || root.formaPagamento).toLowerCase();

    let type: PaymentEventType = "payment_pending";
    if (status.includes("finalizada") || status === "2" || status === "6" || status.includes("completa") || status === "aprovada") {
      type = isBump ? "order_bump_approved" : "purchase_approved";
    } else if (status.includes("devolvida") || status === "4" || status.includes("reembolsada")) {
      type = "purchase_refunded";
    } else if (status.includes("bloqueada") || status === "5" || status.includes("chargeback")) {
      type = "chargeback_created";
    } else if (status.includes("cancelada") || status === "3") {
      type = "purchase_canceled";
    } else if (status.includes("aguardando") || status === "1") {
      if (paymentMethod.includes("pix")) {
        type = "pix_created";
      } else if (paymentMethod.includes("boleto")) {
        type = "boleto_created";
      } else {
        type = "payment_pending";
      }
    }

    const transaction = str(root.codigoVenda || venda.codigo || root.id) || "monetizze_tx";
    const gross = num(root.valor) ?? num(venda.valor) ?? num(root.amount) ?? 0;
    // Monetizze's callback reports the seller's take-home directly as
    // "valorRecebido" -- no separate fee field exists to subtract from gross.
    const net = num(venda.valorRecebido) ?? gross;
    const fee = Math.max(0, Math.round((gross - net) * 100) / 100);

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
        clickId: str(tracking.fbclid || tracking.fbc || tracking.src || tracking.sck) || null,
        occurredAt: parseDate(venda.dataFinalizada || venda.dataInicio || root.data, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: Boolean(root.is_test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// 7. ADAPTADOR WIAPY
// Wiapy's own docs (ajuda.wiapy.com/wiapy/produtor/integracoes/webhook) put
// everything the previous version read off the payload root inside nested
// objects instead: status/amount/fee/payment_method/id live under "payment",
// not the root, and every monetary field is in CENTAVOS (their own example:
// "R$ 17,70 -> 1770"). The old code read root.status/root.amount directly
// (always undefined -> status "", amount 0) and never divided by 100 on top
// of that, so a Wiapy sale could never even reach "approved", let alone with
// a correct value.
export const wiapyAdapter: PaymentAdapter = {
  provider: "wiapy",
  normalize(payload, context) {
    const root = record(payload);
    const orderData = record(root.order || root.data);
    const payment = record(root.payment || orderData.payment);
    const customer = record(root.customer || orderData.customer);
    const products = Array.isArray(root.products)
      ? root.products.map(record)
      : Array.isArray(orderData.products)
        ? (orderData.products as unknown[]).map(record)
        : [];
    const tracking = record(root.tracking || orderData.tracking);

    const status = str(payment.status || root.status || root.event || orderData.status || orderData.event).toLowerCase();
    const paymentMethod = str(payment.payment_method || root.payment_method || orderData.payment_method).toLowerCase();

    let type: PaymentEventType = "payment_pending";
    if (status === "paid" || status === "approved" || status.includes("approved") || status.includes("paid")) {
      type = "purchase_approved";
    } else if (status.includes("refund")) {
      type = "purchase_refunded";
    } else if (status.includes("chargeback") || status.includes("chargedback")) {
      type = "chargeback_created";
    } else if (status.includes("declined") || status.includes("cancel") || status.includes("refused")) {
      type = "purchase_canceled";
    } else if (status === "unpaid" || status.includes("pending")) {
      if (paymentMethod === "pix") type = "pix_created";
      else if (paymentMethod === "boleto") type = "boleto_created";
      else type = "payment_pending";
    }

    const transaction = str(payment.id || orderData.id || root.id) || "wiapy_tx";
    // Every amount is centavos: divide by 100 to get the currency's base unit.
    const rawGross = num(payment.amount ?? payment.total ?? orderData.total ?? orderData.amount ?? root.amount);
    const gross = (rawGross ?? 0) / 100;
    const rawFee = num(payment.fee ?? orderData.fee ?? root.fee);
    const fee = (rawFee ?? 0) / 100;
    const net = Math.max(0, Math.round((gross - fee) * 100) / 100);

    const checkout = record(root.checkout || orderData.checkout);
    const productId = str(products[0]?.id || checkout.id || root.product_id || "wiapy_prod");
    const offerId = str(checkout.id || products[0]?.id) || null;

    return [
      normalizedPaymentEventSchema.parse({
        provider: "wiapy",
        externalTransactionId: transaction,
        externalEventId: str(payment.id) || null,
        type,
        productId,
        offerId,
        productType: "main",
        parentProductId: null,
        parentTransactionId: null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(root.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(root.currency, context.fallbackCurrency),
        country: cleanCountry(customer.country || "BR"),
        buyer: {
          name: str(customer.name) || null,
          email: str(customer.email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid || tracking.fbc || tracking.src || tracking.sck) || null,
        occurredAt: parseDate(payment.dt_update || payment.dt_create, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: false,
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
// Greenn's own docs (ajuda.greenn.com.br, "Documentação Webhook Greenn")
// show a flat top-level shape -- { type: "sale", event: "saleUpdated",
// oldStatus, currentStatus, product, sale, seller, client, saleMetas } --
// with the real per-sale id/amount/method under "sale", not "order"/"data"
// nor loose on root. The previous version checked root.event for the sale's
// status, but "event" is always the literal string "saleUpdated" regardless
// of outcome (the actual status is "currentStatus"); it also never read
// "sale" at all, so amount was always 0 and the transaction id always fell
// back to the same literal string ("greenn_tx") for every sale, colliding
// them all onto one row. Greenn's docs don't show an order_bump/upsell/type
// field on "sale" or "product", so that detection is dropped rather than
// guessed -- every approved sale is booked as "main" until a confirmed field
// surfaces.
export const greennAdapter: PaymentAdapter = {
  provider: "greenn",
  normalize(payload, context) {
    const root = record(payload);
    const sale = record(root.sale || root.currentSale);
    const customer = record(root.client || root.customer);
    const product = record(root.product);

    // Greenn envia parâmetros de rastreamento primordialmente em saleMetas:
    // [{ meta_key: "utm_source", meta_value: "facebook" }, ...]
    const saleMetas = Array.isArray(root.saleMetas) ? root.saleMetas : [];
    const metaTracking: Record<string, unknown> = {};
    for (const item of saleMetas) {
      if (item && typeof item === "object" && "meta_key" in item && "meta_value" in item) {
        metaTracking[String((item as Record<string, unknown>).meta_key)] = (item as Record<string, unknown>).meta_value;
      }
    }
    const tracking = {
      ...metaTracking,
      ...record(root.tracking || root.utms || root.custom_fields),
    };

    const rawStatus = str(root.currentStatus || sale.status).toLowerCase();
    const paymentMethod = str(sale.method || sale.payment_method).toLowerCase();

    let type: PaymentEventType = "payment_pending";
    if (["paid", "approved", "success", "completed"].some((s) => rawStatus.includes(s))) {
      type = "purchase_approved";
    } else if (rawStatus.includes("refund")) {
      type = "purchase_refunded";
    } else if (rawStatus.includes("chargeback") || rawStatus.includes("dispute")) {
      type = "chargeback_created";
    } else if (rawStatus.includes("refused") || rawStatus.includes("cancel")) {
      type = "purchase_canceled";
    } else if (rawStatus.includes("wait") || rawStatus.includes("pend")) {
      if (paymentMethod.includes("pix")) type = "pix_created";
      else if (paymentMethod.includes("boleto")) type = "boleto_created";
      else type = "payment_pending";
    }

    const transaction = str(sale.id) || "greenn_tx";
    const gross = num(sale.amount) ?? 0;
    const feeRate = DEFAULT_PLATFORM_FEES.greenn.percent / 100;
    const feeFixed = DEFAULT_PLATFORM_FEES.greenn.fixed;
    const fee =
      num(sale.fee) ??
      num(sale.tax) ??
      (gross > 0 ? Number((gross * feeRate + feeFixed).toFixed(2)) : 0);
    const net = num(sale.net_amount) ?? Math.max(0, Math.round((gross - fee) * 100) / 100);

    const productId = str(product.id) || "";

    return [
      normalizedPaymentEventSchema.parse({
        provider: "greenn",
        externalTransactionId: transaction,
        externalEventId: str(sale.id) || null,
        type,
        productId,
        offerId: null,
        productType: "main",
        parentProductId: null,
        parentTransactionId: null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: cleanCurrency(root.currency, context.fallbackCurrency),
        netCurrency: cleanCurrency(root.currency, context.fallbackCurrency),
        country: cleanCountry(customer.country),
        buyer: {
          name: str(customer.name || customer.full_name || customer.first_name) || null,
          email: str(customer.email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid || tracking.fbc || tracking.src || tracking.sck) || null,
        occurredAt: parseDate(sale.updated_at || sale.created_at, context.receivedAt),
        receivedAt: context.receivedAt,
        isTest: false,
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

// 11. ADAPTADOR YAMPI
export const yampiAdapter: PaymentAdapter = {
  provider: "yampi",
  normalize(payload, context) {
    const root = record(payload);
    const eventName = str(root.event).toLowerCase();
    const resource = record(root.resource || root.data || root);
    const customer = record(record(resource.customer).data || resource.customer);
    const statusObj = record(record(resource.status).data || resource.status);
    const statusAlias = str(statusObj.alias || resource.status || root.status).toLowerCase();

    let type: PaymentEventType = "payment_pending";
    if (
      eventName === "order.paid" ||
      statusAlias === "paid" ||
      statusAlias === "approved" ||
      Boolean(resource.authorized && resource.has_payment)
    ) {
      type = "purchase_approved";
    } else if (
      eventName === "transaction.payment.refused" ||
      statusAlias === "refused"
    ) {
      type = "purchase_canceled";
    } else if (statusAlias === "refunded") {
      type = "purchase_refunded";
    } else if (statusAlias === "chargeback" || statusAlias === "chargedback") {
      type = "chargeback_created";
    } else if (statusAlias === "cancelled" || statusAlias === "canceled") {
      type = "purchase_canceled";
    } else {
      const payments = Array.isArray(resource.payments) ? resource.payments : [];
      const firstPayment = record(payments[0]);
      const paymentAlias = str(firstPayment.alias).toLowerCase();
      if (paymentAlias === "pix") {
        type = "pix_created";
      } else if (
        paymentAlias === "billet" ||
        paymentAlias === "bank_slip" ||
        paymentAlias === "boleto"
      ) {
        type = "boleto_created";
      } else {
        type = "payment_pending";
      }
    }

    const itemsData = Array.isArray(resource.items)
      ? resource.items
      : Array.isArray((resource.items as Record<string, unknown>)?.data)
        ? ((resource.items as Record<string, unknown>).data as unknown[])
        : [];
    const spreadsheetData = Array.isArray((resource.spreadsheet as Record<string, unknown>)?.data)
      ? ((resource.spreadsheet as Record<string, unknown>).data as unknown[])
      : [];

    const firstItem = record(itemsData[0] || spreadsheetData[0]);
    const firstSku = record(record(firstItem.sku).data || firstItem.sku);

    const productId = str(
      firstItem.product_id ||
        firstSku.product_id ||
        firstItem.sku_id ||
        firstSku.id ||
        firstItem.item_sku ||
        resource.number ||
        resource.id ||
        "yampi_product",
    );
    const offerId = str(firstSku.token || firstItem.sku || firstItem.item_sku || resource.cart_token) || null;

    const isUpsell = Boolean(resource.is_upsell || resource.has_upsell || firstItem.is_upsell);
    const isBump = Boolean(resource.has_order_bump || firstItem.is_order_bump);
    let productType: "main" | "upsell" | "order_bump" = "main";
    if (isBump) productType = "order_bump";
    else if (isUpsell) productType = "upsell";

    const gross = num(
      resource.value_total ||
        resource.buyer_value_total ||
        resource.value_products ||
        firstItem.price ||
        firstItem.price_sale,
    ) || 0;
    const feeRate = DEFAULT_PLATFORM_FEES.yampi.percent / 100;
    const fee = num(resource.value_tax) ?? Number((gross * feeRate).toFixed(2));
    const net = num(resource.net_amount) ?? Number((gross - fee).toFixed(2));

    const tracking: Record<string, string> = {};
    if (resource.utm_source) tracking.utm_source = str(resource.utm_source);
    if (resource.utm_medium) tracking.utm_medium = str(resource.utm_medium);
    if (resource.utm_campaign) tracking.utm_campaign = str(resource.utm_campaign);
    if (resource.utm_content) tracking.utm_content = str(resource.utm_content);
    if (resource.utm_term) tracking.utm_term = str(resource.utm_term);

    const metadata = resource.metadata;
    if (Array.isArray(metadata)) {
      for (const m of metadata) {
        if (m && typeof m === "object" && "key" in m && "value" in m) {
          tracking[str((m as Record<string, unknown>).key)] = str((m as Record<string, unknown>).value);
        }
      }
    } else if (metadata && typeof metadata === "object") {
      const metaDataArr = (metadata as Record<string, unknown>).data;
      if (Array.isArray(metaDataArr)) {
        for (const m of metaDataArr) {
          if (m && typeof m === "object" && "key" in m && "value" in m) {
            tracking[str((m as Record<string, unknown>).key)] = str((m as Record<string, unknown>).value);
          }
        }
      } else {
        Object.assign(tracking, extractAttribution(metadata));
      }
    }

    const shippingAddress = record(record(resource.shipping_address).data || resource.shipping_address);
    const country = cleanCountry(
      shippingAddress.country || customer.country || "BR",
    );

    const createdAt = record(resource.created_at);
    const dateStr = str(createdAt.date || resource.created_at || root.time);
    const occurredAt = parseDate(dateStr, context.receivedAt);

    const buyerName =
      str(customer.name) ||
      `${str(customer.first_name)} ${str(customer.last_name)}`.trim() ||
      null;

    const currency = cleanCurrency(resource.currency, context.fallbackCurrency || "BRL");

    return [
      normalizedPaymentEventSchema.parse({
        provider: "yampi",
        externalTransactionId: str(resource.number || resource.id || root.id || "yampi_tx"),
        externalEventId: str(root.event_id || root.id) || null,
        type,
        productId,
        offerId,
        productType,
        parentProductId: null,
        parentTransactionId: null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: currency,
        netCurrency: currency,
        country,
        buyer: {
          name: buyerName,
          email: str(customer.email) || null,
        },
        attribution: extractAttribution(tracking),
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid || tracking.sck || tracking.src) || null,
        occurredAt,
        receivedAt: context.receivedAt,
        isTest: Boolean(root.is_test || resource.is_test || root.test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// 12. ADAPTADOR PERFECTPAY
export const perfectpayAdapter: PaymentAdapter = {
  provider: "perfectpay",
  normalize(payload, context) {
    const root = record(payload);
    const statusEnum = Number(root.sale_status_enum);
    const statusKey = str(root.sale_status_enum_key || root.sale_status).toLowerCase();
    const paymentTypeEnum = Number(root.payment_type_enum);
    const paymentMethodKey = str(root.payment_method_enum_key || root.payment_type_enum_key).toLowerCase();

    let type: PaymentEventType = "payment_pending";
    if (
      statusEnum === 2 ||
      statusEnum === 8 ||
      statusEnum === 10 ||
      statusKey === "approved" ||
      statusKey === "completed" ||
      statusKey === "authorized"
    ) {
      type = "purchase_approved";
    } else if (
      statusEnum === 7 ||
      statusEnum === 18 ||
      statusEnum === 19 ||
      statusEnum === 20 ||
      statusKey === "refunded" ||
      statusKey === "pre_refunded"
    ) {
      type = "purchase_refunded";
    } else if (
      statusEnum === 9 ||
      statusEnum === 17 ||
      statusKey === "charged_back" ||
      statusKey === "chargeback" ||
      statusKey === "pre_chargeback"
    ) {
      type = "chargeback_created";
    } else if (
      statusEnum === 5 ||
      statusEnum === 6 ||
      statusEnum === 11 ||
      statusEnum === 13 ||
      statusKey === "cancelled" ||
      statusKey === "canceled" ||
      statusKey === "rejected" ||
      statusKey === "expired"
    ) {
      type = "purchase_canceled";
    } else if (statusEnum === 1 || statusKey === "pending") {
      if (paymentTypeEnum === 7 || paymentMethodKey === "pix") {
        type = "pix_created";
      } else if (
        paymentTypeEnum === 2 ||
        paymentMethodKey.includes("billet") ||
        paymentMethodKey.includes("boleto")
      ) {
        type = "boleto_created";
      } else {
        type = "payment_pending";
      }
    }

    const formatKey = str(root.payment_format_enum_key || root.checkout_type_enum).toLowerCase();
    const isBump = formatKey === "orderbump" || formatKey === "order_bump" || Boolean(root.is_order_bump);
    const isUpsell = formatKey === "upsell";
    let productType: "main" | "order_bump" | "upsell" = "main";
    if (isBump) productType = "order_bump";
    else if (isUpsell) productType = "upsell";

    const gross = num(root.sale_amount || root.value) ?? 0;
    const feeRate = DEFAULT_PLATFORM_FEES.perfectpay.percent / 100;
    const feeFixed = DEFAULT_PLATFORM_FEES.perfectpay.fixed;
    const fee =
      root.pay_abs !== undefined && root.pay_tax !== undefined
        ? Number(((num(root.pay_abs) ?? 0) + (num(root.pay_tax) ?? 0)).toFixed(2))
        : gross > 0
          ? Number((gross * feeRate + feeFixed).toFixed(2))
          : 0;
    const net = Math.max(0, Number((gross - fee).toFixed(2)));

    const product = record(root.product);
    const plan = record(root.plan);
    const productId = str(product.code || product.id || root.product_code || "perfectpay_product");
    const offerId = str(plan.code || plan.offer_name || root.coupon_code) || null;

    const rawCustomer = root.customer;
    const customer = record(Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer);
    const buyerName = str(customer.full_name || customer.name) || null;
    const buyerEmail = str(customer.email) || null;

    const metadata = record(root.metadata || root.tracking);
    const attribution = extractAttribution(metadata);
    const currency = cleanCurrency(root.currency_enum_key, context.fallbackCurrency || "BRL");
    const country = cleanCountry(customer.country || "BR");
    const occurredAt = parseDate(root.date_approved || root.date_created, context.receivedAt);

    return [
      normalizedPaymentEventSchema.parse({
        provider: "perfectpay",
        externalTransactionId: str(root.code || root.transaction_token || "pp_tx"),
        externalEventId: str(root.code || root.transaction_token) || null,
        type,
        productId,
        offerId,
        productType,
        parentProductId: null,
        parentTransactionId: null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: currency,
        netCurrency: currency,
        country,
        buyer: { name: buyerName, email: buyerEmail },
        attribution,
        campaignId: str(metadata.utm_campaign) || null,
        adsetId: str(metadata.utm_term) || null,
        adId: str(metadata.utm_content) || null,
        creativeId: str(metadata.utm_creative) || null,
        clickId: str(metadata.fbclid || metadata.src || metadata.sck) || null,
        occurredAt,
        receivedAt: context.receivedAt,
        isTest: Boolean(root.is_test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// 13. ADAPTADOR CARTPANDA
export const cartpandaAdapter: PaymentAdapter = {
  provider: "cartpanda",
  normalize(payload, context) {
    const root = record(payload);
    const order = record(root.order || root.data || root);
    const customer = record(order.customer || root.customer);
    const items = Array.isArray(order.line_items)
      ? order.line_items.map(record)
      : Array.isArray(order.items)
        ? order.items.map(record)
        : Array.isArray(root.line_items)
          ? root.line_items.map(record)
          : [];
    const firstItem = record(items[0]);

    const event = str(root.event || root.type).toLowerCase();
    const status = str(order.status || order.financial_status || root.status).toLowerCase();
    const paymentMethod = str(order.payment_method || root.payment_method || order.gateway).toLowerCase();

    let type: PaymentEventType = "payment_pending";
    if (
      event === "order.refunded" ||
      event.includes("refund") ||
      status === "refunded"
    ) {
      type = "purchase_refunded";
    } else if (
      event.includes("chargeback") ||
      status === "chargedback" ||
      status === "chargeback"
    ) {
      type = "chargeback_created";
    } else if (
      event === "order.cancelled" ||
      event === "order.canceled" ||
      event.includes("cancel") ||
      status === "cancelled" ||
      status === "canceled"
    ) {
      type = "purchase_canceled";
    } else if (
      event === "order.paid" ||
      status === "paid" ||
      status === "approved" ||
      status === "completed"
    ) {
      type = "purchase_approved";
    } else if (event === "order.created" || status === "pending" || status === "unpaid") {
      if (paymentMethod === "pix") type = "pix_created";
      else if (paymentMethod.includes("boleto") || paymentMethod.includes("billet")) type = "boleto_created";
      else type = "payment_pending";
    }

    const gross =
      num(order.total_price || order.total || root.total_price || root.total || firstItem.price) ?? 0;
    const feeRate = DEFAULT_PLATFORM_FEES.cartpanda.percent / 100;
    const fee = Number((gross * feeRate).toFixed(2));
    const net = Math.max(0, Number((gross - fee).toFixed(2)));

    const productId = str(firstItem.product_id || firstItem.id || order.id || "cartpanda_product");
    const offerId = str(firstItem.sku || firstItem.variant_id) || null;

    const buyerName =
      str(customer.name) ||
      `${str(customer.first_name)} ${str(customer.last_name)}`.trim() ||
      null;
    const buyerEmail = str(customer.email) || null;

    const trackingData = {
      ...record(root),
      ...record(order),
      ...record(root.tracking || root.utm),
      ...record(order.tracking || order.utm),
    };
    const attribution = extractAttribution(trackingData);
    const currency = cleanCurrency(order.currency || root.currency, context.fallbackCurrency || "BRL");
    const country = cleanCountry(customer.country || "BR");
    const occurredAt = parseDate(order.paid_at || order.created_at || root.created_at, context.receivedAt);

    return [
      normalizedPaymentEventSchema.parse({
        provider: "cartpanda",
        externalTransactionId: str(order.order_number || order.id || root.order_number || root.id || "cp_tx"),
        externalEventId: str(root.id || order.id) || null,
        type,
        productId,
        offerId,
        productType: "main",
        parentProductId: null,
        parentTransactionId: null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: currency,
        netCurrency: currency,
        country,
        buyer: { name: buyerName, email: buyerEmail },
        attribution,
        campaignId: str(trackingData.utm_campaign) || null,
        adsetId: str(trackingData.utm_term) || null,
        adId: str(trackingData.utm_content) || null,
        creativeId: str(trackingData.utm_creative) || null,
        clickId: str(trackingData.fbclid || trackingData.fbc || trackingData.src || trackingData.sck) || null,
        occurredAt,
        receivedAt: context.receivedAt,
        isTest: Boolean(root.is_test || order.test),
        rawPayload: redactPaymentPayload(payload),
      }),
    ];
  },
};

// Shopify fires a different REST resource per webhook topic, not the same
// Order object with a changed status: `orders/paid` and `orders/cancelled`
// send the Order resource (financial_status, line_items, total_price...),
// but `refunds/create` sends a distinct Refund resource — order_id instead
// of id, refund_line_items/transactions instead of line_items/total_price,
// and no financial_status at all. Treating every payload as an Order made
// every refund normalize as financialStatus="" -> "payment_pending" with
// gross=0 and productId = the refund's own id (never a known product), so
// resolveProductTarget silently dropped it and the original sale stayed
// marked "approved" forever. A Refund resource is identified by having
// order_id but no financial_status (an Order never has order_id; it has id).
// Shopify carts routinely hold several distinct products in one order,
// unlike the single-product checkouts every other gateway here models. The
// old version only ever read line_items[0] for productId while billing the
// *whole* order total to it — a 2-product order silently gave 100% of the
// revenue to product A and 0% to product B, which never appears at all.
// Each line item now becomes its own normalized event, sharing the order's
// buyer/attribution/currency but carrying its own product and its own slice
// of the total. To keep each line's row distinct in utm_sales (unique on
// integration_id + external_transaction_id + product_type, and every line
// here is productType "main"), the transaction id is suffixed per line
// item — shared with the refund path below so a later refund of one line
// updates that same row instead of colliding with, or missing, the others.
function shopifyLineTransactionId(orderId: string, lineItemId: string): string {
  return lineItemId ? `${orderId}:${lineItemId}` : orderId;
}

function normalizeShopifyRefund(root: Record<string, unknown>, context: { receivedAt: string; fallbackCurrency?: string }) {
  const orderId = str(root.order_id) || "shopify_tx";
  const refundLines = Array.isArray(root.refund_line_items) ? root.refund_line_items.map(record) : [];
  const transactions = Array.isArray(root.transactions) ? root.transactions.map(record) : [];
  const refundTransactions = transactions.filter((t) => str(t.kind) === "refund" && str(t.status) !== "failure");
  const transactionsTotal = refundTransactions.reduce((sum, t) => sum + (num(t.amount) ?? 0), 0);
  const currency = cleanCurrency(refundTransactions[0]?.currency || root.currency, context.fallbackCurrency || "USD");
  const occurredAt = parseDate(root.processed_at || root.created_at, context.receivedAt);
  const refundEventId = str(root.id);

  // Shopify itemizes refund_line_items whenever the refund targets specific
  // products (the normal case), so refund each of those lines against the
  // exact same transaction id its original sale was recorded under.
  if (refundLines.length > 0) {
    const linesTotal = refundLines.reduce((sum, li) => sum + (num(li.subtotal) ?? 0) + (num(li.total_tax) ?? 0), 0);
    return refundLines.map((line, idx) => {
      const originalLineItem = record(line.line_item);
      const lineGross = (num(line.subtotal) ?? 0) + (num(line.total_tax) ?? 0);
      // Distribute the actual refunded money (transactions) proportionally
      // across lines when it disagrees with the line subtotal (partial /
      // duty-adjusted refunds); falls back to the line subtotal itself.
      const gross = transactionsTotal > 0 && linesTotal > 0 ? Number(((lineGross / linesTotal) * transactionsTotal).toFixed(2)) : lineGross;
      return normalizedPaymentEventSchema.parse({
        provider: "shopify",
        externalTransactionId: shopifyLineTransactionId(orderId, str(originalLineItem.id || line.line_item_id)),
        externalEventId: refundEventId ? `refund_${refundEventId}_${idx}` : null,
        type: "purchase_refunded" as PaymentEventType,
        productId: str(originalLineItem.product_id || originalLineItem.id || orderId),
        offerId: str(originalLineItem.variant_id || originalLineItem.sku) || null,
        productType: "main",
        parentProductId: null,
        parentTransactionId: null,
        grossAmount: gross,
        netAmount: gross,
        fees: 0,
        grossCurrency: currency,
        netCurrency: currency,
        country: null,
        buyer: { name: null, email: null },
        attribution: extractAttribution({}),
        campaignId: null,
        adsetId: null,
        adId: null,
        creativeId: null,
        clickId: null,
        occurredAt,
        receivedAt: context.receivedAt,
        isTest: false,
        rawPayload: redactPaymentPayload(root),
      });
    });
  }

  // No line breakdown (e.g. a duties-only adjustment): fall back to the
  // bare order id, which only ever matches a single-line order's own sale.
  return [
    normalizedPaymentEventSchema.parse({
      provider: "shopify",
      externalTransactionId: shopifyLineTransactionId(orderId, ""),
      externalEventId: refundEventId ? `refund_${refundEventId}` : null,
      type: "purchase_refunded" as PaymentEventType,
      productId: orderId,
      offerId: null,
      productType: "main",
      parentProductId: null,
      parentTransactionId: null,
      grossAmount: transactionsTotal,
      netAmount: transactionsTotal,
      fees: 0,
      grossCurrency: currency,
      netCurrency: currency,
      country: null,
      buyer: { name: null, email: null },
      attribution: extractAttribution({}),
      campaignId: null,
      adsetId: null,
      adId: null,
      creativeId: null,
      clickId: null,
      occurredAt,
      receivedAt: context.receivedAt,
      isTest: false,
      rawPayload: redactPaymentPayload(root),
    }),
  ];
}

// 14. ADAPTADOR SHOPIFY
export const shopifyAdapter: PaymentAdapter = {
  provider: "shopify",
  normalize(payload, context) {
    const root = record(payload);
    const isRefundResource = root.order_id !== undefined && root.financial_status === undefined;
    if (isRefundResource) return normalizeShopifyRefund(root, context);

    const order = record(root.order || root);
    const orderId = str(order.id || order.order_number || order.name || "shopify_tx");
    const customer = record(order.customer || root.customer);
    const items = Array.isArray(order.line_items) ? order.line_items.map(record) : [];

    const financialStatus = str(order.financial_status).toLowerCase();
    const cancelReason = str(order.cancel_reason);

    let type: PaymentEventType = "payment_pending";
    if (financialStatus === "paid") {
      type = "purchase_approved";
    } else if (financialStatus === "refunded" || financialStatus === "partially_refunded") {
      type = "purchase_refunded";
    } else if (financialStatus === "voided" || Boolean(cancelReason)) {
      type = "purchase_canceled";
    } else if (financialStatus === "pending") {
      type = "payment_pending";
    }

    const feeRate = DEFAULT_PLATFORM_FEES.shopify.percent / 100;

    const buyerName =
      str(customer.name) ||
      `${str(customer.first_name)} ${str(customer.last_name)}`.trim() ||
      null;
    const buyerEmail = str(customer.email) || null;

    const tracking: Record<string, string> = {};
    if (Array.isArray(order.note_attributes)) {
      for (const attr of order.note_attributes) {
        if (attr && typeof attr === "object" && "name" in attr && "value" in attr) {
          tracking[str((attr as Record<string, unknown>).name)] = str((attr as Record<string, unknown>).value);
        }
      }
    }
    const landingSite = str(order.landing_site || order.referring_site);
    if (landingSite) {
      try {
        const dummyUrl = new URL(landingSite, "https://dummy.com");
        for (const [k, v] of dummyUrl.searchParams.entries()) {
          if (!tracking[k]) tracking[k] = v;
        }
      } catch {}
    }

    const attribution = extractAttribution(tracking);
    const currency = cleanCurrency(order.currency, context.fallbackCurrency || "USD");
    const shippingAddress = record(order.shipping_address || order.billing_address);
    const country = cleanCountry(shippingAddress.country_code || shippingAddress.country || customer.country || "BR");
    const occurredAt = parseDate(order.processed_at || order.created_at, context.receivedAt);
    const buyer = { name: buyerName, email: buyerEmail };
    const orderTotal = num(order.total_price || order.current_total_price);

    // No line items at all (shouldn't happen for a real Order, but keeps
    // this from silently producing zero events): fall back to one event
    // for the whole order, same as before.
    const lines = items.length
      ? items
      : [record({ id: "", product_id: order.id, price: orderTotal, quantity: 1 })];
    const linesGrossTotal = lines.reduce((sum, item) => sum + (num(item.price) ?? 0) * (num(item.quantity) ?? 1), 0);

    return lines.map((item) => {
      const itemGross = (num(item.price) ?? 0) * (num(item.quantity) ?? 1);
      // Prefer the order's own total (includes shipping/tax adjustments not
      // on individual lines) distributed proportionally across items; falls
      // back to the line's own price when the order total is unavailable or
      // doesn't add up (e.g. a synthetic single-line fallback above).
      const gross =
        orderTotal !== null && orderTotal !== undefined && linesGrossTotal > 0
          ? Number(((itemGross / linesGrossTotal) * orderTotal).toFixed(2))
          : itemGross;
      const fee = Number((gross * feeRate).toFixed(2));
      const net = Math.max(0, Number((gross - fee).toFixed(2)));

      return normalizedPaymentEventSchema.parse({
        provider: "shopify",
        externalTransactionId: shopifyLineTransactionId(orderId, str(item.id)),
        externalEventId: null,
        type,
        productId: str(item.product_id || item.id || orderId),
        offerId: str(item.variant_id || item.sku) || null,
        productType: "main",
        parentProductId: null,
        parentTransactionId: null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: currency,
        netCurrency: currency,
        country,
        buyer,
        attribution,
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid || tracking.fbc || tracking.src || tracking.sck) || null,
        occurredAt,
        receivedAt: context.receivedAt,
        isTest: Boolean(order.test),
        rawPayload: redactPaymentPayload(payload),
      });
    });
  },
};

// 15. ADAPTADOR TICTO
export const tictoAdapter: PaymentAdapter = {
  provider: "ticto",
  normalize(payload, context) {
    const root = record(payload);
    const order = record(root.order);
    const item = record(root.item);
    const customer = record(root.customer);

    const status = str(root.status).toLowerCase();
    let baseType: PaymentEventType = "payment_pending";
    if (status === "authorized" || status === "approved" || status === "paid") {
      baseType = "purchase_approved";
    } else if (status === "refunded") {
      baseType = "purchase_refunded";
    } else if (status === "chargeback") {
      baseType = "chargeback_created";
    } else if (
      status === "refused" ||
      status === "pix_expired" ||
      status === "close" ||
      status === "bank_slip_delayed" ||
      status === "subscription_canceled"
    ) {
      baseType = "purchase_canceled";
    } else if (status === "pix_created") {
      baseType = "pix_created";
    } else if (status === "bank_slip_created") {
      baseType = "boleto_created";
    } else if (status === "waiting_payment") {
      baseType = "payment_pending";
    }

    const txId = str(
      order.transaction_hash ||
      order.hash ||
      order.order_id ||
      order.id ||
      root.order_id ||
      root.transaction_hash ||
      root.id ||
      "ticto_tx",
    );
    const gross = (num(order.paid_amount ?? root.paid_amount ?? item.amount ?? root.amount) ?? 0) / 100;
    const feeRate = DEFAULT_PLATFORM_FEES.ticto.percent / 100;
    const feeFixed = DEFAULT_PLATFORM_FEES.ticto.fixed;
    const fee = gross > 0 ? Number((gross * feeRate + feeFixed).toFixed(2)) : 0;
    const net = Math.max(0, Number((gross - fee).toFixed(2)));

    const productId = str(item.product_id || item.product_name || "ticto_product");
    const offerId = str(item.offer_code || item.offer_id || item.offer_name) || null;

    const rawTracking = record(root.tracking);
    const tracking: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawTracking)) {
      const val = str(v);
      if (val && val.toLowerCase() !== "não informado" && val.toLowerCase() !== "nao informado") {
        tracking[k] = val;
      }
    }
    const attribution = extractAttribution(tracking);

    const buyerName = str(customer.name) || null;
    const buyerEmail = str(customer.email) || null;
    const address = record(customer.address);
    const country = cleanCountry(address.country || "BR");
    const occurredAt = parseDate(order.order_date || root.status_date, context.receivedAt);

    const mainEvent = normalizedPaymentEventSchema.parse({
      provider: "ticto",
      externalTransactionId: txId,
      externalEventId: str(order.id) || null,
      type: baseType,
      productId,
      offerId,
      productType: "main",
      parentProductId: null,
      parentTransactionId: null,
      grossAmount: gross,
      netAmount: net,
      fees: fee,
      grossCurrency: cleanCurrency(root.currency, context.fallbackCurrency || "BRL"),
      netCurrency: cleanCurrency(root.currency, context.fallbackCurrency || "BRL"),
      country,
      buyer: { name: buyerName, email: buyerEmail },
      attribution,
      campaignId: str(tracking.utm_campaign) || null,
      adsetId: str(tracking.utm_term) || null,
      adId: str(tracking.utm_content) || null,
      creativeId: str(tracking.utm_creative) || null,
      clickId: str(tracking.fbclid || tracking.sck || tracking.src) || null,
      occurredAt,
      receivedAt: context.receivedAt,
      isTest: false,
      rawPayload: redactPaymentPayload(payload),
    });

    const bumps = Array.isArray(root.bumps) ? root.bumps.map(record) : [];
    const bumpEvents = bumps.map((b, idx) => {
      const bumpGross = (num(b.offer_price) ?? 0) / 100;
      const bumpFee = bumpGross > 0 ? Number((bumpGross * feeRate).toFixed(2)) : 0;
      const bumpNet = Math.max(0, Number((bumpGross - bumpFee).toFixed(2)));
      return normalizedPaymentEventSchema.parse({
        provider: "ticto",
        externalTransactionId: `${txId}-bump-${idx + 1}`,
        externalEventId: str(b.offer_id) || null,
        type: baseType === "purchase_approved" ? "order_bump_approved" : baseType,
        productId: str(b.product_id || b.product_name || "ticto_bump"),
        offerId: str(b.offer_code || b.offer_id) || null,
        productType: "order_bump",
        parentProductId: productId,
        parentTransactionId: txId,
        grossAmount: bumpGross,
        netAmount: bumpNet,
        fees: bumpFee,
        grossCurrency: cleanCurrency(root.currency, context.fallbackCurrency || "BRL"),
        netCurrency: cleanCurrency(root.currency, context.fallbackCurrency || "BRL"),
        country,
        buyer: { name: buyerName, email: buyerEmail },
        attribution,
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid || tracking.sck || tracking.src) || null,
        occurredAt,
        receivedAt: context.receivedAt,
        isTest: false,
        rawPayload: redactPaymentPayload(payload),
      });
    });

    return [mainEvent, ...bumpEvents];
  },
};

// 16. ADAPTADOR LASTLINK (https://lastlink.com)
// Lastlink envia requisições HTTP POST em JSON com o formato:
// { Id, IsTest, Event, CreatedAt, Data: { Products, Buyer, Purchase, Offer, Utm, DeviceInfo } }
export const lastlinkAdapter: PaymentAdapter = {
  provider: "lastlink",
  normalize(payload, context) {
    const root = record(payload);
    const data = record(root.Data || root.data || root);
    const purchase = record(data.Purchase || data.purchase);
    const buyerObj = record(data.Buyer || data.buyer);
    const offer = record(data.Offer || data.offer);
    const rawUtm = record(data.Utm || data.utm || root.utm || root.tracking);
    const eventName = str(root.Event || root.event || root.status).toUpperCase();
    const paymentMethod = str(purchase.PaymentMethod || purchase.payment_method).toUpperCase();

    let baseType: PaymentEventType = "payment_pending";
    if (["PURCHASE_ORDER_CONFIRMED", "RECURRENT_PAYMENT", "PAYMENT_COMPLETED", "APPROVED", "PAID"].some((e) => eventName.includes(e))) {
      baseType = "purchase_approved";
    } else if (eventName.includes("REFUND")) {
      baseType = "purchase_refunded";
    } else if (eventName.includes("CHARGEBACK")) {
      baseType = "chargeback_created";
    } else if (eventName.includes("CANCEL") || eventName.includes("EXPIRED")) {
      baseType = "purchase_canceled";
    } else if (eventName.includes("CONFIRMED") || eventName.includes("WAITING") || eventName.includes("PENDING")) {
      if (paymentMethod.includes("PIX")) {
        baseType = "pix_created";
      } else if (paymentMethod.includes("BOLETO") || paymentMethod.includes("SLIP")) {
        baseType = "boleto_created";
      } else {
        baseType = "payment_pending";
      }
    }

    const txId = str(purchase.TransactionId || purchase.Id || root.Id) || "lastlink_tx";
    const grossTotal = num(purchase.Total || purchase.Value || root.total || root.amount);
    const feeRate = DEFAULT_PLATFORM_FEES.lastlink.percent / 100;
    const feeFixed = DEFAULT_PLATFORM_FEES.lastlink.fixed;

    const tracking: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawUtm)) {
      const val = str(v);
      if (!val) continue;
      const lowerKey = k.toLowerCase();
      if (lowerKey === "utmsource" || lowerKey === "source") tracking.utm_source = val;
      else if (lowerKey === "utmmedium" || lowerKey === "medium") tracking.utm_medium = val;
      else if (lowerKey === "utmcampaign" || lowerKey === "campaign") tracking.utm_campaign = val;
      else if (lowerKey === "utmterm" || lowerKey === "term") tracking.utm_term = val;
      else if (lowerKey === "utmcontent" || lowerKey === "content") tracking.utm_content = val;
      else tracking[lowerKey] = val;
    }
    const attribution = extractAttribution(tracking);

    const buyerName = str(buyerObj.Name || buyerObj.name) || null;
    const buyerEmail = str(buyerObj.Email || buyerObj.email) || null;
    const buyer = { name: buyerName, email: buyerEmail };
    const occurredAt = parseDate(purchase.ApprovedAt || purchase.CreatedAt || root.CreatedAt, context.receivedAt);
    const currency = cleanCurrency(purchase.Currency || root.currency, context.fallbackCurrency || "BRL");
    const isTest = Boolean(root.IsTest || root.is_test);

    const products = Array.isArray(data.Products) ? data.Products.map(record) : [];
    const lines = products.length
      ? products
      : [record({ Id: offer.Id || "lastlink_prod", Name: offer.Name, Price: grossTotal, IsOrderBump: false })];

    return lines.map((line, idx) => {
      const isBump = Boolean(line.IsOrderBump || line.is_order_bump);
      const productType = isBump ? "order_bump" : "main";
      const lineGross = num(line.Price || line.price || line.Total || line.total);
      const gross = lineGross !== null && lineGross !== undefined ? lineGross : (idx === 0 ? (grossTotal ?? 0) : 0);
      const fee = gross > 0 ? Number((gross * feeRate + (idx === 0 ? feeFixed : 0)).toFixed(2)) : 0;
      const net = Math.max(0, Number((gross - fee).toFixed(2)));
      const type: PaymentEventType =
        baseType === "purchase_approved" && isBump ? "order_bump_approved" : baseType;

      return normalizedPaymentEventSchema.parse({
        provider: "lastlink",
        externalTransactionId: idx === 0 ? txId : `${txId}-bump-${idx}`,
        externalEventId: str(root.Id) || null,
        type,
        productId: str(line.Id || line.id || offer.Id || "lastlink_prod"),
        offerId: str(offer.Id || offer.id) || null,
        productType,
        parentProductId: idx > 0 ? str(lines[0]?.Id || lines[0]?.id || offer.Id) || null : null,
        parentTransactionId: idx > 0 ? txId : null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: currency,
        netCurrency: currency,
        country: cleanCountry(buyerObj.Country || buyerObj.country || "BR"),
        buyer,
        attribution,
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId: str(tracking.fbclid || tracking.fbc || tracking.src || tracking.sck || rawUtm.Src || rawUtm.Sck) || null,
        occurredAt,
        receivedAt: context.receivedAt,
        isTest,
        rawPayload: redactPaymentPayload(payload),
      });
    });
  },
};

// 17. ADAPTADOR HUBLA (https://hubla.app)
// Hubla envia webhooks v2 no formato:
// { type: "invoice.payment_succeeded", event: { invoice, product, products, user, paymentSession } }
export const hublaAdapter: PaymentAdapter = {
  provider: "hubla",
  normalize(payload, context) {
    const root = record(payload);
    const eventObj = record(root.event || root.data || root);
    const invoice = record(eventObj.invoice);
    const product = record(eventObj.product);
    const user = record(eventObj.user || eventObj.customer);
    const payer = record(invoice.payer || user);
    const paymentSession = record(invoice.paymentSession);
    const cookies = record(paymentSession.cookies);
    const rawUtm = record(paymentSession.utm || root.tracking || root.utm);
    const params = record(paymentSession.params);

    const rawType = str(root.type || root.event_type || root.event).toLowerCase();
    const invoiceStatus = str(invoice.status).toLowerCase();
    const paymentMethod = str(invoice.paymentMethod || invoice.payment_method).toLowerCase();

    let type: PaymentEventType = "payment_pending";
    if (
      rawType === "invoice.payment_succeeded" ||
      rawType === "invoice.paid" ||
      (rawType === "invoice.status_updated" && invoiceStatus === "paid") ||
      invoiceStatus === "paid"
    ) {
      type = "purchase_approved";
    } else if (rawType === "invoice.refunded" || invoiceStatus === "refunded") {
      type = "purchase_refunded";
    } else if (
      rawType.includes("chargeback") ||
      rawType.includes("dispute") ||
      invoiceStatus.includes("chargeback")
    ) {
      type = "chargeback_created";
    } else if (
      rawType === "invoice.expired" ||
      rawType === "invoice.payment_failed" ||
      rawType === "invoice.canceled" ||
      invoiceStatus === "expired" ||
      invoiceStatus === "canceled"
    ) {
      type = "purchase_canceled";
    } else if (
      rawType === "invoice.created" ||
      (rawType === "invoice.status_updated" && invoiceStatus === "unpaid") ||
      invoiceStatus === "unpaid"
    ) {
      if (paymentMethod.includes("pix")) {
        type = "pix_created";
      } else if (paymentMethod.includes("bank_slip") || paymentMethod.includes("boleto")) {
        type = "boleto_created";
      } else {
        type = "payment_pending";
      }
    }

    const txId = str(invoice.id || invoice.orderId || root.id) || "hubla_tx";

    // Valores em centavos na Hubla v2 (invoice.amount.totalCents)
    const amountObj = record(invoice.amount);
    const totalCents = num(amountObj.totalCents);
    let gross: number;
    if (totalCents !== null && totalCents !== undefined) {
      gross = Number((totalCents / 100).toFixed(2));
    } else {
      const rawGross = num(invoice.total_amount ?? invoice.amount ?? invoice.price ?? root.amount) ?? 0;
      gross = Number.isInteger(rawGross) && rawGross >= 100 ? Number((rawGross / 100).toFixed(2)) : rawGross;
    }

    // Taxas da plataforma em receivers[role=platform]
    const receivers = Array.isArray(invoice.receivers) ? invoice.receivers.map(record) : [];
    const platformReceiver = receivers.find((r) => str(r.role).toLowerCase() === "platform");
    const platformFeeCents = num(platformReceiver?.totalCents);
    let fee: number;
    if (platformFeeCents !== null && platformFeeCents !== undefined) {
      fee = Number((platformFeeCents / 100).toFixed(2));
    } else {
      const feeRate = DEFAULT_PLATFORM_FEES.hubla.percent / 100;
      const feeFixed = DEFAULT_PLATFORM_FEES.hubla.fixed;
      fee = gross > 0 ? Number((gross * feeRate + feeFixed).toFixed(2)) : 0;
    }
    const net = Math.max(0, Number((gross - fee).toFixed(2)));

    const tracking: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...rawUtm, ...params })) {
      const val = str(v);
      if (!val) continue;
      const lowerKey = k.toLowerCase();
      if (lowerKey === "source") tracking.utm_source = val;
      else if (lowerKey === "medium") tracking.utm_medium = val;
      else if (lowerKey === "campaign") tracking.utm_campaign = val;
      else if (lowerKey === "content") tracking.utm_content = val;
      else if (lowerKey === "term") tracking.utm_term = val;
      else tracking[lowerKey] = val;
    }
    const attribution = extractAttribution(tracking);

    const firstName = str(payer.firstName || payer.first_name || user.firstName);
    const lastName = str(payer.lastName || payer.last_name || user.lastName);
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || str(payer.name || user.name) || null;
    const buyerEmail = str(payer.email || user.email) || null;
    const buyer = { name: fullName, email: buyerEmail };

    const billingAddress = record(invoice.billingAddress || invoice.address);
    const country = cleanCountry(billingAddress.countryCode || billingAddress.country || "BR");
    const currency = cleanCurrency(invoice.currency || root.currency, context.fallbackCurrency || "BRL");
    const occurredAt = parseDate(invoice.saleDate || invoice.createdAt || root.createdAt, context.receivedAt);

    const productId = str(product.id || "hubla_prod");
    const clickId = str(cookies.fbclid || cookies.fbp || params.SCK || params.sck || params.src || tracking.src || tracking.sck) || null;

    return [
      normalizedPaymentEventSchema.parse({
        provider: "hubla",
        externalTransactionId: txId,
        externalEventId: str(root.id) || null,
        type,
        productId,
        offerId: null,
        productType: "main",
        parentProductId: null,
        parentTransactionId: null,
        grossAmount: gross,
        netAmount: net,
        fees: fee,
        grossCurrency: currency,
        netCurrency: currency,
        country,
        buyer,
        attribution,
        campaignId: str(tracking.utm_campaign) || null,
        adsetId: str(tracking.utm_term) || null,
        adId: str(tracking.utm_content) || null,
        creativeId: str(tracking.utm_creative) || null,
        clickId,
        occurredAt,
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
  lowfy: lowfyAdapter,
  greenn: greennAdapter,
  stripe: stripeAdapter,
  yampi: yampiAdapter,
  perfectpay: perfectpayAdapter,
  cartpanda: cartpandaAdapter,
  shopify: shopifyAdapter,
  ticto: tictoAdapter,
  lastlink: lastlinkAdapter,
  hubla: hublaAdapter,
};
