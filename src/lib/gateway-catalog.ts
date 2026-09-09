import "server-only";

export type CatalogProvider = "hotmart" | "kiwify" | "cakto";

export type GatewayCredentials = {
  clientId: string;
  clientSecret: string;
  accountId?: string;
  basicToken?: string;
};

export type GatewayProduct = {
  externalProductId: string;
  externalOfferId: string | null;
  name: string;
  currency: string;
  price: number | null;
  checkoutUrl: string | null;
};

export class GatewayCatalogError extends Error {}

async function json(response: Response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = [value?.message, value?.detail, value?.error]
      .find((item): item is string => typeof item === "string" && Boolean(item.trim()))
      || "Credenciais inválidas ou sem permissão para listar produtos.";
    throw new GatewayCatalogError(message);
  }
  return value;
}

async function caktoToken(credentials: GatewayCredentials) {
  const response = await fetch("https://api.cakto.com.br/public_api/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const value = await json(response);
  if (!value.access_token) throw new GatewayCatalogError("A Cakto não retornou um token de acesso.");
  return String(value.access_token);
}

async function kiwifyToken(credentials: GatewayCredentials) {
  const response = await fetch("https://public-api.kiwify.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const value = await json(response);
  if (!value.access_token) throw new GatewayCatalogError("A Kiwify não retornou um token de acesso.");
  return String(value.access_token);
}

async function hotmartToken(credentials: GatewayCredentials) {
  if (!credentials.basicToken) throw new GatewayCatalogError("Informe o token Basic da credencial Hotmart.");
  const query = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });
  const response = await fetch(`https://api-sec-vlc.hotmart.com/security/oauth/token?${query}`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials.basicToken}`, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const value = await json(response);
  if (!value.access_token) throw new GatewayCatalogError("A Hotmart não retornou um token de acesso.");
  return String(value.access_token);
}

export async function listGatewayProducts(provider: CatalogProvider, credentials: GatewayCredentials): Promise<GatewayProduct[]> {
  if (provider === "cakto") {
    const token = await caktoToken(credentials);
    const response = await fetch("https://api.cakto.com.br/public_api/products/?limit=100", {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    const value = await json(response);
    return (Array.isArray(value.results) ? value.results : []).map((item: Record<string, unknown>) => ({
      externalProductId: String(item.id || item.product_id), externalOfferId: null, name: String(item.name || "Produto sem nome"),
      currency: "BRL", price: typeof item.price === "number" ? item.price : null,
      checkoutUrl: typeof item.salesPage === "string" ? item.salesPage : null,
    }));
  }

  if (provider === "kiwify") {
    if (!credentials.accountId) throw new GatewayCatalogError("Informe o Account ID da Kiwify.");
    const token = await kiwifyToken(credentials);
    const response = await fetch("https://public-api.kiwify.com/v1/products?page_size=100&page_number=1", {
      headers: { Authorization: `Bearer ${token}`, "x-kiwify-account-id": credentials.accountId },
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    const value = await json(response);
    return (Array.isArray(value.data) ? value.data : []).map((item: Record<string, unknown>) => ({
      externalProductId: String(item.product_id || item.id), externalOfferId: null, name: String(item.name || "Produto sem nome"),
      currency: typeof item.currency === "string" ? item.currency : "BRL",
      price: typeof item.price === "number" ? item.price : null, checkoutUrl: null,
    }));
  }

  const token = await hotmartToken(credentials);
  const response = await fetch("https://developers.hotmart.com/products/api/v1/products?max_results=100&status=ACTIVE", {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  const value = await json(response);
  return (Array.isArray(value.items) ? value.items : []).map((item: Record<string, unknown>) => {
    const rawCurrency =
      typeof item.currency_code === "string"
        ? item.currency_code
        : typeof item.currency === "string"
          ? item.currency
          : "BRL";
    const rawPrice =
      typeof item.price === "number"
        ? item.price
        : typeof (item.price as Record<string, unknown>)?.value === "number"
          ? ((item.price as Record<string, unknown>).value as number)
          : null;
    return {
      // O webhook da Hotmart entrega data.product.id; ucode é apenas o código
      // alternativo usado pela API de catálogo e não pode ser usado para conciliar vendas.
      externalProductId: String(item.id || item.ucode),
      externalOfferId: null,
      name: String(item.name || "Produto sem nome"),
      currency: rawCurrency,
      price: rawPrice,
      checkoutUrl: typeof item.salesPage === "string" ? item.salesPage : null,
    };
  });
}
