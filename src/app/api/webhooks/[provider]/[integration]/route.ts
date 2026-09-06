import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/server";
import { body, digest, matches, rateLimit } from "@/lib/security";
import { normalizePayment } from "@/lib/payments";
import { sendCapiEvent } from "@/lib/capi";
import { z } from "zod";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string; integration: string }> },
) {
  const { provider, integration } = await params;
  if (
    !["hotmart", "cakto"].includes(provider) ||
    !z.string().uuid().safeParse(integration).success
  )
    return NextResponse.json({ error: "Endpoint inválido." }, { status: 404 });
  try {
    if (!(await rateLimit(`webhook:${integration}`, 300)))
      return NextResponse.json(
        { error: "Limite de requisições." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    const service = admin();
    const { data: i } = await service
      .from("utm_integrations")
      .select("id,workspace_id,offer_id,external_product_id,external_offer_id,currency")
      .eq("id", integration)
      .eq("provider", provider)
      .single();
    if (!i)
      return NextResponse.json(
        { error: "Integração inexistente." },
        { status: 404 },
      );
    const { data: credentials } = await service
      .from("utm_credentials")
      .select("webhook_hash")
      .eq("integration_id", integration)
      .single();
    let payload: unknown;
    try {
      payload = await body(request);
    } catch {
      return NextResponse.json(
        { error: "JSON inválido ou muito grande." },
        { status: 400 },
      );
    }
    const token =
      provider === "hotmart"
        ? (request.headers.get("x-hotmart-hottok") ?? "")
        : String((payload as Record<string, unknown>)?.secret ?? "");
    if (!credentials?.webhook_hash || !matches(token, credentials.webhook_hash))
      return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    let payment;
    try {
      payment = normalizePayment(
        provider as "hotmart" | "cakto",
        payload,
        i.currency,
      );
    } catch {
      const { error } = await service
        .from("utm_webhook_logs")
        .upsert(
          {
            workspace_id: i.workspace_id,
            integration_id: integration,
            event_id: `invalid:${digest(JSON.stringify(payload))}`,
            status: "invalid",
            reason: "Evento, valor ou data não reconhecidos.",
          },
          { onConflict: "integration_id,event_id", ignoreDuplicates: true },
        );
      return NextResponse.json(
        { received: !error, status: "invalid" },
        { status: error ? 503 : 202 },
      );
    }
    if (
      payment.product_id !== i.external_product_id ||
      (i.external_offer_id && payment.external_offer_id !== i.external_offer_id)
    ) {
      const { error } = await service
        .from("utm_webhook_logs")
        .upsert(
          {
            workspace_id: i.workspace_id,
            integration_id: integration,
            event_id: payment.event_id,
            status: "ignored",
            reason: "Produto/oferta não corresponde à integração.",
            is_test: payment.is_test,
          },
          { onConflict: "integration_id,event_id", ignoreDuplicates: true },
        );
      return NextResponse.json(
        { status: "ignored" },
        { status: error ? 503 : 202 },
      );
    }
    const { data, error } = await service.rpc("utm_process_payment", {
      p_integration: integration,
      p_payment: payment,
    });

    if (data === "processed" && !payment.is_test) {
      const eventName =
        payment.status === "approved"
          ? "Purchase"
          : payment.status === "refunded"
            ? "Refund"
            : null;

      if (eventName) {
        sendCapiEvent({
          workspaceId: i.workspace_id,
          offerId: i.offer_id,
          eventName,
          eventId: `tx_${payment.transaction_id}_${payment.product_type}`,
          customData: {
            value: payment.gross_amount,
            currency: payment.currency,
          },
          userData: {
            email: payment.buyer_email,
            phone: payment.buyer_phone,
            firstName: payment.buyer_name,
            fbp: payment.attribution?.fbp || null,
            fbc: payment.attribution?.fbc || null,
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json(
      error
        ? { error: "Falha temporária ao persistir." }
        : { received: true, status: data },
      { status: error ? 503 : 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Serviço temporariamente indisponível." },
      { status: 503 },
    );
  }
}
