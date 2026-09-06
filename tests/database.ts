import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
async function main() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;grant all on auth.users to service_role;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/20260906021328_utmliso_mvp.sql", "utf8"),
  );
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002";
  await db.query("insert into auth.users values ($1),($2)", [a, b]);
  await db.exec("set role service_role");
  const wa = (
    await db.query<{ id: string }>(
      "select public.utm_create_workspace($1,$2,$3) id",
      [a, "Operação A", "America/Sao_Paulo"],
    )
  ).rows[0].id;
  const wb = (
    await db.query<{ id: string }>(
      "select public.utm_create_workspace($1,$2,$3) id",
      [b, "Operação B", "UTC"],
    )
  ).rows[0].id;
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
  await db.exec("set role authenticated");
  assert.equal(
    (await db.query("select * from public.utm_workspaces")).rows.length,
    1,
  );
  const offer = (
    await db.query<{ id: string }>(
      "insert into public.utm_offers(workspace_id,name,landing_url,currency) values($1,'Oferta A','https://example.com','BRL') returning id",
      [wa],
    )
  ).rows[0].id;
  await assert.rejects(() =>
    db.query(
      "insert into public.utm_offers(workspace_id,name,landing_url,currency) values($1,'Ataque','https://example.com','BRL')",
      [wb],
    ),
  );
  await assert.rejects(() =>
    db.query("update public.utm_offers set workspace_id=$1 where id=$2", [
      wb,
      offer,
    ]),
  );
  await assert.rejects(() => db.query("select * from public.utm_credentials"));
  await assert.rejects(() =>
    db.query("select public.utm_create_workspace($1,$2,$3)", [
      a,
      "Escape",
      "UTC",
    ]),
  );
  await assert.rejects(() =>
    db.query("insert into public.utm_members values($1,$2,'owner')", [wb, a]),
  );
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
  await db.exec("set role authenticated");
  assert.equal(
    (await db.query("select * from public.utm_offers")).rows.length,
    0,
  );
  await assert.rejects(() =>
    db.query(
      "insert into public.utm_links(workspace_id,offer_id,name,url) values($1,$2,'Cross tenant','https://example.com')",
      [wb, offer],
    ),
  );
  await db.exec("reset role;set role service_role");
  const integration = (
    await db.query<{ id: string }>(
      "insert into public.utm_integrations(workspace_id,offer_id,provider,name,external_product_id) values($1,$2,'cakto','Cakto','prod') returning id",
      [wa, offer],
    )
  ).rows[0].id;
  const payment = {
    event_id: "event1",
    transaction_id: "tx1",
    product_id: "prod",
    external_offer_id: "",
    status: "approved",
    amount: 100,
    currency: "BRL",
    attribution: {},
    occurred_at: "2026-09-06T00:00:00Z",
    is_test: false,
  };
  const process = (p: unknown) =>
    db.query<{ status: string }>(
      "select public.utm_process_payment($1,$2) status",
      [integration, JSON.stringify(p)],
    );
  assert.equal((await process(payment)).rows[0].status, "processed");
  assert.equal((await process(payment)).rows[0].status, "duplicate");
  assert.equal(
    (await db.query("select * from public.utm_sales")).rows.length,
    1,
  );
  await process({
    ...payment,
    event_id: "refund",
    status: "refunded",
    occurred_at: "2026-09-06T01:00:00Z",
  });
  await process({ ...payment, event_id: "late-approval" });
  assert.equal(
    (await db.query<{ status: string }>("select status from public.utm_sales"))
      .rows[0].status,
    "refunded",
  );
  await assert.rejects(() =>
    process({ ...payment, event_id: "wrong-product", product_id: "other" }),
  );
  await process({ ...payment, event_id: "test-event", is_test: true });
  await db.query(
    "delete from public.utm_sales where workspace_id=$1 and is_test=true",
    [wa],
  );
  assert.equal(
    (await db.query("select * from public.utm_sales")).rows.length,
    1,
  );
  assert.equal(
    (
      await db.query<{ ok: boolean }>(
        "select public.utm_rate_limit('bucket',1) ok",
      )
    ).rows[0].ok,
    true,
  );
  assert.equal(
    (
      await db.query<{ ok: boolean }>(
        "select public.utm_rate_limit('bucket',1) ok",
      )
    ).rows[0].ok,
    false,
  );
  await db.exec("reset role;set role anon");
  await assert.rejects(() => db.query("select * from public.utm_sales"));
  await db.exec("reset role");
  console.log(
    "PASS: migration, 2 usuários, RLS, acesso anônimo, credenciais, FK composta, idempotência, evento fora de ordem, reembolso, limpeza de testes e rate limit.",
  );
  await db.close();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
