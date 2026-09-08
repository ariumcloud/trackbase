"use client";

import { useEffect, useState, useTransition } from "react";
import {
  connectAdditionalGatewayProduct,
  connectImportedGateway,
  listSavedGatewayProducts,
  saveGatewayWebhookSecret,
} from "@/app/actions";

type Provider = "hotmart" | "kiwify" | "cakto";
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
};

const providerDocs: Record<Provider, string> = {
  hotmart: "https://developers.hotmart.com/docs/pt-BR/",
  kiwify: "https://docs.kiwify.com.br/api-reference/general",
  cakto: "https://docs.cakto.com.br/introduction",
};

const providerWebhookConfig: Record<
  Provider,
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
  existingIntegrationId,
  appUrl = "https://www.trackbase.com.br",
  onSuccess,
}: {
  workspace: string;
  provider: Provider;
  existingIntegrationId?: string;
  appUrl?: string;
  onSuccess: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [imported, setImported] = useState<{ integrationId: string; productName: string } | null>(null);
  const [loading, start] = useTransition();

  useEffect(() => {
    if (!existingIntegrationId) return;
    start(async () => {
      const result = await listSavedGatewayProducts(workspace, existingIntegrationId);
      if (result.error) setMessage(result.error);
      else setProducts(result.products || []);
    });
  }, [existingIntegrationId, workspace]);

  if (imported) {
    const cfg = providerWebhookConfig[provider];
    const webhookUrl = `${appUrl}/api/webhooks/${provider}/${imported.integrationId}`;
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
            <span>Escolha “{imported.productName}” no campo Produtos.</span>
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
          href={providerDocs[provider]}
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
