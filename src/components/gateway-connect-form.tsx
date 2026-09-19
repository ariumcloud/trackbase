"use client";
import { gatewayWebhookUrl } from "@/lib/webhook-url";

import { useState, useTransition } from "react";
import { connectGatewayHub, savePaymentIntegration } from "@/app/actions";

type Provider =
  | "hotmart"
  | "kiwify"
  | "cakto"
  | "kirvano"
  | "eduzz"
  | "monetizze"
  | "wiapy"
  | "lowfy"
  | "greenn"
  | "yampi"
  | "perfectpay"
  | "cartpanda"
  | "shopify"
  | "ticto"
  | "lastlink"
  | "hubla";
type CatalogProvider = "hotmart" | "kiwify" | "cakto";

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
  yampi: "Yampi",
  perfectpay: "Perfect Pay",
  cartpanda: "Cartpanda",
  shopify: "Shopify",
  ticto: "Ticto",
  lastlink: "Lastlink",
  hubla: "Hubla",
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
  yampi: {
    credential: "Chave Secreta (Token HMAC) do Webhook",
    where: "Configurações > Webhooks",
    events: "order.paid, order.created, order.status.updated",
    product: "ID ou Nome do produto na Yampi",
    productHelp: "O identificador ou título do produto cadastrado na Yampi.",
    productPlaceholder: "Ex.: 5555 ou Meu Produto",
    credentialHelp: "Na Yampi, acesse Configurações > Webhooks, cadastre a URL do webhook e informe a Chave Secreta (Token HMAC).",
    directUrl: "https://app.yampi.com.br",
  },
  perfectpay: {
    credential: "Token de validação (MD5)",
    where: "Ferramentas > Webhook - Vendas",
    events: "Venda aprovada, Reembolso, Chargeback e Cancelamento",
    product: "Código do produto na Perfect Pay",
    productHelp: "O código do produto na Perfect Pay.",
    productPlaceholder: "Ex.: PPP12345",
    credentialHelp: "Na Perfect Pay, vá em Ferramentas > Webhook - Vendas e copie o Token de verificação gerado.",
    directUrl: "https://app.perfectpay.com.br",
  },
  cartpanda: {
    credential: "Token da API / Chave Secreta",
    where: "Configurações > Webhooks",
    events: "order.paid, order.refunded, order.cancelled",
    product: "ID ou Nome do produto na Cartpanda",
    productHelp: "O identificador ou título do produto na Cartpanda.",
    productPlaceholder: "Ex.: 123456",
    credentialHelp: "Na Cartpanda, acesse Configurações > Webhooks e copie o Token de validação.",
    directUrl: "https://accounts.cartpanda.com",
  },
  shopify: {
    credential: "Chave Secreta de Assinatura do Webhook (Shared Secret)",
    where: "Configurações > Notificações > Webhooks",
    events: "Criação de pedido, Pedido pago (orders/paid), Cancelamento e Reembolso",
    product: "ID ou Título do produto na Shopify",
    productHelp: "O identificador ou título do produto na Shopify.",
    productPlaceholder: "Ex.: Meu Produto",
    credentialHelp: "Na Shopify, acesse Configurações > Notificações > Webhooks. Copie a Chave Secreta compartilhada exibida no rodapé da página.",
    directUrl: "https://admin.shopify.com",
  },
  ticto: {
    credential: "Token de validação do Webhook",
    where: "TicTools > Webhooks",
    events: "Pedido Aprovado, Reembolso, Chargeback e Cancelamento",
    product: "ID do produto na Ticto",
    productHelp: "O código do produto cadastrado na Ticto.",
    productPlaceholder: "Ex.: 12345",
    credentialHelp: "Na Ticto, vá em TicTools > Webhooks, crie o webhook e copie o Token de verificação gerado.",
    directUrl: "https://dashboard.ticto.com.br",
  },
  lastlink: {
    credential: "Token de validação do Webhook",
    where: "Produtos > [Seu Produto] > Integrações > Lastlink - Webhook",
    events: "Compra Completa (Purchase_Order_Confirmed), Reembolso, Chargeback e Cancelamento",
    product: "ID ou Nome do produto na Lastlink",
    productHelp: "O identificador ou nome do produto na Lastlink.",
    productPlaceholder: "Ex.: Meu Curso Online",
    credentialHelp: "Na Lastlink, vá em Produtos > [Seu Produto] > Integrações > Lastlink - Webhook, crie a regra e informe o Token de validação.",
    directUrl: "https://app.lastlink.com",
  },
  hubla: {
    credential: "Token de autenticação do Webhook",
    where: "Integrações > Webhooks > Autenticação",
    events: "Pagamento da fatura realizado (invoice.payment_succeeded), Reembolso, Fatura expirada/cancelada",
    product: "ID ou Nome do produto na Hubla",
    productHelp: "O identificador ou título do produto na Hubla.",
    productPlaceholder: "Ex.: inAVzweR0QYw5y03K5mq ou Minha Comunidade",
    credentialHelp: "Na Hubla, acesse Integrações > Webhooks, copie o token na aba de Autenticação e cadastre a regra com a URL do webhook.",
    directUrl: "https://app.hubla.com",
  },
};

const providerDocs: Record<CatalogProvider, string> = {
  hotmart: "https://developers.hotmart.com/docs/pt-BR/",
  kiwify: "https://docs.kiwify.com.br/api-reference/general",
  cakto: "https://docs.cakto.com.br/introduction",
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
  const [message, setMessage] = useState("");
  const [generatedWebhookUrl, setGeneratedWebhookUrl] = useState<string | null>(null);
  const [showSecretInput, setShowSecretInput] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState("new");
  const [loading, start] = useTransition();

  const isCatalog = ["hotmart", "kiwify", "cakto"].includes(provider);

  if (generatedWebhookUrl) {
    const manualConfig = manualProviders[provider];
    return (
      <div className="gateway-next-step">
        <span className="gateway-next-step-kicker">INTEGRAÇÃO CONFIGURADA</span>
        <h3 style={{ margin: "0.25rem 0 0.5rem" }}>Tudo pronto! Ative o Webhook na {providerNames[provider]}.</h3>
        <p style={{ color: "var(--muted, #64748B)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          {`Copie a URL abaixo e cadastre na ${providerNames[provider]}. Você pode usar esta mesma URL para quantos produtos quiser desta conta — cada um aparece sozinho no Trackbase assim que a primeira venda aprovada chegar.`}
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
            <li>
              <strong>Produtos:</strong>{" "}
              Selecione todos os produtos de uma vez, ou crie um webhook por produto — em ambos os casos, cole esta mesma URL.
            </li>
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

  if (existingIntegrationId) {
    return (
      <div className="gateway-next-step">
        <span className="gateway-next-step-kicker">CONEXÃO JÁ ATIVA</span>
        <h3>Não precisa adicionar produtos manualmente.</h3>
        <p>
          A conexão com a {providerNames[provider]} já está ativa e usa uma única URL de webhook para todos os
          produtos. Assim que a primeira venda aprovada de um novo produto chegar, ele aparece sozinho no Trackbase.
        </p>
        <button className="button primary" type="button" onClick={onSuccess} style={{ width: "100%" }}>
          Entendi
        </button>
      </div>
    );
  }

  if (isCatalog) {
    return (
      <form onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        start(async () => {
          const result = await connectGatewayHub(workspace, new FormData(event.currentTarget));
          if (result.error) return setMessage(result.error);
          if (result.integrationId) {
            setGeneratedWebhookUrl(gatewayWebhookUrl(appUrl, provider, result.integrationId));
            return;
          }
          onSuccess();
        });
      }}>
        <input type="hidden" name="provider" value={provider} />
        <span className="gateway-next-step-kicker">CONFIGURAÇÃO GUIADA</span>
        <h3>Conecte sua conta {providerNames[provider]}.</h3>
        <div
          style={{
            background: "#F8F7FF",
            border: "1px solid #E5DEFF",
            borderRadius: "0.75rem",
            padding: "0.85rem 1rem",
            marginBottom: "1rem",
          }}
        >
          <strong>Onde encontrar suas credenciais</strong>
          <ol style={{ margin: "0.55rem 0 0 1.15rem", padding: 0, color: "var(--muted, #64748B)", fontSize: "0.82rem", lineHeight: 1.55 }}>
            {provider === "hotmart" && (
              <>
                <li>Client ID e Client Secret: <b>Ferramentas &gt; Credenciais de API</b>.</li>
                <li>Hottok (token do webhook): <b>Ferramentas &gt; Webhook &gt; Autenticação</b> — tela diferente da anterior.</li>
              </>
            )}
            {provider === "kiwify" && <li>Client ID, Client Secret e Account ID: <b>Configurações &gt; API</b>.</li>}
            {provider === "cakto" && <li>Client ID e Client Secret: área de <b>API / Desenvolvedores</b>, marcando Produtos e Webhooks.</li>}
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
        <label>
          {provider === "hotmart" ? "Hottok" : "Token do webhook"} (opcional agora)
          <input
            name="webhook_secret"
            type="password"
            autoComplete="new-password"
            disabled={loading}
            placeholder="Pode colar depois, na próxima tela"
          />
        </label>
        <p className="form-help">
          Não precisa escolher um produto: assim que a primeira venda aprovada de cada produto chegar pela{" "}
          {providerNames[provider]}, ele aparece sozinho no Trackbase com a mesma URL de webhook.
        </p>
        <button className="button primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
          {loading ? "Conectando…" : "Conectar e gerar URL do webhook"}
        </button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    );
  }

  const manual = manualProviders[provider];
  if (manual) {
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
            {selectedOfferId === "new"
              ? "Não precisa informar nome ou ID do produto: assim que a primeira venda aprovada chegar pelo webhook, o Trackbase cria a oferta sozinho com os dados que já vêm no pagamento."
              : "As vendas desta conexão serão contabilizadas na oferta selecionada."}
          </small>
        </label>
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
}
