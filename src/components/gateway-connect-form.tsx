"use client";
import { gatewayWebhookUrl } from "@/lib/webhook-url";

import { useEffect, useState, useTransition } from "react";
import {
  connectAdditionalGatewayProduct,
  connectImportedGateway,
  listSavedGatewayProducts,
  saveGatewayWebhookSecret,
  savePaymentIntegration,
} from "@/app/actions";

type Provider = "hotmart" | "kiwify" | "cakto" | "kirvano" | "eduzz" | "monetizze" | "wiapy" | "lowfy" | "greenn";
type CatalogProvider = "hotmart" | "kiwify" | "cakto";
type Product = {
  externalProductId: string;
  externalOfferId: string | null;
  name: string;
  currency: string;
  price: number | null;
};

const providerNames: Record<Provider, string> = {
  hotmart: "Hotmart",
  kiwify: "Kiwify",
  cakto: "Cakto",
  kirvano: "Kirvano",
  eduzz: "Eduzz",
  monetizze: "Monetizze",
  wiapy: "Wiapy",
  lowfy: "Lowfy",
  greenn: "Greenn",
};

type ManualProviderConfig = {
  credential: string;
  where: string;
  events: string;
  product: string;
  productHelp: string;
  productPlaceholder?: string;
  credentialHelp: string;
  directUrl?: string;
};

const manualProviders: Record<string, ManualProviderConfig> = {
  hotmart: {
    credential: "Hottok de verificação",
    where: "Ferramentas > Webhook",
    events: "Compra aprovada, Compra completa, Reembolso e Disputa",
    product: "ID numérico do produto na Hotmart",
    productHelp: "Encontre em Produtos > Meus Produtos (é o número de 7 dígitos abaixo do título do produto, ex.: 8456025).",
    productPlaceholder: "Ex.: 8456025",
    credentialHelp: "Na Hotmart, vá em Ferramentas > Webhook, clique na aba 'Autenticação' no topo e copie o Hottok de verificação.",
    directUrl: "https://app-vlc.hotmart.com/tools/webhook",
  },
  kiwify: {
    credential: "Token ou assinatura do webhook",
    where: "Configurações > Webhooks",
    events: "Pedido aprovado, Reembolso e Chargeback",
    product: "ID do produto na Kiwify",
    productHelp: "O código do produto na Kiwify (visível na URL ao editar o produto).",
    productPlaceholder: "Ex.: abc12345",
    credentialHelp: "Na Kiwify, acesse Configurações > Webhooks e copie o token gerado.",
    directUrl: "https://dashboard.kiwify.com.br/webhooks",
  },
  cakto: {
    credential: "Secret do webhook",
    where: "Apps > Webhooks",
    events: "Compra aprovada, Reembolso e Chargeback",
    product: "ID do produto na Cakto",
    productHelp: "O identificador do produto na Cakto.",
    productPlaceholder: "Ex.: ckt_12345",
    credentialHelp: "Na Cakto, copie a chave secret informada ao criar o webhook.",
    directUrl: "https://app.cakto.com.br/dashboard/webhooks",
  },
  kirvano: {
    credential: "Token de validação",
    where: "Configurações > Webhooks",
    events: "Venda aprovada, reembolso, chargeback e cancelamento",
    product: "ID do produto Kirvano",
    productHelp: "O código do produto na Kirvano.",
    credentialHelp: "Token gerado pela Kirvano na aba de webhooks.",
    directUrl: "https://app.kirvano.com",
  },
  eduzz: {
    credential: "Chave de segurança do webhook",
    where: "Órbita / Ferramentas > Webhooks",
    events: "Pagamento aprovado, reembolso, chargeback e cancelamento",
    product: "Código do produto Eduzz",
    productHelp: "Código numérico do produto na Eduzz.",
    credentialHelp: "Chave de autenticação gerada na Eduzz.",
    directUrl: "https://orbita.eduzz.com",
  },
  monetizze: {
    credential: "Chave Única do postback",
    where: "Ferramentas > Postback",
    events: "Finalizada, devolvida, bloqueada/chargeback e cancelada",
    product: "Código do produto Monetizze",
    productHelp: "Código do produto na Monetizze.",
    credentialHelp: "Chave única copiada na área de Postback da Monetizze.",
    directUrl: "https://app.monetizze.com.br",
  },
  wiapy: {
    credential: "Token de autenticação",
    where: "Webhooks",
    events: "Pagamento aprovado, reembolso, chargeback e cancelamento",
    product: "ID do produto Wiapy",
    productHelp: "Identificador do produto na Wiapy.",
    credentialHelp: "Token fornecido pela Wiapy nas configurações de webhook.",
  },
  lowfy: {
    credential: "Token/secret do webhook",
    where: "Webhooks",
    events: "Venda aprovada, reembolso, chargeback e cancelamento",
    product: "ID do produto Lowfy",
    productHelp: "Identificador do produto na Lowfy.",
    credentialHelp: "Chave de webhook gerada pela Lowfy.",
  },
  greenn: {
    credential: "Token de validação",
    where: "Ferramentas > Webhooks",
    events: "Pedido aprovado, reembolso, chargeback e cancelamento",
    product: "ID do produto Greenn",
    productHelp: "Código do produto na Greenn.",
    credentialHelp: "Token informado pela Greenn na criação do webhook.",
  },
};

const providerDocs: Record<CatalogProvider, string> = {
  hotmart: "https://developers.hotmart.com/docs/pt-BR/",
  kiwify: "https://docs.kiwify.com.br/api-reference/general",
  cakto: "https://docs.cakto.com.br/introduction",
};

const providerWebhookConfig: Record<
  CatalogProvider,
  {
    dashboardUrl: string;
    dashboardLabel: string;
    step1Text: (productName: string) => string;
    secretLabel: string;
    secretPlaceholder: string;
    secretHelp: string;
    eventsText: string;
    tokenName: string;
  }
> = {
  cakto: {
    dashboardUrl: "https://app.cakto.com.br/dashboard/webhooks",
    dashboardLabel: "Abrir Webhooks na Cakto",
    step1Text: (productName) => `Crie um webhook com o nome “Trackbase · ${productName}”.`,
    secretLabel: "Secret do webhook Cakto",
    secretPlaceholder: "Cole o secret gerado pela Cakto",
    secretHelp: "Ele confirma que as vendas recebidas são realmente da sua conta.",
    eventsText: "Compra aprovada, Reembolso e Chargeback",
    tokenName: "secret",
  },
  kiwify: {
    dashboardUrl: "https://dashboard.kiwify.com.br/webhooks",
    dashboardLabel: "Abrir Webhooks na Kiwify",
    step1Text: (productName) => `Crie um webhook com o nome “Trackbase · ${productName}”.`,
    secretLabel: "Token ou assinatura do webhook Kiwify",
    secretPlaceholder: "Cole o token de webhook da Kiwify",
    secretHelp: "Ele valida que os webhooks recebidos são autênticos.",
    eventsText: "Pedido aprovado, Reembolso e Chargeback",
    tokenName: "token",
  },
  hotmart: {
    dashboardUrl: "https://app-vlc.hotmart.com/tools/webhook",
    dashboardLabel: "Abrir Webhooks na Hotmart",
    step1Text: (productName) => `Em Ferramentas > Webhook, crie uma configuração para “Trackbase · ${productName}”.`,
    secretLabel: "Hottok ou token do webhook Hotmart",
    secretPlaceholder: "Cole o Hottok gerado pela Hotmart",
    secretHelp: "Ele valida que as notificações recebidas pertencem à sua conta.",
    eventsText: "Compra aprovada, Reembolso e Disputa",
    tokenName: "Hottok",
  },
};

export function GatewayConnectForm({
  workspace,
  provider,
  offers,
  existingIntegrationId,
  appUrl = "https://trackbase.com.br",
  onSuccess,
}: {
  workspace: string;
  provider: Provider;
  offers: Array<{ id: string; name: string }>;
  existingIntegrationId?: string;
  appUrl?: string;
  onSuccess: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [imported, setImported] = useState<{ integrationId: string; productName: string } | null>(null);
  const [generatedWebhookUrl, setGeneratedWebhookUrl] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState<"webhook" | "api">("webhook");
  const [showSecretInput, setShowSecretInput] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState("new");
  const [loading, start] = useTransition();

  const isCatalog = ["hotmart", "kiwify", "cakto"].includes(provider);

  useEffect(() => {
    if (!existingIntegrationId) return;
    let cancelled = false;
    listSavedGatewayProducts(workspace, existingIntegrationId)
      .then((result) => {
        if (!cancelled && result.products && result.products.length > 0) {
          setProducts(result.products);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [existingIntegrationId, workspace]);

  if (generatedWebhookUrl) {
    const manualConfig = manualProviders[provider];
    return (
      <div className="gateway-next-step">
        <span className="gateway-next-step-kicker">INTEGRAÇÃO CONFIGURADA</span>
        <h3 style={{ margin: "0.25rem 0 0.5rem" }}>Tudo pronto! Ative o Webhook na {providerNames[provider]}.</h3>
        <p style={{ color: "var(--muted, #64748B)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Copie a URL abaixo e cadastre na {providerNames[provider]}. Ela é exclusiva desta integração e produto; adicionar outro produto gera outro endereço.
        </p>

        <div className="gateway-webhook-url">
          <code>{generatedWebhookUrl}</code>
          <button type="button" onClick={() => navigator.clipboard.writeText(generatedWebhookUrl)}>
            Copiar URL
          </button>
        </div>

        <div style={{ background: "var(--surface-subtle, #F8FAFC)", border: "1px solid var(--line, #E2E8F0)", borderRadius: "10px", padding: "12px 14px", marginTop: "1rem" }}>
          <strong style={{ fontSize: "0.82rem", color: "var(--ink, #0F172A)", display: "block", marginBottom: "6px" }}>
            Como preencher na tela da {providerNames[provider]}:
          </strong>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.8rem", color: "var(--muted, #64748B)", lineHeight: 1.6 }}>
            <li><strong>URL:</strong> Cole a URL que você acabou de copiar acima.</li>
            {provider === "hotmart" && <li><strong>Versão:</strong> Selecione 2.0.0 (Recomendado).</li>}
            <li><strong>Eventos a marcar:</strong> {manualConfig?.events || "Compra aprovada, Reembolso e Chargeback"}.</li>
            <li><strong>Produtos:</strong> Selecione o seu produto.</li>
          </ul>
        </div>

        {manualConfig?.directUrl && (
          <div style={{ marginTop: "0.75rem" }}>
            <a
              href={manualConfig.directUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--brand-primary, #6366F1)", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              Abrir tela de Webhooks na {providerNames[provider]} ↗
            </a>
          </div>
        )}

        <div style={{ marginTop: "1.25rem" }}>
          <button className="button primary" type="button" onClick={onSuccess} style={{ width: "100%" }}>
            Concluir e fechar
          </button>
        </div>
      </div>
    );
  }

  const manual = manualProviders[provider];
  if (manual && (!isCatalog || connectMode === "webhook")) {
    return (
      <form onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        start(async () => {
          const result = await savePaymentIntegration(workspace, new FormData(event.currentTarget));
          if (result.error) return setMessage(result.error);
          if (result.integrationId) {
            setGeneratedWebhookUrl(gatewayWebhookUrl(appUrl, provider, result.integrationId));
            return;
          }
          onSuccess();
        });
      }}>
        <input type="hidden" name="provider" value={provider} />
        {isCatalog && (
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              type="button"
              className={`button ${connectMode === "webhook" ? "primary" : "secondary"}`}
              onClick={() => setConnectMode("webhook")}
              style={{ fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
            >
              ⚡ Webhook Direto (Recomendado)
            </button>
            <button
              type="button"
              className={`button ${connectMode === "api" ? "primary" : "secondary"}`}
              onClick={() => setConnectMode("api")}
              style={{ fontSize: "0.82rem", padding: "0.4rem 0.75rem" }}
            >
              🔑 API Developers
            </button>
          </div>
        )}
        <span className="gateway-next-step-kicker">CONFIGURAÇÃO GUIADA</span>
        <h3>Conecte {providerNames[provider]} por webhook.</h3>
        <ol className="gateway-webhook-steps">
          <li>
            <strong>1. Acesse {manual.where} na {providerNames[provider]}.</strong>
            <span>
              {manual.directUrl ? (
                <a
                  href={manual.directUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--brand-primary, #6366F1)", fontWeight: 600, marginTop: "2px" }}
                >
                  Abrir Webhooks na {providerNames[provider]} ↗
                </a>
              ) : `Abra a tela de webhooks da sua conta ${providerNames[provider]}.`}
            </span>
          </li>
          <li>
            <strong>2. {existingIntegrationId ? `${manual.credential} já configurado` : `Copie o ${manual.credential}`}.</strong>
            <span>{existingIntegrationId ? `Suas credenciais salvas da ${providerNames[provider]} serão reutilizadas automaticamente.` : manual.credentialHelp}</span>
          </li>
          <li>
            <strong>3. Preencha os campos e gere a sua URL exclusiva.</strong>
            <span>Ao salvar, o Trackbase fornecerá a URL exata para colar na {providerNames[provider]}.</span>
          </li>
        </ol>

        <label style={{ marginTop: "1rem" }}>
          Oferta no Trackbase
          <select
            name="offer_id"
            value={selectedOfferId}
            onChange={(e) => setSelectedOfferId(e.target.value)}
            disabled={loading}
          >
            <option value="new">✨ Criar nova oferta automaticamente (Recomendado)</option>
            {offers.length > 0 && (
              <optgroup label="Ou vincular a uma oferta já existente:">
                {offers.map((offer) => (
                  <option key={offer.id} value={offer.id}>{offer.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <small className="form-help" style={{ display: "block", marginTop: "2px", color: "var(--muted, #64748B)", fontSize: "0.75rem" }}>
            Cria uma nova oferta no Trackbase com este produto ou vincula a uma que você já configurou.
          </small>
        </label>

        {selectedOfferId === "new" && (
          <div style={{ marginTop: "0.85rem" }}>
            <label
              htmlFor="gateway-product-name"
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "var(--ink, #0F172A)",
                cursor: "pointer",
              }}
            >
              Nome do produto / oferta
            </label>
            <input
              id="gateway-product-name"
              name="product_name"
              type="text"
              placeholder="Ex.: Treinamento Viver de Anúncios, Mentoria VIP..."
              required
              disabled={loading}
              maxLength={120}
              autoFocus
              style={{
                width: "100%",
                height: "44px",
                padding: "0 12px",
                fontSize: "0.9rem",
                borderRadius: "8px",
                border: "1px solid var(--line, #CBD5E1)",
                background: "var(--surface, #FFFFFF)",
                color: "var(--ink, #0F172A)",
                boxSizing: "border-box",
                cursor: "text",
                pointerEvents: "auto",
              }}
            />
            <small
              className="form-help"
              style={{
                display: "block",
                marginTop: "3px",
                color: "var(--muted, #64748B)",
                fontSize: "0.75rem",
              }}
            >
              O nome legível que aparecerá nos relatórios, cards de ofertas e notificações de vendas.
            </small>
          </div>
        )}

        <div style={{ marginTop: "0.85rem" }}>
          <label
            htmlFor="gateway-external-product-id"
            style={{
              display: "block",
              marginBottom: "4px",
              fontWeight: 600,
              fontSize: "0.85rem",
              color: "var(--ink, #0F172A)",
              cursor: "pointer",
            }}
          >
            {manual.product}
          </label>
          <input
            id="gateway-external-product-id"
            name="external_product_id"
            type="text"
            placeholder={manual.productPlaceholder || "Ex.: 8456025 ou ID do produto"}
            required
            disabled={loading}
            style={{
              width: "100%",
              height: "44px",
              padding: "0 12px",
              fontSize: "0.9rem",
              borderRadius: "8px",
              border: "1px solid var(--line, #CBD5E1)",
              background: "var(--surface, #FFFFFF)",
              color: "var(--ink, #0F172A)",
              boxSizing: "border-box",
              cursor: "text",
              pointerEvents: "auto",
            }}
          />
          <small
            className="form-help"
            style={{
              display: "block",
              marginTop: "3px",
              color: "var(--muted, #64748B)",
              fontSize: "0.75rem",
            }}
          >
            {manual.productHelp}
          </small>
        </div>
        <input type="hidden" name="external_offer_id" value="" />

        <label>
          Moeda padrão
          <select name="currency" defaultValue="BRL" disabled={loading}>
            <option>BRL</option>
            <option>USD</option>
            <option>EUR</option>
            <option>MXN</option>
          </select>
        </label>

        {existingIntegrationId ? (
          <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "8px", padding: "0.75rem 1rem", marginTop: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#10B981", fontSize: "1rem" }}>✓</span>
                <strong style={{ fontSize: "0.82rem", color: "#065F46" }}>
                  {manual.credential} já salvo na sua conta!
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setShowSecretInput(!showSecretInput)}
                style={{ background: "none", border: "none", color: "#047857", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}
              >
                {showSecretInput ? "Manter atual" : "Alterar"}
              </button>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "#047857" }}>
              Como você já configurou a {providerNames[provider]} antes, não precisa colar o {manual.credential} novamente.
            </p>
            {showSecretInput && (
              <div style={{ marginTop: "0.65rem" }}>
                <input
                  name="secret"
                  type="password"
                  minLength={4}
                  autoComplete="new-password"
                  placeholder={`Cole aqui apenas se desejar trocar o ${manual.credential}`}
                  disabled={loading}
                />
              </div>
            )}
          </div>
        ) : (
          <label>
            {manual.credential}
            <input name="secret" type="password" minLength={4} required autoComplete="new-password" placeholder={`Cole aqui o seu ${manual.credential}`} disabled={loading} />
            <small className="form-help" style={{ display: "block", marginTop: "2px", color: "var(--muted, #64748B)", fontSize: "0.75rem" }}>
              {manual.credentialHelp}
            </small>
          </label>
        )}

        <button className="button primary" disabled={loading} style={{ marginTop: "0.75rem" }}>
          {loading ? "Salvando…" : "Salvar e gerar URL do webhook"}
        </button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    );
  }

  if (imported) {
    const cfg = providerWebhookConfig[provider as CatalogProvider];
    const webhookUrl = gatewayWebhookUrl(appUrl, provider, imported.integrationId);
    return (
      <div className="gateway-next-step">
        <span className="gateway-next-step-kicker">PRODUTO IMPORTADO</span>
        <h3>Falta só conectar as vendas.</h3>
        <p>
          A {providerNames[provider]} precisa avisar a Trackbase cada vez que uma venda, reembolso ou chargeback acontecer.
        </p>

        <ol className="gateway-webhook-steps">
          <li>
            <strong>Abra os Webhooks da {providerNames[provider]}.</strong>
            <span>{cfg.step1Text(imported.productName)}</span>
            <a href={cfg.dashboardUrl} target="_blank" rel="noreferrer">
              {cfg.dashboardLabel} <span aria-hidden="true">↗</span>
            </a>
          </li>
          <li>
            <strong>Cole esta URL e selecione o produto.</strong>
            <span>Escolha “{imported.productName}” no campo Produtos. Esta URL pertence somente a esta integração; outro produto precisa do próprio endereço.</span>
            <div className="gateway-webhook-url">
              <code>{webhookUrl}</code>
              <button type="button" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                Copiar URL
              </button>
            </div>
          </li>
          <li>
            <strong>Marque os eventos.</strong>
            <span>
              Selecione: <b>{cfg.eventsText}</b>. Depois salve como ativo.
            </span>
          </li>
          <li>
            <strong>Cole o {cfg.tokenName} gerado pela {providerNames[provider]}.</strong>
            <span>{cfg.secretHelp}</span>
          </li>
        </ol>

        <form
          className="gateway-secret-form"
          onSubmit={(event) => {
            event.preventDefault();
            const secret = String(new FormData(event.currentTarget).get("secret") || "");
            start(async () => {
              const result = await saveGatewayWebhookSecret(workspace, imported.integrationId, secret);
              if (result.error) {
                setMessage(result.error);
                return;
              }
              onSuccess();
            });
          }}
        >
          <label>
            {cfg.secretLabel}
            <input
              name="secret"
              type="password"
              minLength={4}
              required
              autoComplete="new-password"
              disabled={loading}
              placeholder={cfg.secretPlaceholder}
            />
          </label>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button className="button primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? "Salvando…" : "Concluir conexão"}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={loading}
              onClick={onSuccess}
            >
              Configurar depois
            </button>
          </div>
        </form>
        {message && <p className="form-message" role="status">{message}</p>}
      </div>
    );
  }

  const fetchProducts = (form: HTMLFormElement) => {
    const data = new FormData(form);
    setMessage("");
    start(async () => {
      const response = await fetch("/api/gateways/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace,
          provider,
          clientId: data.get("client_id"),
          clientSecret: data.get("client_secret"),
          accountId: data.get("account_id") || undefined,
          basicToken: data.get("basic_token") || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setProducts([]);
        setMessage(result.error || "Não foi possível buscar os produtos.");
        return;
      }
      setProducts(result.products || []);
      setMessage(
        result.products?.length
          ? "Escolha o produto para importar."
          : "Nenhum produto ativo foi encontrado nessa conta.",
      );
    });
  };

  if (existingIntegrationId) {
    return (
      <form
        className="gateway-next-step"
        onSubmit={(event) => {
          event.preventDefault();
          const productId = String(new FormData(event.currentTarget).get("external_product_id") || "");
          start(async () => {
            const result = await connectAdditionalGatewayProduct(workspace, existingIntegrationId, productId);
            if (result.error) {
              setMessage(result.error);
              return;
            }
            const product = products.find((item) => item.externalProductId === productId);
            if (result.integrationId) {
              setImported({
                integrationId: result.integrationId,
                productName: product?.name || "seu produto",
              });
            }
          });
        }}
      >
        <span className="gateway-next-step-kicker">CONEXÃO JÁ SALVA</span>
        <h3>Adicione outro produto da {providerNames[provider]}.</h3>
        <p>As credenciais já estão protegidas na Trackbase. Escolha apenas o produto que deseja acompanhar.</p>
        <label>
          Produto para importar
          <select name="external_product_id" required disabled={loading}>
            {products.map((product) => (
              <option key={product.externalProductId} value={product.externalProductId}>
                {product.name} · {product.currency}
              </option>
            ))}
          </select>
        </label>
        {!products.length && !message && <p className="form-help">Carregando produtos…</p>}
        <button className="button primary" disabled={loading || !products.length}>
          {loading ? "Carregando…" : "Adicionar produto"}
        </button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!products.length) return fetchProducts(form);
        setMessage("");
        start(async () => {
          const result = await connectImportedGateway(workspace, new FormData(form));
          if (result.error) {
            setMessage(result.error);
            return;
          }
          if (result.integrationId) {
            const selectedProductId = String(new FormData(form).get("external_product_id") || "");
            const product = products.find((item) => item.externalProductId === selectedProductId);
            setImported({
              integrationId: result.integrationId,
              productName: product?.name || "seu produto",
            });
            return;
          }
          onSuccess();
        });
      }}
    >
      <input type="hidden" name="provider" value={provider} />
      <div
        style={{
          background: "#F8F7FF",
          border: "1px solid #E5DEFF",
          borderRadius: "0.75rem",
          padding: "0.85rem 1rem",
          marginBottom: "1rem",
        }}
      >
        <strong>Como conectar sua {providerNames[provider]}</strong>
        <ol
          style={{
            margin: "0.55rem 0 0 1.15rem",
            padding: 0,
            color: "var(--muted, #64748B)",
            fontSize: "0.82rem",
            lineHeight: 1.55,
          }}
        >
          {provider === "hotmart" && (
            <>
              <li>Abra o painel da Hotmart e entre em <b>Ferramentas &gt; Credenciais de API</b>.</li>
              <li>Crie uma aplicação e copie <b>Client ID</b>, <b>Client Secret</b> e o <b>Token Basic</b>.</li>
              <li>Após buscar os produtos e importar, você receberá o link do Webhook para ativar as vendas.</li>
            </>
          )}
          {provider === "kiwify" && (
            <>
              <li>Na Kiwify, abra <b>Configurações &gt; API</b> e crie uma credencial.</li>
              <li>Copie o <b>Client ID</b>, <b>Client Secret</b> e o <b>Account ID</b> da conta.</li>
              <li>Após buscar os produtos e importar, você receberá o link do Webhook para ativar as vendas.</li>
            </>
          )}
          {provider === "cakto" && (
            <>
              <li>Na Cakto, abra a área de <b>API / Desenvolvedores</b> e crie uma credencial marcando <b>Produtos</b> e <b>Webhooks</b>.</li>
              <li>Copie o <b>Client ID</b> e o <b>Client Secret</b>.</li>
              <li>Após buscar os produtos e importar, você receberá o link do Webhook para ativar as vendas.</li>
            </>
          )}
        </ol>
        <a
          href={providerDocs[provider as CatalogProvider]}
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", marginTop: "0.55rem", fontSize: "0.8rem" }}
        >
          Abrir documentação oficial →
        </a>
      </div>
      <label>
        Client ID
        <input name="client_id" autoComplete="off" required disabled={loading} />
      </label>
      <label>
        Client Secret
        <input name="client_secret" type="password" autoComplete="new-password" required disabled={loading} />
      </label>
      {provider === "kiwify" && (
        <label>
          Account ID da Kiwify
          <input name="account_id" autoComplete="off" required disabled={loading} />
        </label>
      )}
      {provider === "hotmart" && (
        <label>
          Token Basic da Hotmart
          <input name="basic_token" type="password" autoComplete="new-password" required disabled={loading} />
        </label>
      )}
      <label>
        {provider === "hotmart"
          ? "Hottok (opcional agora)"
          : provider === "kiwify"
            ? "Token do webhook (opcional agora)"
            : "Secret do webhook (opcional agora)"}
        <input
          name="webhook_secret"
          type="password"
          autoComplete="new-password"
          disabled={loading}
          placeholder="Pode deixar vazio e configurar no próximo passo"
        />
      </label>
      <p className="form-help" style={{ marginTop: "-0.35rem" }}>
        No próximo passo, exibiremos a URL exclusiva do webhook para você cadastrar na {providerNames[provider]} e ativar os eventos.
      </p>
      {products.length > 0 && (
        <label>
          Produto para importar
          <select name="external_product_id" required disabled={loading}>
            {products.map((product) => (
              <option key={product.externalProductId} value={product.externalProductId}>
                {product.name} · {product.currency}
              </option>
            ))}
          </select>
        </label>
      )}
      <button className="button primary" disabled={loading}>
        {loading ? "Aguarde…" : products.length ? "Importar produto e conectar" : "Buscar produtos"}
      </button>
      {products.length > 0 && (
        <button
          className="button secondary"
          type="button"
          disabled={loading}
          onClick={(event) => fetchProducts(event.currentTarget.form!)}
        >
          Buscar novamente
        </button>
      )}
      {message && <p className="form-message" role="status">{message}</p>}
      <p className="form-help">As chaves são criptografadas no servidor. O produto pode ser editado depois da importação.</p>
    </form>
  );
}
