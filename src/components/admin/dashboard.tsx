import Link from "next/link";
import { AdminRefresh } from "./forms";
import {
  Users,
  Activity,
  Headphones,
  History,
  LayoutDashboard,
  Search,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import type { AdminData } from "@/lib/admin-data";
import { normalizePlan, plans } from "@/lib/plans";
import { date, label, Status, Empty, Metric, TicketList } from "./shared";

const tabs = [
  { id: "overview", name: "Visão geral", icon: LayoutDashboard },
  { id: "customers", name: "Clientes", icon: Users },
  { id: "health", name: "Saúde da operação", icon: Activity },
  { id: "support", name: "Atendimentos", icon: Headphones },
  { id: "audit", name: "Histórico", icon: History },
];

export function AdminDashboard({
  data,
  tab,
  search,
  page,
}: {
  data: AdminData;
  tab: string;
  search: string;
  page: number;
}) {
  const active = tabs.some((t) => t.id === tab) ? tab : "overview";
  const o = data.overview;
  const attention =
    o.integrations_attention + o.webhook_errors + (o.capi_failed ?? 0);
  const workspaceMap = new Map(data.workspaces.map((w) => [w.id, w]));
  const link = (p: number) =>
    `/admin?tab=customers&q=${encodeURIComponent(search)}&page=${p}`;
  const normalizedPlans = Object.entries(o.plans).reduce<
    Record<string, number>
  >((acc, [id, n]) => {
    const key = normalizePlan(id);
    acc[key] = (acc[key] ?? 0) + n;
    return acc;
  }, {});
  return (
    <>
      <div className="admin-heading">
        <div>
          <div className="eyebrow">CENTRAL DE CONTROLE</div>
          <h1>Sua plataforma, de perto.</h1>
          <p>
            Clientes, operação e suporte. Tudo o que você precisa para cuidar do
            Trackbase.
          </p>
        </div>
        <AdminRefresh />
      </div>
      <nav className="admin-tabs" aria-label="Administração">
        {tabs.map((t) => (
          <Link
            key={t.id}
            className={active === t.id ? "active" : ""}
            href={`/admin?tab=${t.id}`}
            aria-current={active === t.id ? "page" : undefined}
          >
            <t.icon size={17} />
            {t.name}
            {t.id === "support" && o.open_tickets > 0 && (
              <b>{o.open_tickets}</b>
            )}
          </Link>
        ))}
      </nav>
      {active === "overview" && (
        <>
          <div className="admin-metrics">
            <Metric
              label="Clientes"
              value={o.customers}
              detail={`+${o.new_customers} cadastros nos últimos 7 dias`}
            />
            <Metric
              label="Clientes com acesso recente"
              value={o.active_customers}
              detail="Último login nos últimos 30 dias"
            />
            <Metric
              label="Workspaces"
              value={o.workspaces}
              detail="Operações cadastradas no Trackbase"
            />
            <Metric
              label="Atendimentos em aberto"
              value={o.open_tickets}
              detail="Abertos ou aguardando retorno"
            />
          </div>
          <div className="admin-grid">
            <section className="admin-card">
              <div className="admin-section-heading">
                <div>
                  <h2>O que precisa de atenção</h2>
                  <p>Acompanhe os sinais antes de o cliente chamar.</p>
                </div>
                <AlertCircle size={21} />
              </div>
              {[
                {
                  title: "Integrações não conectadas",
                  value: o.integrations_attention,
                  hint: "Inclui configurações pendentes",
                },
                {
                  title: "Falhas em pagamentos",
                  value: o.webhook_errors,
                  hint: "Webhooks inválidos · últimos 7 dias",
                },
                {
                  title: "Eventos CAPI com falha",
                  value: o.capi_failed,
                  hint: "Envios que esgotaram as tentativas",
                },
              ].map((r) => (
                <Link
                  href="/admin?tab=health"
                  className="admin-attention-row"
                  key={r.title}
                >
                  <span>
                    <strong>{r.title}</strong>
                    <small>{r.hint}</small>
                  </span>
                  <b className={r.value ? "admin-warning-count" : ""}>
                    {r.value ?? "Indisponível"}
                  </b>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
              {!attention && (
                <p className="admin-success">
                  Nenhuma pendência nos indicadores disponíveis.
                </p>
              )}
            </section>
            <section className="admin-card">
              <div className="admin-section-heading">
                <div>
                  <h2>Distribuição de planos</h2>
                  <p>Quantidade de workspaces por plano.</p>
                </div>
              </div>
              {Object.entries(plans).map(([id, p]) => (
                <div className="admin-plan-row" key={id}>
                  <div>
                    <strong>{p.name}</strong>
                    <span>{normalizedPlans[id] ?? 0}</span>
                  </div>
                  <div className="admin-progress">
                    <span
                      style={{
                        width: `${o.workspaces ? ((normalizedPlans[id] ?? 0) / o.workspaces) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="admin-hint">
                Plano habilitado não comprova pagamento. A receita de
                assinaturas depende de uma integração de cobrança.
              </p>
            </section>
          </div>
          <div className="admin-metrics compact">
            <Metric
              label="Eventos de rastreamento hoje"
              value={o.events_today}
              detail="Dia atual no fuso de São Paulo"
            />
            <Metric
              label="Vendas registradas em 30 dias"
              value={o.sales_30d}
              detail="Todos os status · exclui testes"
            />
          </div>
          <section className="admin-card">
            <div className="admin-section-heading">
              <div>
                <h2>Clientes recentes</h2>
                <p>Abra a ficha para entender a operação.</p>
              </div>
              <Link className="admin-text-link" href="/admin?tab=customers">
                Todos os clientes →
              </Link>
            </div>
            <CustomerTable users={data.directory.users.slice(0, 5)} />
          </section>
        </>
      )}
      {active === "customers" && (
        <section className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h2>Clientes do Trackbase</h2>
              <p>{data.directory.total} resultado(s) · 25 por página</p>
            </div>
          </div>
          <form className="admin-search" action="/admin">
            <input name="tab" type="hidden" value="customers" />
            <Search size={18} />
            <input
              aria-label="Buscar cliente"
              name="q"
              defaultValue={search}
              maxLength={160}
              placeholder="Busque por e-mail, nome, telefone ou ID"
            />
            <button className="button small">Buscar</button>
            {search && (
              <Link href="/admin?tab=customers" className="admin-text-link">
                Limpar
              </Link>
            )}
          </form>
          <CustomerTable users={data.directory.users} />
          <div className="admin-pagination">
            {page > 1 ? (
              <Link className="button ghost small" href={link(page - 1)}>
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            <span>
              Página {page} de{" "}
              {Math.max(1, Math.ceil(data.directory.total / 25))}
            </span>
            {page * 25 < data.directory.total ? (
              <Link className="button ghost small" href={link(page + 1)}>
                Próxima →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </section>
      )}
      {active === "health" && (
        <>
          <div className="admin-notice">
            Indicadores de integrações e processamento. Cada lista mostra até
            100 ocorrências; os totais da visão geral consideram toda a base.
          </div>
          <section className="admin-card">
            <div className="admin-section-heading">
              <div>
                <h2>Integrações que precisam de atenção</h2>
                <p>Pendentes, desconectadas ou com erro.</p>
              </div>
            </div>
            {data.integrations.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Integração</th>
                      <th>Operação</th>
                      <th>Status</th>
                      <th>Última sincronização</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.integrations.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <strong>{i.name}</strong>
                          <small>{i.provider}</small>
                        </td>
                        <td>
                          {workspaceMap.get(i.workspace_id)?.name ??
                            i.workspace_id}
                        </td>
                        <td>
                          <Status value={i.status} />
                        </td>
                        <td>{date(i.last_synced_at)}</td>
                        <td>
                          <Link
                            className="admin-text-link"
                            href={`/admin/clientes/${workspaceMap.get(i.workspace_id)?.owner_id}`}
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
              <Empty>Nenhuma integração pendente.</Empty>
            )}
          </section>
          <section className="admin-card">
            <div className="admin-section-heading">
              <div>
                <h2>Falhas de pagamentos · 7 dias</h2>
                <p>
                  Eventos inválidos recebidos dos gateways. Testes excluídos.
                </p>
              </div>
            </div>
            {data.webhooks.length ? (
              <div className="admin-issue-list">
                {data.webhooks.map((w) => (
                  <article key={w.id}>
                    <div>
                      <Status value={w.status} />
                      <time>{date(w.received_at)}</time>
                    </div>
                    <strong>
                      {workspaceMap.get(w.workspace_id)?.name ?? w.workspace_id}
                    </strong>
                    <p className="admin-message">
                      {w.reason || "O provedor enviou um evento inválido."}
                    </p>
                    <small className="admin-mono">Evento: {w.event_id}</small>
                    <Link
                      className="admin-text-link"
                      href={`/admin/clientes/${workspaceMap.get(w.workspace_id)?.owner_id}`}
                    >
                      Investigar cliente →
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <Empty>Nenhum webhook inválido nos últimos 7 dias.</Empty>
            )}
          </section>
          <section className="admin-card">
            <div className="admin-section-heading">
              <div>
                <h2>Fila CAPI · falhas definitivas</h2>
                <p>
                  Verifique a integração e as permissões do pixel na operação do
                  cliente.
                </p>
              </div>
            </div>
            {data.capi.length ? (
              <div className="admin-issue-list">
                {data.capi.map((c) => (
                  <article key={c.id}>
                    <div>
                      <Status value={c.status} />
                      <time>{date(c.updated_at)}</time>
                    </div>
                    <strong>
                      {c.event_name} · {c.attempt_count} tentativas
                    </strong>
                    <p className="admin-message">
                      {c.last_error || "Envio não concluído."}
                    </p>
                    <Link
                      className="admin-text-link"
                      href={`/admin/clientes/${workspaceMap.get(c.workspace_id)?.owner_id}`}
                    >
                      Investigar cliente →
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <Empty>
                {o.capi_failed === null
                  ? "A fila CAPI ainda não está habilitada nesta instalação. Este indicador está indisponível."
                  : "Nenhum envio CAPI com falha definitiva."}
              </Empty>
            )}
          </section>
        </>
      )}
      {active === "support" && (
        <section className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h2>Central de atendimentos</h2>
              <p>
                100 atualizações mais recentes. Para registrar um atendimento,
                abra a ficha do cliente.
              </p>
            </div>
            <Link href="/admin?tab=customers" className="button small">
              Localizar cliente
            </Link>
          </div>
          <div className="admin-filter-links">
            <Link href="/admin?tab=support">Em andamento</Link>
            <Link href="/admin?tab=support&status=open">Abertos</Link>
            <Link href="/admin?tab=support&status=waiting">Aguardando</Link>
            <Link href="/admin?tab=support&status=resolved">Resolvidos</Link>
            <Link href="/admin?tab=support&status=all">Todos</Link>
          </div>
          <TicketList tickets={data.tickets} />
        </section>
      )}
      {active === "audit" && (
        <section className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h2>Histórico administrativo</h2>
              <p>100 alterações mais recentes · horários de São Paulo.</p>
            </div>
          </div>
          {data.audit.length ? (
            <div className="admin-audit-list">
              {data.audit.map((a) => (
                <article key={a.id}>
                  <span className="admin-timeline-dot" />
                  <div>
                    <div className="admin-audit-title">
                      <strong>{label(a.action)}</strong>
                      <time>{date(a.created_at)}</time>
                    </div>
                    <p>{a.reason}</p>
                    <small className="admin-mono">
                      Alvo: {a.target_id} · Admin:{" "}
                      {a.actor_id ?? "Conta removida"}
                    </small>
                    {a.before_value && (
                      <p className="admin-audit-change">
                        Antes:{" "}
                        {Object.entries(a.before_value)
                          .map(([k, v]) => `${k}: ${label(v)}`)
                          .join(" · ")}
                      </p>
                    )}
                    {a.after_value && (
                      <p className="admin-audit-change">
                        Depois:{" "}
                        {Object.entries(a.after_value)
                          .map(([k, v]) => `${k}: ${label(v)}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty>Nenhuma alteração administrativa registrada.</Empty>
          )}
        </section>
      )}
    </>
  );
}

function CustomerTable({ users }: { users: AdminData["directory"]["users"] }) {
  return users.length ? (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Cadastro</th>
            <th>Último acesso</th>
            <th>Operações</th>
            <th>E-mail</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <strong>{u.email || "Sem e-mail"}</strong>
                <small>{u.name || u.phone || `ID ${u.id.slice(0, 8)}`}</small>
              </td>
              <td>{date(u.created_at)}</td>
              <td>{date(u.last_sign_in_at)}</td>
              <td>{u.workspace_count}</td>
              <td>
                <span
                  className={`admin-status ${u.email_confirmed_at ? "good" : "neutral"}`}
                >
                  {u.email_confirmed_at ? "Confirmado" : "Pendente"}
                </span>
              </td>
              <td>
                <Link
                  className="admin-text-link"
                  href={`/admin/clientes/${u.id}`}
                  style={{ fontWeight: 600 }}
                >
                  Abrir ficha & Plano →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>Nenhum cliente encontrado. Tente outro e-mail ou nome.</Empty>
  );
}
