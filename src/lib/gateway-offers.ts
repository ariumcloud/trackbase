import "server-only";
import type { admin } from "@/lib/supabase/server";
import type { CatalogProvider, GatewayProduct } from "@/lib/gateway-catalog";

export type ImportedGatewayItem = { integrationId: string; offerId: string; productName: string };

/** Cria a oferta + integração para um único produto já resolvido do catálogo do gateway. */
export async function createOfferAndIntegrationForProduct(
  service: ReturnType<typeof admin>,
  workspace: string,
  provider: CatalogProvider,
  product: GatewayProduct,
  status: "connected" | "pending",
): Promise<{ integrationId: string; offerId: string }> {
  const landingUrl = product.checkoutUrl || {
    hotmart: "https://hotmart.com",
    kiwify: "https://kiwify.com.br",
    cakto: "https://cakto.com.br",
  }[provider];
  const { data: offer, error: offerError } = await service
    .from("utm_offers")
    .insert({
      workspace_id: workspace,
      name: product.name,
      landing_url: landingUrl,
      checkout_url: product.checkoutUrl,
      currency: product.currency,
      platform: provider,
      external_product_id: product.externalProductId,
      external_offer_id: product.externalOfferId,
    })
    .select("id")
    .single();
  if (offerError || !offer) throw offerError || new Error("Não foi possível criar a oferta.");

  const { data: integration, error: integrationError } = await service
    .from("utm_integrations")
    .insert({
      workspace_id: workspace,
      offer_id: offer.id,
      provider,
      name: `${provider.toUpperCase()} · ${product.name}`,
      external_product_id: product.externalProductId,
      external_offer_id: product.externalOfferId,
      currency: product.currency,
      status,
    })
    .select("id")
    .single();
  if (integrationError || !integration) {
    await service.from("utm_offers").delete().eq("id", offer.id).eq("workspace_id", workspace);
    throw integrationError || new Error("Não foi possível criar a integração.");
  }
  return { integrationId: integration.id, offerId: offer.id };
}

export type Hub = {
  id: string;
  workspace_id: string;
  offer_id: string | null;
  name: string;
  external_product_id: string | null;
  external_offer_id: string | null;
  currency: string | null;
};

export type ResolvedTarget = { id: string; offer_id: string; name: string };

/**
 * Uma "conexão" (hub) autentica o webhook e guarda as credenciais, mas não
 * precisa mais representar um único produto: qualquer produto vendido pela
 * mesma conta pode chegar na mesma URL. Resolve para o produto já conhecido
 * (o próprio hub, se foi configurado manualmente, ou uma integração satélite
 * já descoberta antes) e, só quando o evento é uma venda aprovada de verdade,
 * cria um satélite novo na hora — nunca a partir de um payload de teste ou
 * pendente, para não encher o painel de ofertas-fantasma.
 */
export async function resolveProductTarget(
  service: ReturnType<typeof admin>,
  hub: Hub,
  provider: CatalogProvider | string,
  productId: string,
  offerId: string | null,
  isApproved: boolean,
  fallbackName: string | null,
  fallbackCurrency: string | null,
): Promise<ResolvedTarget | null> {
  if (!productId) return null;

  if (hub.offer_id && hub.external_product_id === productId && (!hub.external_offer_id || offerId === hub.external_offer_id)) {
    return { id: hub.id, offer_id: hub.offer_id, name: hub.name };
  }

  const { data: candidates } = await service
    .from("utm_integrations")
    .select("id, offer_id, name, external_offer_id")
    .eq("workspace_id", hub.workspace_id)
    .eq("provider", provider)
    .not("offer_id", "is", null)
    .or(`id.eq.${hub.id},parent_integration_id.eq.${hub.id}`)
    .eq("external_product_id", productId);
  const existing = (candidates || []).find((c) => !c.external_offer_id || c.external_offer_id === offerId);
  if (existing && existing.offer_id) return { id: existing.id, offer_id: existing.offer_id, name: existing.name };

  // Auto-creating a fresh product only makes sense for gateways Trackbase has
  // a real catalog API for (checkout URL, currency, canonical name). The
  // other providers only ever configure one product per integration through
  // the manual form, so an unmatched event there stays a plain rejection —
  // never silently spawns a same-shaped offer with guessed data.
  const catalogProviders: string[] = ["hotmart", "kiwify", "cakto"];
  if (!isApproved || !catalogProviders.includes(provider)) return null;

  const created = await createOfferAndIntegrationForProduct(
    service,
    hub.workspace_id,
    provider as CatalogProvider,
    {
      externalProductId: productId,
      externalOfferId: offerId,
      name: fallbackName || `${String(provider).toUpperCase()} · ${productId}`,
      currency: fallbackCurrency || hub.currency || "BRL",
      price: null,
      checkoutUrl: null,
    },
    "connected",
  );
  await service.from("utm_integrations").update({ parent_integration_id: hub.id }).eq("id", created.integrationId);
  const { data: hubCredential } = await service
    .from("utm_credentials")
    .select("api_credentials_ciphertext")
    .eq("integration_id", hub.id)
    .maybeSingle();
  if (hubCredential?.api_credentials_ciphertext) {
    await service.from("utm_credentials").insert({
      workspace_id: hub.workspace_id,
      integration_id: created.integrationId,
      api_credentials_ciphertext: hubCredential.api_credentials_ciphertext,
    });
  }
  return { id: created.integrationId, offer_id: created.offerId, name: fallbackName || `${String(provider).toUpperCase()} · ${productId}` };
}
