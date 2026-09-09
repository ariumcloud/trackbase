import Link from "next/link";
import { ArrowLeft, UserRound, ExternalLink } from "lucide-react";
import type { getAdminCustomer } from "@/lib/admin-data";
import { plans, normalizePlan } from "@/lib/plans";
import { PlanForm, QuickGrantPremiumButton, NewTicketForm, TicketStatusForm } from "./forms";
import { Metric, Status, Empty, WebhookTable, date, label } from "./shared";

export function AdminCustomerView({
  data: d,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getAdminCustomer>>>;
}) {
  const c = d.customer;
  return (
    <>
      <Link className="admin-back" href="/admin?tab=customers">
        <ArrowLeft size={16} /> Todos os clientes
      </Link>
      <div className="admin-heading">
        <div>
          <div className="eyebrow">FICHA DO CLIENTE</div>
          <h1>{c.name || c.email || "Cliente"}</h1>
          <p>
            {c.name
              ? c.email
              : "Dados de cadastro, operação e histórico de suporte."}
          </p>
        </div>
        <span className="admin-customer-avatar">
          <UserRound size={30} />
        </span>
      </div>
      <section className="admin-card admin-profile">
        <div>
          <span>E-mail</span>
          <strong>{c.email || "Não informado"}</strong>
        </div>
        <div>
          <span>Telefone</span>
          <strong>{c.phone || "Não informado"}</strong>
        </div>
        <div>
          <span>Cadastrado em</span>
          <strong>{date(c.created_at)}</strong>
        </div>
        <div>
          <span>Último acesso</span>
          <strong>{date(c.last_sign_in_at)}</strong>
        </div>
        <div>
          <span>Confirmação de e-mail</span>
          <strong>
            {c.email_confirmed_at ? date(c.email_confirmed_at) : "Pendente"}
          </strong>
        </div>
        <div>
          <span>ID do cliente</span>
          <strong className="admin-mono">{c.id}</strong>
        </div>
      </section>
      <div className="admin-metrics">
        <Metric
          label="Ofertas"
          value={d.counts.offers}
          detail="Nas operações deste cliente"
        />
        <Metric
          label="Links"
          value={d.counts.links}
          detail="Nas operações deste cliente"
        />
        <Metric
          label="Eventos · 30 dias"
          value={d.counts.events}
          detail="Eventos de rastreamento"
        />
        <Metric
          label="Vendas · 30 dias"
          value={d.counts.sales}
          detail="Todos os status · sem testes"
        />
      </div>
      <div className="admin-section-heading">
        <div>
          <h2>Operações e planos</h2>
          <p>
            Planos e limites são definidos por workspace. O cliente pode
            participar de operações de outras pessoas.
          </p>
        </div>
      </div>
      {d.workspaces.length ? (
        <div className="admin-workspaces">
          {d.workspaces.map((w) => (
            <section key={w.id} className="admin-card">
              <div className="admin-section-heading">
                <div>
                  <h3>{w.name}</h3>
                  <p>
                    {w.owner_id === c.id
                      ? "Proprietário"
                      : `Membro · ${d.memberships.find((m) => m.workspace_id === w.id)?.role}`}{" "}
                    · {w.timezone}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span className={`admin-status ${normalizePlan(w.plan) === "vorcaro" ? "good" : "neutral"}`}>
                    {plans[normalizePlan(w.plan)].name}
                  </span>
                  {normalizePlan(w.plan) !== "vorcaro" && (
                    <QuickGrantPremiumButton id={w.id} name={w.name} />
                  )}
                </div>
              </div>
              <p className="admin-hint admin-mono">{w.id}</p>
              <details className="admin-details" open={normalizePlan(w.plan) !== "vorcaro"}>
                <summary>Alterar plano manualmente</summary>
                <PlanForm id={w.id} name={w.name} plan={w.plan} />
              </details>
            </section>
          ))}
        </div>
      ) : (
        <section className="admin-card">
          <Empty>
            Este cliente ainda não criou uma operação. Ajude-o a concluir o
            primeiro acesso.
          </Empty>
        </section>
      )}
      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <h2>Produtos e Ofertas (Auditoria & Compliance)</h2>
            <p>
              Inspecione as páginas e checkouts cadastrados pelo usuário para auditoria anti-fraude.
            </p>
          </div>
          <span className="admin-badge neutral">
            {d.offers.length} ofertas
          </span>
        </div>
        {d.offers.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Produto / Oferta</th>
                  <th>Operação</th>
                  <th>Plataforma</th>
                  <th>Páginas & Links</th>
                  <th>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {d.offers.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong>{o.name || "Sem nome"}</strong>
                        <span className={`admin-status ${o.active ? "good" : "neutral"}`}>
                          {o.active ? "Ativa" : "Pausada"}
                        </span>
                      </div>
                      <small className="admin-mono" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        {o.id.slice(0, 10)}... · {o.product_type || "digital"} · {o.currency}
                      </small>
                    </td>
                    <td>
                      {d.workspaces.find((w) => w.id === o.workspace_id)?.name ?? o.workspace_id}
                    </td>
                    <td>
                      <span className="admin-tag">
                        {o.platform ? o.platform.toUpperCase() : "HOTMART/OUTRA"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {o.landing_url ? (
                          <a
                            href={o.landing_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="admin-text-link"
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", wordBreak: "break-all" }}
                          >
                            <ExternalLink size={12} /> Landing Page
                          </a>
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Sem landing</span>
                        )}
                        {o.checkout_url ? (
                          <a
                            href={o.checkout_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="admin-text-link"
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", wordBreak: "break-all", color: "#10b981" }}
                          >
                            <ExternalLink size={12} /> Checkout
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td>{date(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Nenhum produto ou oferta cadastrado por este cliente.</Empty>
        )}
      </section>
      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <h2>Integrações</h2>
            <p>Até 100 integrações recentes das operações deste cliente.</p>
          </div>
        </div>
        {d.integrations.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Integração</th>
                  <th>Operação</th>
                  <th>Status</th>
                  <th>Última sincronização</th>
                </tr>
              </thead>
              <tbody>
                {d.integrations.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.name}</strong>
                      <small>{i.provider}</small>
                    </td>
                    <td>
                      {d.workspaces.find((w) => w.id === i.workspace_id)?.name}
                    </td>
                    <td>
                      <Status value={i.status} />
                    </td>
                    <td>{date(i.last_synced_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Nenhuma integração conectada ou em configuração.</Empty>
        )}
      </section>
      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <h2>Últimas vendas</h2>
            <p>
              50 registros mais recentes, de todos os status. Testes excluídos.
            </p>
          </div>
        </div>
        {d.sales.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Transação</th>
                  <th>Provedor</th>
                  <th>Status</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {d.sales.map((s) => (
                  <tr key={s.id}>
                    <td>{date(s.occurred_at)}</td>
                    <td className="admin-mono">{s.transaction_id}</td>
                    <td>{s.provider}</td>
                    <td>
                      <Status value={s.status} />
                    </td>
                    <td>
                      {s.currency
                        ? new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: s.currency,
                          }).format(Number(s.amount))
                        : `${s.amount} (moeda não informada)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Nenhuma venda registrada.</Empty>
        )}
      </section>
      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <h2>Eventos de pagamento</h2>
            <p>
              50 webhooks mais recentes · use o identificador do evento para
              investigar uma venda.
            </p>
          </div>
        </div>
        <WebhookTable logs={d.webhooks} />
      </section>
      <div className="admin-grid support">
        <section className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h2>Registrar atendimento</h2>
              <p>Anotações internas, visíveis apenas no Admin.</p>
            </div>
          </div>
          <NewTicketForm userId={c.id} />
        </section>
        <section className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h2>Atendimentos deste cliente</h2>
              <p>
                Até 100 registros. Atualizações e soluções ficam no histórico
                administrativo.
              </p>
            </div>
          </div>
          {d.tickets.length ? (
            d.tickets.map((t) => (
              <details className="admin-ticket" key={t.id}>
                <summary>
                  <strong>{t.subject}</strong>
                  <span>
                    <Status value={t.status} />
                    <Status value={t.priority} />
                  </span>
                </summary>
                <small>
                  #{t.id.slice(0, 8)} · {date(t.created_at)}
                </small>
                <p className="admin-ticket-notes">{t.notes}</p>
                <TicketStatusForm id={t.id} status={t.status} />
              </details>
            ))
          ) : (
            <Empty>Nenhum atendimento registrado para este cliente.</Empty>
          )}
        </section>
      </div>
      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <h2>Histórico do cliente</h2>
            <p>
              Alterações de plano, andamento e soluções dos atendimentos · até
              100 registros.
            </p>
          </div>
        </div>
        {d.history.length ? (
          <div className="admin-audit-list">
            {d.history.map((a) => (
              <article key={a.id}>
                <span className="admin-timeline-dot" />
                <div>
                  <div className="admin-audit-title">
                    <strong>{label(a.action)}</strong>
                    <time>{date(a.created_at)}</time>
                  </div>
                  <p>{a.reason}</p>
                  {a.after_value && (
                    <p className="admin-audit-change">
                      {Object.entries(a.after_value)
                        .map(([key, value]) => `${key}: ${label(value)}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty>Nenhum histórico administrativo para este cliente.</Empty>
        )}
      </section>
    </>
  );
}
