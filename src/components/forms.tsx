"use client";
import { useState, useTransition } from "react";
import {
  login,
  signup,
  requestPasswordReset,
  updatePassword,
  createWorkspace,
  saveOffer,
  type ActionResult,
} from "@/app/actions";
export function ActionForm({
  action,
  children,
  label = "Salvar",
  onSuccess,
}: {
  action: (data: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  label?: string;
  onSuccess?: () => void;
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget,
          data = new FormData(form);
        start(async () => {
          try {
            const result = await action(data);
            if (result.error) {
              setMessage(result.error);
            } else {
              setMessage("Salvo com sucesso.");
            }
            if (result.ok) {
              form.reset();
              onSuccess?.();
            }
          } catch (e) {
            const err = e as Error & { digest?: string };
            if (err?.message === "NEXT_REDIRECT" || (err?.digest && err.digest.startsWith("NEXT_REDIRECT"))) throw e;
            setMessage("Não foi possível concluir. Tente novamente.");
          }
        });
      }}
    >
      {children}
      <button className="button primary" disabled={pending}>
        {pending ? "Aguarde…" : label}
      </button>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
export function AuthForm({ configured }: { configured: boolean }) {
  const [register, setRegister] = useState(false);
  return (
    <div className="auth-box">
      <span className="tag">SUA OPERAÇÃO, MAIS CLARA</span>
      <h2>
        {register ? "Comece pelo primeiro clique." : "Bom ter você por aqui."}
      </h2>
      <p>
        {register
          ? "Crie sua conta e organize sua operação."
          : "Entre para acompanhar o que traz resultado."}
      </p>
      {configured ? (
        <>
          <ActionForm
            action={
              register
                ? async (f) => {
                    const r = await signup(f);
                    return r.ok
                      ? { error: "Confira seu e-mail para confirmar a conta." }
                      : r;
                  }
                : login
            }
            label={register ? "Criar minha conta" : "Entrar na minha conta"}
          >
            <label>
              E-mail
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="voce@empresa.com"
                required
              />
            </label>
            {register && (
              <label>
                Celular
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(11) 99999-9999"
                  required
                />
              </label>
            )}
            <label>
              Senha
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={register ? 10 : 8}
                required
                placeholder={
                  register ? "Pelo menos 10 caracteres" : "Sua senha"
                }
              />
            </label>
          </ActionForm>
          <div className="auth-links">
            <button
              className="text-button"
              onClick={() => setRegister(!register)}
            >
              {register ? "Já tenho conta. Entrar" : "Ainda não tem conta? Comece aqui"}
            </button>
            {!register && (
              <a className="text-button" href="/recuperar-senha">
                Esqueci minha senha
              </a>
            )}
          </div>
        </>
      ) : (
        <div className="notice">
          O ambiente ainda precisa ser conectado ao Supabase. O painel está
          disponível para visualizar a estrutura, sem dados simulados.
        </div>
      )}
      <small>Seus dados pertencem ao seu workspace.</small>
    </div>
  );
}
export function PasswordResetForm() {
  return (
    <ActionForm action={requestPasswordReset} label="Enviar link">
      <label>
        E-mail
        <input name="email" type="email" autoComplete="email" required />
      </label>
    </ActionForm>
  );
}

export function NewPasswordForm() {
  return (
    <ActionForm action={updatePassword} label="Salvar nova senha" onSuccess={() => {}}>
      <label>
        Nova senha
        <input name="password" type="password" minLength={10} autoComplete="new-password" required />
      </label>
    </ActionForm>
  );
}
export function WorkspaceForm() {
  return (
    <ActionForm action={createWorkspace} label="Criar workspace">
      <label>
        Nome da operação
        <input
          name="name"
          placeholder="Minha operação"
          minLength={2}
          maxLength={100}
          required
        />
      </label>
      <label>
        Fuso horário
        <select name="timezone">
          <option>America/Sao_Paulo</option>
          <option>America/Manaus</option>
          <option>America/New_York</option>
          <option>Europe/Lisbon</option>
          <option>UTC</option>
        </select>
      </label>
    </ActionForm>
  );
}
export function OfferForm({
  workspace,
  offers = [],
}: {
  workspace: string;
  offers?: { id: string; name: string }[];
}) {
  const [productType, setProductType] = useState("main");

  return (
    <ActionForm
      action={(f) => saveOffer(workspace, f)}
      label="Cadastrar oferta"
    >
      <label>
        Nome da oferta
        <input
          name="name"
          placeholder="Ex.: Método Primeira Venda"
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      <label>
        URL da página
        <input
          name="landing_url"
          type="url"
          placeholder="https://suaoferta.com"
          required
        />
      </label>
      <div className="form-grid form-grid-2">
        <label>
          Tipo de produto
          <select
            name="product_type"
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
          >
            <option value="main">Produto Principal</option>
            <option value="order_bump">Order Bump</option>
            <option value="upsell">Upsell</option>
            <option value="downsell">Downsell</option>
            <option value="subscription">Assinatura</option>
            <option value="complementary">Complementar</option>
            <option value="alternative">Alternativo</option>
          </select>
        </label>
        <label>
          Moeda da oferta
          <select name="currency">
            <option>BRL</option>
            <option>USD</option>
            <option>EUR</option>
            <option>MXN</option>
            <option>COP</option>
            <option>ARS</option>
          </select>
        </label>
      </div>
      {productType !== "main" && offers.length > 0 && (
        <label>
          Oferta principal vinculada (funil)
          <select name="parent_offer_id">
            <option value="">Nenhuma / Independente</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="form-grid form-grid-2">
        <label>
          Plataforma de checkout
          <select name="platform">
            <option value="">Nenhuma / Outra</option>
            <option value="hotmart">Hotmart</option>
            <option value="kiwify">Kiwify</option>
            <option value="cakto">Cakto</option>
            <option value="kirvano">Kirvano</option>
            <option value="eduzz">Eduzz</option>
            <option value="monetizze">Monetizze</option>
            <option value="wiapy">Wiapy</option>
          </select>
        </label>
        <label>
          Link do checkout (opcional)
          <input
            name="checkout_url"
            type="url"
            placeholder="https://pay.exemplo.com/checkout"
          />
        </label>
      </div>
      <div className="form-grid form-grid-3">
        <label>
          Taxa % plataforma
          <input
            name="percent_fee"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="9.90"
            defaultValue="0"
          />
        </label>
        <label>
          Taxa fixa (R$)
          <input
            name="fixed_fee"
            type="number"
            step="0.01"
            min="0"
            placeholder="1.00"
            defaultValue="0"
          />
        </label>
        <label>
          Custo produto (R$)
          <input
            name="cost_per_sale"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            defaultValue="0"
          />
        </label>
      </div>
    </ActionForm>
  );
}
