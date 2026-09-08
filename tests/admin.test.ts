import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import {
  adminMutationSchema,
  adminPageNumber,
} from "../src/lib/admin-validation";

test("admin validates actions, plan IDs, reasons and pagination", () => {
  const base = {
    action: "plan",
    target: "00000000-0000-4000-8000-000000000001",
    reason: "Ajuste solicitado",
    plan: "liso",
  };
  assert.equal(adminMutationSchema.safeParse(base).success, true);
  for (const invalid of [
    { ...base, plan: "admin" },
    { ...base, reason: " " },
    { ...base, target: "' or true" },
    { ...base, action: "delete_user" },
  ])
    assert.equal(adminMutationSchema.safeParse(invalid).success, false);
  for (const page of ["NaN", "-1", "2.4"])
    assert.equal(adminPageNumber(page), 1);
  assert.equal(adminPageNumber("2"), 2);
});

test("admin database isolates customers, denies escalation and records changes atomically", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,phone text,created_at timestamptz default now(),last_sign_in_at timestamptz,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',encrypted_password text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;`);
    for (const name of readdirSync("supabase/migrations")
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
    const owner = "00000000-0000-4000-8000-000000000001",
      customer = "00000000-0000-4000-8000-000000000002",
      crm = "00000000-0000-4000-8000-000000000003",
      newUser = "00000000-0000-4000-8000-000000000004";
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values ($1,'admin@example.com','{}'),($2,'cliente@example.com','{}'),($3,'crm@example.com','{}'),($4,'novo@example.com','{\"app\":\"trackbase\"}')",
      [owner, customer, crm, newUser],
    );
    await db.query(
      "insert into public.utm_platform_admins(user_id) values ($1)",
      [owner],
    );
    await db.exec("set role service_role");
    await assert.rejects(() =>
      db.query("select encrypted_password from auth.users"),
    );
    const workspace = (
      await db.query<{ id: string }>(
        "select public.utm_create_workspace($1,'Cliente','UTC') id",
        [customer],
      )
    ).rows[0].id;
    const directory = (
      await db.query<{ data: { total: number; users: { email: string }[] } }>(
        "select public.utm_admin_directory('') data",
      )
    ).rows[0].data;
    assert.equal(directory.total, 2);
    assert.ok(!JSON.stringify(directory).includes("crm@example.com"));
    assert.equal(
      (
        await db.query<{ data: { total: number } }>(
          "select public.utm_admin_directory('cliente@example.com') data",
        )
      ).rows[0].data.total,
      1,
    );
    const change = { plan: "liso", reason: "Liberado para suporte" };
    const mutate = (
      actor: string,
      action: string,
      target: string,
      input: object,
    ) =>
      db.query("select public.utm_admin_mutate($1,$2,$3,$4)", [
        actor,
        action,
        target,
        input,
      ]);
    const currentPlan = async () =>
      (
        await db.query<{ plan: string }>(
          "select plan from public.utm_workspaces where id=$1",
          [workspace],
        )
      ).rows[0].plan;
    await assert.rejects(() => mutate(customer, "plan", workspace, change));
    await mutate(owner, "plan", workspace, change);
    assert.equal(await currentPlan(), "liso");
    assert.equal(
      (await db.query("select * from public.utm_admin_audit")).rows.length,
      1,
    );
    await assert.rejects(() =>
      mutate(owner, "ticket_create", crm, {
        reason: "Não pertence ao app",
        subject: "Teste CRM",
        priority: "normal",
      }),
    );
    await mutate(owner, "ticket_create", customer, {
      reason: "Venda não apareceu",
      subject: "Verificar venda",
      priority: "high",
    });
    const ticket = (
      await db.query<{ id: string }>("select id from public.utm_admin_tickets")
    ).rows[0].id;
    await mutate(owner, "ticket_status", ticket, {
      reason: "Integração corrigida",
      status: "resolved",
    });
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from public.utm_admin_tickets",
        )
      ).rows[0].status,
      "resolved",
    );
    assert.equal(
      (await db.query("select * from public.utm_admin_audit")).rows.length,
      3,
    );
    await assert.rejects(() =>
      mutate(owner, "plan", workspace, { plan: "vorcaro", reason: "" }),
    );
    assert.equal(await currentPlan(), "liso");
    await db.exec(`reset role;create function public.test_deny_audit() returns trigger language plpgsql as $$begin raise exception 'Audit unavailable';end$$;
      create trigger test_deny_audit before insert on public.utm_admin_audit for each row execute function public.test_deny_audit();set role service_role;`);
    await assert.rejects(() =>
      mutate(owner, "plan", workspace, {
        plan: "vorcaro",
        reason: "Atomicidade",
      }),
    );
    assert.equal(await currentPlan(), "liso");
    await db.exec(
      "reset role;drop trigger test_deny_audit on public.utm_admin_audit;drop function public.test_deny_audit();",
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      customer,
    ]);
    await db.exec("set role authenticated");
    assert.equal(
      (await db.query("select * from public.utm_platform_admins")).rows.length,
      0,
    );
    await assert.rejects(() =>
      db.query("insert into public.utm_platform_admins(user_id) values ($1)", [
        customer,
      ]),
    );
    for (const sql of [
      "select public.utm_admin_overview()",
      "select public.utm_admin_directory('')",
      "select * from public.utm_admin_tickets",
      "select * from public.utm_admin_audit",
    ])
      await assert.rejects(() => db.query(sql));
    await assert.rejects(() => mutate(owner, "plan", workspace, change));
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await db.exec("set role authenticated");
    assert.equal(
      (await db.query("select * from public.utm_platform_admins")).rows.length,
      1,
    );
    await assert.rejects(() =>
      db.query("select public.utm_admin_directory('')"),
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(() =>
      db.query("select * from public.utm_platform_admins"),
    );
    await assert.rejects(() => db.query("select public.utm_admin_overview()"));
    await db.exec("reset role;set role service_role");
    await db.query("delete from public.utm_platform_admins where user_id=$1", [
      owner,
    ]);
    await assert.rejects(() => mutate(owner, "plan", workspace, change));
    await db.query("select public.utm_admin_overview()");
    await db.exec(
      "reset role;drop table public.utm_capi_outbox cascade;set role service_role;",
    );
    assert.equal(
      (
        await db.query<{ overview: { capi_failed: number | null } }>(
          "select public.utm_admin_overview() overview",
        )
      ).rows[0].overview.capi_failed,
      null,
    );
  } finally {
    await db.close();
  }
});
