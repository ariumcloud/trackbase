import "server-only";
import { requirePlatformAdmin } from "./platform-admin";

export type AdminCustomer = {
  id: string;
  email: string | null;
  name: string;
  phone: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  workspace_count: number;
};
export type AdminWorkspace = {
  id: string;
  name: string;
  plan: string;
  owner_id: string;
  created_at: string;
  timezone: string;
};
export type AdminTicket = {
  id: string;
  user_id: string;
  subject: string;
  notes: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
};
export type AdminAudit = {
  id: string;
  actor_id: string | null;
  action: string;
  target_id: string;
  reason: string;
  before_value: Record<string, string> | null;
  after_value: Record<string, string> | null;
  created_at: string;
};
export type AdminIntegration = {
  id: string;
  workspace_id: string;
  name: string;
  provider: string;
  status: string;
  last_synced_at: string | null;
};
export type AdminWebhook = {
  id: string;
  workspace_id: string;
  integration_id: string;
  event_id: string;
  status: string;
  reason: string | null;
  received_at: string;
};
export type AdminCapi = {
  id: string;
  workspace_id: string;
  event_name: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  updated_at: string;
};
export type AdminOverview = {
  customers: number;
  new_customers: number;
  active_customers: number;
  workspaces: number;
  plans: Record<string, number>;
  integrations_attention: number;
  webhook_errors: number;
  capi_failed: number | null;
  open_tickets: number;
  events_today: number;
  sales_30d: number;
};
export type AdminData = {
  overview: AdminOverview;
  directory: { total: number; users: AdminCustomer[] };
  tickets: AdminTicket[];
  audit: AdminAudit[];
  integrations: AdminIntegration[];
  webhooks: AdminWebhook[];
  capi: AdminCapi[];
  workspaces: AdminWorkspace[];
};

export async function getAdminData(
  search: string,
  page: number,
  ticketStatus = "active",
  tab = "overview",
): Promise<AdminData> {
  const { client } = await requirePlatformAdmin();
  const emptyList = Promise.resolve({ data: [], error: null });

  // Overview RPC provides platform metrics and badge counts across tabs
  const overviewPromise = client.rpc("utm_admin_overview");

  // Directory is only needed on customers tab or overview preview (page 1)
  const directoryPromise =
    tab === "customers"
      ? client.rpc("utm_admin_directory", { p_search: search, p_page: page })
      : tab === "overview"
        ? client.rpc("utm_admin_directory", { p_search: "", p_page: 1 })
        : Promise.resolve({ data: { total: 0, users: [] }, error: null });

  // Tickets only on support tab
  let ticketPromise: PromiseLike<{ data: AdminTicket[] | null; error: unknown }> = emptyList;
  if (tab === "support") {
    let ticketQuery = client
      .from("utm_admin_tickets")
      .select("id,user_id,subject,notes,status,priority,created_at,updated_at");
    if (["open", "waiting", "resolved"].includes(ticketStatus))
      ticketQuery = ticketQuery.eq("status", ticketStatus);
    else if (ticketStatus !== "all")
      ticketQuery = ticketQuery.neq("status", "resolved");
    ticketPromise = ticketQuery.order("updated_at", { ascending: false }).limit(100);
  }

  // Audit only on audit tab
  const auditPromise =
    tab === "audit"
      ? client
          .from("utm_admin_audit")
          .select(
            "id,actor_id,action,target_id,reason,before_value,after_value,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(100)
      : emptyList;

  // Health tab queries: integrations, webhooks, capi
  const integrationsPromise =
    tab === "health"
      ? client
          .from("utm_integrations")
          .select("id,workspace_id,name,provider,status,last_synced_at")
          .neq("status", "connected")
          .order("created_at", { ascending: false })
          .limit(100)
      : emptyList;

  const webhooksPromise =
    tab === "health"
      ? client
          .from("utm_webhook_logs")
          .select(
            "id,workspace_id,integration_id,event_id,status,reason,received_at",
          )
          .eq("status", "invalid")
          .eq("is_test", false)
          .gte("received_at", new Date(Date.now() - 7 * 86400000).toISOString())
          .order("received_at", { ascending: false })
          .limit(100)
      : emptyList;

  const capiPromise =
    tab === "health"
      ? client
          .from("utm_capi_outbox")
          .select(
            "id,workspace_id,event_name,status,attempt_count,last_error,updated_at",
          )
          .eq("status", "failed")
          .order("updated_at", { ascending: false })
          .limit(100)
      : emptyList;

  const results = await Promise.all([
    overviewPromise,
    directoryPromise,
    ticketPromise,
    auditPromise,
    integrationsPromise,
    webhooksPromise,
    capiPromise,
  ]);

  if (
    results.some(
      (r, index) =>
        r.error &&
        !(index === 6 && ["42P01", "PGRST205"].includes((r.error as { code?: string })?.code || "")),
    )
  )
    throw new Error(
      "Não foi possível carregar a administração. Tente atualizar a página.",
    );

  const [overview, directory, tickets, audit, integrations, webhooks, capi] =
    results;

  let workspacesData: AdminWorkspace[] = [];
  if (tab === "health") {
    const workspaceIds = [
      ...new Set(
        [
          ...(integrations.data ?? []),
          ...(webhooks.data ?? []),
          ...(capi.data ?? []),
        ].map((r: { workspace_id: string }) => r.workspace_id),
      ),
    ];
    if (workspaceIds.length) {
      const workspaceResult = await client
        .from("utm_workspaces")
        .select("id,name,plan,owner_id,created_at,timezone")
        .in("id", workspaceIds);
      if (workspaceResult.error)
        throw new Error("Não foi possível identificar as operações.");
      workspacesData = workspaceResult.data ?? [];
    }
  }

  return {
    overview: overview.data,
    directory: directory.data ?? { total: 0, users: [] },
    tickets: tickets.data ?? [],
    audit: audit.data ?? [],
    integrations: integrations.data ?? [],
    webhooks: webhooks.data ?? [],
    capi: capi.data ?? [],
    workspaces: workspacesData,
  } as AdminData;
}

export async function getAdminCustomer(id: string) {
  const { client } = await requirePlatformAdmin();
  // Check Trackbase scope before using the shared Auth admin API.
  const directory = await client.rpc("utm_admin_directory", {
    p_search: id,
    p_page: 1,
  });
  if (directory.error) throw new Error("Não foi possível carregar o cliente.");
  const customer = (directory.data?.users as AdminCustomer[] | undefined)?.find(
    (u) => u.id === id,
  );
  if (!customer) return null;
  const membership = await client
    .from("utm_members")
    .select("workspace_id,role")
    .eq("user_id", id);
  if (membership.error)
    throw new Error("Não foi possível carregar as operações.");
  const ids = (membership.data ?? []).map((m) => m.workspace_id);
  const empty = { data: [], error: null, count: 0 };
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const results = await Promise.all([
    ids.length
      ? client
          .from("utm_workspaces")
          .select("id,name,plan,owner_id,created_at,timezone")
          .in("id", ids)
      : empty,
    ids.length
      ? client
          .from("utm_integrations")
          .select("id,workspace_id,name,provider,status,last_synced_at")
          .in("workspace_id", ids)
          .order("created_at", { ascending: false })
          .limit(100)
      : empty,
    ids.length
      ? client
          .from("utm_webhook_logs")
          .select(
            "id,workspace_id,integration_id,event_id,status,reason,received_at",
          )
          .in("workspace_id", ids)
          .eq("is_test", false)
          .order("received_at", { ascending: false })
          .limit(50)
      : empty,
    ids.length
      ? client
          .from("utm_sales")
          .select(
            "id,workspace_id,provider,transaction_id,status,amount,currency,occurred_at",
          )
          .in("workspace_id", ids)
          .eq("is_test", false)
          .order("occurred_at", { ascending: false })
          .limit(50)
      : empty,
    client
      .from("utm_admin_tickets")
      .select("id,user_id,subject,notes,status,priority,created_at,updated_at")
      .eq("user_id", id)
      .order("updated_at", { ascending: false })
      .limit(100),
    ids.length
      ? client
          .from("utm_offers")
          .select("id", { count: "exact", head: true })
          .in("workspace_id", ids)
      : empty,
    ids.length
      ? client
          .from("utm_links")
          .select("id", { count: "exact", head: true })
          .in("workspace_id", ids)
      : empty,
    ids.length
      ? client
          .from("utm_events")
          .select("id", { count: "exact", head: true })
          .in("workspace_id", ids)
          .gte("created_at", since)
      : empty,
    ids.length
      ? client
          .from("utm_sales")
          .select("id", { count: "exact", head: true })
          .in("workspace_id", ids)
          .eq("is_test", false)
          .gte("occurred_at", since)
      : empty,
  ]);
  if (results.some((r) => r.error))
    throw new Error("Não foi possível carregar todos os dados do cliente.");
  const targets = [
    id,
    ...ids,
    ...(results[4].data as AdminTicket[]).map((t) => t.id),
  ];
  const history = await client
    .from("utm_admin_audit")
    .select(
      "id,actor_id,action,target_id,reason,before_value,after_value,created_at",
    )
    .in("target_id", targets)
    .order("created_at", { ascending: false })
    .limit(100);
  if (history.error) throw new Error("Não foi possível carregar o histórico.");
  return {
    customer,
    history: history.data as AdminAudit[],
    memberships: membership.data ?? [],
    workspaces: results[0].data as AdminWorkspace[],
    integrations: results[1].data as AdminIntegration[],
    webhooks: results[2].data as AdminWebhook[],
    sales: results[3].data as {
      id: string;
      workspace_id: string;
      provider: string;
      transaction_id: string;
      status: string;
      amount: number;
      currency: string | null;
      occurred_at: string;
    }[],
    tickets: results[4].data as AdminTicket[],
    counts: {
      offers: results[5].count ?? 0,
      links: results[6].count ?? 0,
      events: results[7].count ?? 0,
      sales: results[8].count ?? 0,
    },
  };
}
