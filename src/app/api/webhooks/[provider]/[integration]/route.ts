import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/server";
import { decrypt, matches, rateLimit, rawBody, body } from "@/lib/security";
import { createHmac, timingSafeEqual } from "node:crypto";
import { paymentProviders, type PaymentProvider } from "@/lib/payment-contract";
import { z } from "zod";
import { enqueueWebhook, processPaymentWebhook } from "@/lib/webhook-processor";


function extractWebhookToken(
  provider: string,
  request: Request,
  payload: unknown,
): string {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<
    string,
    unknown
  >;
  const url = new URL(request.url);

  if (provider === "hotmart") {
    return (
      request.headers.get("x-hotmart-hottok") ||
      String(p.hottok || p.token || "")
    );
  }
  if (provider === "kiwify") {
    return (
      request.headers.get("x-kiwify-signature") ||
      String(p.signature || p.token || url.searchParams.get("token") || "")
    );
  }
  if (provider === "cakto") {
    return (
      request.headers.get("x-cakto-secret") || String(p.secret || p.token || "")
    );
  }
  if (provider === "kirvano") {
    return (
      request.headers.get("x-kirvano-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.secret || p.token || url.searchParams.get("token") || "")
    );
  }
  if (provider === "eduzz") {
    return (
      request.headers.get("x-eduzz-signature") ||
      request.headers.get("eduzz-token") ||
      String(p.api_key || p.secret || p.token || "")
    );
  }
  if (provider === "monetizze") {
    return (
      request.headers.get("x-monetizze-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.chave_unica || p.token || p.secret || url.searchParams.get("token") || "")
    );
  }
  if (provider === "lastlink") {
    return (
      request.headers.get("x-lastlink-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.token || p.Token || p.secret || url.searchParams.get("token") || "")
    );
  }
  if (provider === "hubla") {
    return (
      request.headers.get("x-hubla-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.token || p.secret || url.searchParams.get("token") || "")
    );
  }
  if (provider === "wiapy") {
    return (
      request.headers.get("x-wiapy-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.secret || p.token || url.searchParams.get("token") || "")
    );
  }
  if (provider === "perfectpay") {
    return (
      String(p.token || request.headers.get("x-perfectpay-token") || url.searchParams.get("token") || "")
    );
  }
  if (provider === "cartpanda") {
    return (
      request.headers.get("x-cartpanda-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.token || url.searchParams.get("token") || "")
    );
  }
  if (provider === "shopify") {
    return (
      request.headers.get("x-shopify-hmac-sha256") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(p.token || url.searchParams.get("token") || "")
    );
  }
  if (provider === "ticto") {
    return (
      String(
        p.token ||
        request.headers.get("x-ticto-token") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        url.searchParams.get("token") ||
        ""
      )
    );
  }
  if (provider === "lowfy") {
    return (
      request.headers.get("x-lowfy-token") ||
      request.headers.get("x-lowfy-signature") ||
      request.headers.get("x-lowfy-secret") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(
        p.token ||
        p.secret ||
        p.signature ||
        p.api_key ||
        url.searchParams.get("token") ||
        url.searchParams.get("secret") ||
        ""
      )
    );
  }
  if (provider === "greenn") {
    return (
      request.headers.get("x-greenn-token") ||
      request.headers.get("x-greenn-signature") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(
        p.token ||
        p.secret ||
        url.searchParams.get("token") ||
        url.searchParams.get("secret") ||
        ""
      )
    );
  }
  if (provider === "stripe") {
    return (
      request.headers.get("stripe-signature") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(
        p.token ||
        p.secret ||
        url.searchParams.get("token") ||
        url.searchParams.get("secret") ||
        ""
      )
    );
  }
  if (provider === "yampi") {
    return (
      request.headers.get("x-yampi-hmac-sha256") ||
      request.headers.get("x-yampi-token") ||
      request.headers.get("x-token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      String(
        p.token ||
        p.secret ||
        p.signature ||
        url.searchParams.get("token") ||
        url.searchParams.get("secret") ||
        ""
      )
    );
  }
  return "";
}

function validCaktoSignature(
  request: Request,
  raw: string,
  secret: string,
): boolean {
  const timestamp = request.headers.get("x-cakto-timestamp")?.trim();
  const signature = request.headers.get("x-cakto-signature")?.trim();
  if (!timestamp || !signature || !/^\d{10,13}$/.test(timestamp)) return false;

  const timestampMs = Number(timestamp.length === 10 ? `${timestamp}000` : timestamp);
  if (!Number.isSafeInteger(timestampMs) || Math.abs(Date.now() - timestampMs) > 300_000) {
    return false;
  }

  const received = signature.replace(/^v1=/i, "");
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function validYampiSignature(
  request: Request,
  raw: string,
  secret: string,
): boolean {
  const signature = (
    request.headers.get("x-yampi-hmac-sha256") ||
    request.headers.get("x-yampi-signature") ||
    ""
  ).trim();
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function validShopifySignature(
  request: Request,
  raw: string,
  secret: string,
): boolean {
  const signature = (
    request.headers.get("x-shopify-hmac-sha256") ||
    ""
  ).trim();
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validStripeSignature(
  request: Request,
  raw: string,
  secret: string,
): boolean {
  const header = (request.headers.get("stripe-signature") || "").trim();
  if (!header) return false;

  let timestamp = "";
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const [k, v] = part.split("=").map((s) => s?.trim());
    if (k === "t") timestamp = v || "";
    if (k === "v1" && v) signatures.push(v);
  }

  if (!timestamp || signatures.length === 0 || !/^\d{10,13}$/.test(timestamp)) {
    return false;
  }

  const timestampMs = Number(timestamp.length === 10 ? `${timestamp}000` : timestamp);
  if (!Number.isSafeInteger(timestampMs) || Math.abs(Date.now() - timestampMs) > 300_000) {
    return false;
  }

  const payloadToSign = `${timestamp}.${raw}`;
  const expected = createHmac("sha256", secret).update(payloadToSign, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  for (const sig of signatures) {
    if (/^[a-f0-9]{64}$/i.test(sig)) {
      const sigBuf = Buffer.from(sig, "hex");
      if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
        return true;
      }
    }
  }

  return false;
}



export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string; integration: string }> },
) {
  const { provider, integration } = await params;

  if (
    !paymentProviders.includes(provider as PaymentProvider) ||
    !z.string().uuid().safeParse(integration).success
  ) {
    return NextResponse.json({ error: "Endpoint inválido." }, { status: 404 });
  }

  try {
    const service = admin();
    const { data: i } = await service
      .from("utm_integrations")
      .select(
        "id,workspace_id,offer_id,name,external_product_id,external_offer_id,currency",
      )
      .eq("id", integration)
      .eq("provider", provider)
      .single();

    if (!i) {
      return NextResponse.json(
        { error: "Integração inexistente." },
        { status: 404 },
      );
    }

    const { data: credentials } = await service
      .from("utm_credentials")
      .select("webhook_hash,webhook_secret_ciphertext")
      .eq("integration_id", integration)
      .single();

    let payload: unknown;
    let raw: string | undefined;
    try {
      if (provider === "cakto" || provider === "yampi" || provider === "shopify" || provider === "stripe") {
        raw = await rawBody(request);
        payload = JSON.parse(raw);
      } else {
        payload = await body(request);
      }
    } catch {
      return NextResponse.json(
        { error: "JSON inválido ou muito grande." },
        { status: 400 },
      );
    }

    const signedCaktoRequest =
      provider === "cakto" &&
      raw !== undefined &&
      credentials?.webhook_secret_ciphertext &&
      validCaktoSignature(
        request,
        raw,
        decrypt(credentials.webhook_secret_ciphertext),
      );
    const signedYampiRequest =
      provider === "yampi" &&
      raw !== undefined &&
      credentials?.webhook_secret_ciphertext &&
      validYampiSignature(
        request,
        raw,
        decrypt(credentials.webhook_secret_ciphertext),
      );
    const signedShopifyRequest =
      provider === "shopify" &&
      raw !== undefined &&
      credentials?.webhook_secret_ciphertext &&
      validShopifySignature(
        request,
        raw,
        decrypt(credentials.webhook_secret_ciphertext),
      );
    const signedStripeRequest =
      provider === "stripe" &&
      raw !== undefined &&
      credentials?.webhook_secret_ciphertext &&
      validStripeSignature(
        request,
        raw,
        decrypt(credentials.webhook_secret_ciphertext),
      );
    const token = extractWebhookToken(provider, request, payload);
    const legacyTokenMatches =
      !!credentials?.webhook_hash && matches(token, credentials.webhook_hash);
    const authenticated =
      (provider === "cakto" && credentials?.webhook_secret_ciphertext && signedCaktoRequest) ||
      (provider === "yampi" && credentials?.webhook_secret_ciphertext && signedYampiRequest) ||
      (provider === "shopify" && credentials?.webhook_secret_ciphertext && signedShopifyRequest) ||
      (provider === "stripe" && credentials?.webhook_secret_ciphertext && signedStripeRequest) ||
      legacyTokenMatches;
    if (!authenticated) {
      return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    }

    if (!(await rateLimit(`webhook:${integration}`, 300))) {
      return NextResponse.json(
        { error: "Limite de requisições." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    let response: NextResponse | null = null;
    let failure: unknown = null;
    try {
      response = await processPaymentWebhook(service, provider, integration, i, payload);
    } catch (error) {
      failure = error;
    }
    if (response && response.status !== 503) return response;

    console.error("Payment webhook processing failed", { provider, integration, error: failure });
    // Cakto never retries a non-2xx answer, so a 503 would lose the sale for
    // good. Park the authenticated payload in the inbox (replayed by the cron)
    // and acknowledge; if even that fails, fall back to the 503.
    if (provider === "cakto" && (await enqueueWebhook(service, provider, i, payload, failure))) {
      return NextResponse.json({ received: true, status: "queued" }, { status: 200 });
    }
    return (
      response ??
      NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 })
    );
  } catch (error) {
    console.error("Payment webhook processing failed", { provider, integration, error });
    return NextResponse.json(
      { error: "Serviço temporariamente indisponível." },
      { status: 503 },
    );
  }
}
