"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminMutation } from "@/app/admin/actions";
import { plans, normalizePlan } from "@/lib/plans";
import { RefreshCw } from "lucide-react";

export function AdminRefresh() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="button ghost small"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      <RefreshCw size={15} />
      {pending ? "Atualizando…" : "Atualizar"}
    </button>
  );
}

function AdminForm({
  children,
  button,
  className = "",
  confirm,
}: {
  children: React.ReactNode;
  button: string;
  className?: string;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{
    ok?: boolean;
    error?: string;
  } | null>(null);
  const router = useRouter();
  return (
    <form
      className={`admin-form ${className}`}
      action={(form) => {
        if (confirm && !window.confirm(confirm)) return;
        setMessage(null);
        start(async () => {
          try {
            const result = await adminMutation(form);
            setMessage(result);
            if (result.ok) router.refresh();
          } catch {
            setMessage({ error: "Conexão interrompida. Tente novamente." });
          }
        });
      }}
    >
      <fieldset disabled={pending}>
        {children}
        <button className="button" type="submit">
          {pending ? "Salvando…" : button}
        </button>
      </fieldset>
      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={message.error ? "admin-error" : "admin-success"}
        >
          {message.error || "Alteração salva e registrada no histórico."}
        </p>
      )}
    </form>
  );
}

export function PlanForm({
  id,
  plan,
  name,
}: {
  id: string;
  plan: string;
  name: string;
}) {
  return (
    <AdminForm
      button="Salvar plano"
      confirm={`Alterar o plano de ${name}? Isso modifica os recursos e limites disponíveis imediatamente.`}
    >
      <input type="hidden" name="action" value="plan" />
      <input type="hidden" name="target" value={id} />
      <label>
        Plano
        <select name="plan" defaultValue={normalizePlan(plan)}>
          {Object.entries(plans).map(([id, p]) => (
            <option key={id} value={id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Motivo da alteração
        <input
          name="reason"
          required
          minLength={3}
          maxLength={5000}
          placeholder="Ex.: ajuste combinado no atendimento"
        />
      </label>
      <p className="admin-hint">
        Altera o acesso e os limites deste workspace. Não realiza cobrança.
      </p>
    </AdminForm>
  );
}

export function NewTicketForm({ userId }: { userId: string }) {
  return (
    <AdminForm button="Registrar atendimento">
      <input type="hidden" name="action" value="ticket_create" />
      <input type="hidden" name="target" value={userId} />
      <label>
        Assunto
        <input
          name="subject"
          placeholder="Ex.: venda não apareceu no painel"
          required
          minLength={3}
          maxLength={160}
        />
      </label>
      <label>
        Prioridade
        <select name="priority" defaultValue="normal">
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </label>
      <label>
        Relato e anotações internas
        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={5000}
          rows={4}
          placeholder="O que aconteceu, evidências e próximos passos. Não inclua senhas ou tokens."
        />
      </label>
    </AdminForm>
  );
}

export function TicketStatusForm({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  return (
    <AdminForm button="Atualizar atendimento">
      <input type="hidden" name="action" value="ticket_status" />
      <input type="hidden" name="target" value={id} />
      <label>
        Status
        <select name="status" defaultValue={status}>
          <option value="open">Aberto</option>
          <option value="waiting">Aguardando</option>
          <option value="resolved">Resolvido</option>
        </select>
      </label>
      <label>
        Andamento / solução
        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={5000}
          rows={2}
          placeholder="Registre o que foi feito"
        />
      </label>
    </AdminForm>
  );
}
