"use client";
import { useState, useTransition } from "react";
import {
  login,
  signup,
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
            setMessage(result.error ?? "Salvo com sucesso.");
            if (result.ok) {
              form.reset();
              onSuccess?.();
            }
          } catch {
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
          <button
            className="text-button"
            onClick={() => setRegister(!register)}
          >
            {register
              ? "Já tenho conta. Entrar"
              : "Ainda não tem conta? Comece aqui"}
          </button>
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
export function OfferForm({ workspace }: { workspace: string }) {
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
    </ActionForm>
  );
}
