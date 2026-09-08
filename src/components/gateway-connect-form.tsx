"use client";

import { useState, useTransition } from "react";
import { connectImportedGateway } from "@/app/actions";

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

export function GatewayConnectForm({
  workspace,
  provider,
  onSuccess,
}: {
  workspace: string;
  provider: Provider;
  onSuccess: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [loading, start] = useTransition();

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
      setMessage(result.products?.length ? "Escolha o produto para importar." : "Nenhum produto ativo foi encontrado nessa conta.");
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!products.length) return fetchProducts(form);
        setMessage("");
        start(async () => {
          const result = await connectImportedGateway(workspace, new FormData(form));
          if (result.error) setMessage(result.error);
          else onSuccess();
        });
      }}
    >
      <p className="form-help">
        Conecte sua conta {providerNames[provider]}, busque os produtos e escolha qual operação importar.
      </p>
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
        Segredo do webhook
        <input name="webhook_secret" type="password" autoComplete="new-password" required disabled={loading} />
      </label>
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
