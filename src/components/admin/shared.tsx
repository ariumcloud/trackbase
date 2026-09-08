import Link from "next/link";
import type { AdminTicket, AdminWebhook } from "@/lib/admin-data";

const labels: Record<string, string> = {
  connected: "Conectada",
  pending: "Pendente",
  error: "Erro",
  expired: "Expirada",
  disconnected: "Desconectada",
  open: "Aberto",
  waiting: "Aguardando",
  resolved: "Resolvido",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
  invalid: "Inválido",
  processed: "Processado",
  ignored: "Ignorado",
  received: "Recebido",
  failed: "Falhou",
  paid: "Pago",
  approved: "Aprovado",
  refunded: "Reembolsado",
  chargeback: "Chargeback",
  canceled: "Cancelado",
  plan: "Alteração de plano",
  ticket_create: "Atendimento criado",
  ticket_status: "Status do atendimento",
};
export function label(value: string) {
  return labels[value] ?? value;
}
export function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(value))
    : "Nunca";
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`admin-status ${["connected", "processed", "resolved", "approved", "paid"].includes(value) ? "good" : ["invalid", "failed", "error", "urgent", "chargeback"].includes(value) ? "bad" : "neutral"}`}
    >
      {label(value)}
    </span>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="admin-empty">{children}</div>;
}
export function Metric({
  label: title,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="admin-metric">
      <span>{title}</span>
      <strong>{value.toLocaleString("pt-BR")}</strong>
      <small>{detail}</small>
    </article>
  );
}
export function TicketList({ tickets }: { tickets: AdminTicket[] }) {
  return tickets.length ? (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Atendimento</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>Última atualização</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id}>
              <td>
                <strong>{t.subject}</strong>
                <small>#{t.id.slice(0, 8)}</small>
              </td>
              <td>
                <Status value={t.priority} />
              </td>
              <td>
                <Status value={t.status} />
              </td>
              <td>{date(t.updated_at)}</td>
              <td>
                <Link
                  className="admin-text-link"
                  href={`/admin/clientes/${t.user_id}`}
                >
                  Ver cliente →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>Nenhum atendimento registrado.</Empty>
  );
}
export function WebhookTable({ logs }: { logs: AdminWebhook[] }) {
  return logs.length ? (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Recebido em</th>
            <th>Evento</th>
            <th>Status</th>
            <th>Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{date(log.received_at)}</td>
              <td className="admin-mono">{log.event_id}</td>
              <td>
                <Status value={log.status} />
              </td>
              <td className="admin-message">
                {log.reason || "Sem observação"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>Nenhum evento de pagamento registrado.</Empty>
  );
}
