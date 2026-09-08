// Isolated browser fixture: no real users, credentials, or production requests.
// First build with NEXT_DIST_DIR=.next-admin-final; then run this script.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
const now = new Date().toISOString();
const adminId = "00000000-0000-4000-8000-000000000001",
  customerId = "00000000-0000-4000-8000-000000000002",
  workspaceId = "00000000-0000-4000-8000-000000000010";
const users = [
  {
    id: adminId,
    email: "admin@example.com",
    name: "Admin de teste",
    phone: "",
    created_at: now,
    last_sign_in_at: now,
    email_confirmed_at: now,
    workspace_count: 0,
  },
  {
    id: customerId,
    email: "cliente@example.com",
    name: "Cliente de teste",
    phone: "11999990000",
    created_at: now,
    last_sign_in_at: now,
    email_confirmed_at: now,
    workspace_count: 1,
  },
];
const tables = {
  utm_workspaces: [
    {
      id: workspaceId,
      name: "Operação de teste",
      plan: "devedor",
      owner_id: customerId,
      created_at: now,
      timezone: "America/Sao_Paulo",
    },
  ],
  utm_members: [
    { user_id: customerId, workspace_id: workspaceId, role: "owner" },
  ],
  utm_admin_tickets: [],
  utm_admin_audit: [],
  utm_capi_outbox: [],
  utm_integrations: [
    {
      id: "00000000-0000-4000-8000-000000000020",
      workspace_id: workspaceId,
      name: "Meta de teste",
      provider: "meta",
      status: "pending",
      last_synced_at: null,
      created_at: now,
    },
  ],
  utm_webhook_logs: [],
  utm_sales: [],
  utm_events: [],
  utm_offers: [],
  utm_links: [],
};
function authUser(email) {
  const u = users.find((u) => u.email === email);
  return (
    u && {
      ...u,
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
      identities: [],
    }
  );
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4319");
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const send = (data, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/auth/v1/token") {
    const user = authUser(body.email);
    if (!user) return send({ message: "Unknown fixture user" }, 401);
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({ sub: user.id, exp, role: "authenticated" }),
      ).toString("base64url"),
      Buffer.from("fixture-signature").toString("base64url"),
    ].join(".");
    return send({
      access_token: token,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: exp,
      refresh_token: "fixture-refresh",
      user,
    });
  }
  let subject;
  try {
    subject = JSON.parse(
      Buffer.from(
        (req.headers.authorization ?? "").split(".")[1],
        "base64url",
      ).toString(),
    ).sub;
  } catch {
    /* anon / service request */
  }
  if (url.pathname === "/auth/v1/user")
    return subject
      ? send(authUser(users.find((u) => u.id === subject)?.email))
      : send({ message: "No session" }, 401);
  if (url.pathname === "/auth/v1/logout") return send({});
  const name = url.pathname.split("/").pop();
  if (name === "utm_platform_admins")
    return send(subject === adminId ? [{ user_id: adminId }] : []);
  if (name === "utm_rate_limit") return send(true);
  if (name === "utm_admin_directory") {
    const found = users.filter((u) =>
      JSON.stringify(u)
        .toLowerCase()
        .includes((body.p_search || "").toLowerCase()),
    );
    return send({
      total: found.length,
      users: found.slice(
        ((body.p_page || 1) - 1) * 25,
        (body.p_page || 1) * 25,
      ),
    });
  }
  if (name === "utm_admin_overview")
    return send({
      customers: 2,
      new_customers: 2,
      active_customers: 2,
      workspaces: 1,
      plans: { [tables.utm_workspaces[0].plan]: 1 },
      integrations_attention: 1,
      webhook_errors: 0,
      capi_failed: 0,
      open_tickets: tables.utm_admin_tickets.filter(
        (t) => t.status !== "resolved",
      ).length,
      events_today: 0,
      sales_30d: 0,
    });
  if (name === "utm_admin_mutate") {
    const { p_action: action, p_target: target, p_input: input } = body;
    if (body.p_actor !== adminId) return send({ message: "Denied" }, 403);
    if (action === "ticket_create")
      tables.utm_admin_tickets.unshift({
        id: randomUUID(),
        user_id: target,
        subject: input.subject,
        notes: input.reason,
        priority: input.priority,
        status: "open",
        created_at: now,
        updated_at: now,
      });
    if (action === "ticket_status")
      tables.utm_admin_tickets.find((t) => t.id === target).status =
        input.status;
    if (action === "plan")
      tables.utm_workspaces.find((w) => w.id === target).plan = input.plan;
    tables.utm_admin_audit.unshift({
      id: randomUUID(),
      action,
      actor_id: adminId,
      target_id: target,
      reason: input.reason,
      before_value: null,
      after_value: { status: input.status || input.plan || "open" },
      created_at: new Date().toISOString(),
    });
    return send(null);
  }
  let rows = tables[name] ?? [];
  if (name === "utm_workspaces" && req.headers.apikey === "fixture-public")
    rows = rows.filter((w) => w.owner_id === subject);
  for (const [key, value] of url.searchParams) {
    if (value.startsWith("eq."))
      rows = rows.filter((r) => String(r[key]) === value.slice(3));
    if (value.startsWith("neq."))
      rows = rows.filter((r) => String(r[key]) !== value.slice(4));
    if (value.startsWith("in.("))
      rows = rows.filter((r) =>
        value.slice(4, -1).split(",").includes(String(r[key])),
      );
  }
  if (req.method === "HEAD") {
    res.writeHead(200, { "Content-Range": `0-0/${rows.length}` });
    return res.end();
  }
  send(rows);
});
server.listen(4319, "127.0.0.1", () => {
  console.log("Isolated fixture API ready on 4319");
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--port", "4320"],
    {
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_DIST_DIR: ".next-admin-final",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4319",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public",
        SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
        APP_URL: "http://localhost:4320",
      },
    },
  );
  const stop = () => {
    child.kill();
    server.close();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
});
