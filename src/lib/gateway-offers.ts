import "server-only";
import type { admin } from "@/lib/supabase/server";
import type { CatalogProvider, GatewayProduct } from "@/lib/gateway-catalog";
import { DEFAULT_PLATFORM_FEES, type PaymentProvider } from "@/lib/payment-contract";

export type ImportedGatewayItem = { integrationId: string; offerId: string; productName: string };

const DEFAULT_LANDING_URLS: Partial<Record<PaymentProvider, string>> = {
  hotmart: "https://hotmart.com",
  kiwify: "https://kiwify.com.br",
  cakto: "https://cakto.com.br",
};

/** Cria a oferta + integração para um único produto já resolvido do catálogo do gateway (ou descoberto via webhook). */
export async function createOfferAndIntegrationForProduct(
  service: ReturnType<typeof admin>,
  workspace: string,
  provider: CatalogProvider | PaymentProvider,
  product: GatewayProduct,
  status: "connected" | "pending",
): Promise<{ integrationId: string; offerId: string }> {
  const landingUrl = product.checkoutUrl || DEFAULT_LANDING_URLS[provider as PaymentProvider] || "https://trackbase.com.br";
  const defaultFees = DEFAULT_PLATFORM_FEES[provider as PaymentProvider];
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
      percent_fee: defaultFees?.percent ?? 0,
      fixed_fee: defaultFees?.fixed ?? 0,
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
 * precisa representar um único produto: qualquer produto vendido pela mesma
 * conta pode chegar na mesma URL, para qualquer gateway — o cliente nunca
 * precisa digitar nome/ID de produto na hora de conectar. Resolve para o
 * produto já conhecido (o próprio hub, se já foi vinculado a um produto, ou
 * uma integração satélite já descoberta antes); se o hub ainda não tem
 * nenhum produto vinculado, a primeira venda aprovada o vincula direto (sem
 * criar uma linha nova); se o hub já pertence a outro produto e chega um
 * `productId` diferente, cria um satélite novo. Só age em cima de uma venda
 * aprovada de verdade — nunca a partir de um payload de teste ou pendente,
 * para não encher o painel de ofertas-fantasma.
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

  if (!isApproved) return null;

  const productName = fallbackName || `${String(provider).toUpperCase()} · ${productId}`;

  // Hub ainda sem nenhum produto vinculado (conexão recém-criada, sem
  // "Nome do produto"/"ID do produto" preenchidos à mão): a primeira venda
  // aprovada vincula o próprio hub, sem gerar uma linha satélite.
  if (!hub.offer_id) {
    const { data: offer, error: offerError } = await service
      .from("utm_offers")
      .insert({
        workspace_id: hub.workspace_id,
        name: productName,
        landing_url: DEFAULT_LANDING_URLS[provider as PaymentProvider] || "https://trackbase.com.br",
        currency: fallbackCurrency || hub.currency || "BRL",
        platform: provider,
        external_product_id: productId,
        external_offer_id: offerId,
        percent_fee: DEFAULT_PLATFORM_FEES[provider as PaymentProvider]?.percent ?? 0,
        fixed_fee: DEFAULT_PLATFORM_FEES[provider as PaymentProvider]?.fixed ?? 0,
      })
      .select("id,name")
      .single();
    if (offerError || !offer) throw offerError || new Error("Não foi possível criar a oferta.");

    const { error: bindError } = await service
      .from("utm_integrations")
      .update({
        offer_id: offer.id,
        name: `${String(provider).toUpperCase()} · ${offer.name}`,
        external_product_id: productId,
        external_offer_id: offerId,
      })
      .eq("id", hub.id)
      .eq("workspace_id", hub.workspace_id);
    if (bindError) {
      await service.from("utm_offers").delete().eq("id", offer.id).eq("workspace_id", hub.workspace_id);
      throw bindError;
    }
    return { id: hub.id, offer_id: offer.id, name: offer.name };
  }

  // Hub já vinculado a outro produto e chegou um `productId` novo: essa é a
  // conta com mais de um produto atrás do mesmo webhook — cria um satélite.
  const created = await createOfferAndIntegrationForProduct(
    service,
    hub.workspace_id,
    provider as PaymentProvider,
    {
      externalProductId: productId,
      externalOfferId: offerId,
      name: productName,
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
  return { id: created.integrationId, offer_id: created.offerId, name: productName };
}
