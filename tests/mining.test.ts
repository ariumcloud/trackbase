import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  captureSchema,
  filtersSchema,
  updateSchema,
  analysisSchema,
  changes,
  monitorSchema,
  publicUrl,
} from "../src/lib/mining/schema";
import { grantValid } from "../src/lib/mining/server";
import { responseText } from "../src/lib/assistant-transport";
import { canUse } from "../src/lib/plans";

const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002",
  viewer = "00000000-0000-4000-8000-000000000003";
const capture = captureSchema.parse({
  library_id: "123456789",
  advertiser: "Anunciante",
  copy: "Conheça o produto",
  activity: "active",
  days_active: 14,
});
test("mining payloads: optional page/media, unsafe URLs, filters, monitor selection and structured AI", () => {
  assert.equal(canUse("devedor", "mining"), false);
  assert.equal(canUse("liso", "mining"), true);
  assert.equal(canUse("vorcaro", "mining"), true);
  assert.equal(capture.page_id, null);
  assert.deepEqual(capture.media, []);
  for (const value of [
    "javascript:alert(1)",
    "http://example.com",
    "https://127.0.0.1/x",
    "https://169.254.169.254/",
    "https://user:pass@example.com",
    "https://[::1]",
    "https://host.local",
  ])
    assert.equal(publicUrl(value), false, value);
  assert.equal(
    captureSchema.safeParse({ ...capture, workspace_id: a }).success,
    false,
  );
  assert.equal(
    captureSchema.safeParse({ ...capture, library_id: "" }).success,
    false,
  );
  assert.equal(
    captureSchema.safeParse({ ...capture, landing_url: "javascript:alert(1)" })
      .success,
    false,
  );
  assert.equal(
    captureSchema.safeParse({ ...capture, start_date: "2099-01-01" }).success,
    false,
  );
  assert.equal(
    filtersSchema.parse({
      workspace: a,
      min_days: "10",
      format: "video",
      tag: "teste",
      sort: "days",
    }).min_days,
    10,
  );
  assert.equal(
    filtersSchema.safeParse({ workspace: a, sort: "capture);drop" }).success,
    false,
  );
  assert.equal(updateSchema.safeParse({ workspace_id: b }).success, false);
  assert.equal(monitorSchema.safeParse({ label: "Teste" }).success, false);
  assert.equal(
    monitorSchema.safeParse({ label: "Teste", offer_id: a, page_id: "123" })
      .success,
    false,
  );
  assert.equal(
    analysisSchema.safeParse({ summary: "Sem estrutura" }).success,
    false,
  );
  const finding = { text: "Não identificado", basis: "unavailable" };
  const analysis = Object.fromEntries(
    [
      "summary",
      "angle",
      "hook",
      "promise",
      "mechanism",
      "audience",
      "awareness",
      "proof",
      "cta",
      "copy_structure",
    ].map((k) => [k, finding]),
  );
  assert.equal(
    analysisSchema.safeParse({
      ...analysis,
      strengths: [],
      weaknesses: [],
      longevity_hypotheses: [],
      variations: [],
      suggested_tags: [],
      confidence: 0.2,
    }).success,
    true,
  );
  assert.deepEqual(changes({ copy: "A" }, { copy: "B" }), [
    { field: "copy", before: "A", after: "B" },
  ]);
  assert.equal(
    responseText({
      output: [{ content: [{ type: "output_text", text: "Resposta" }] }],
    }),
    "Resposta",
  );
});
test("temporary grants deny expired, revoked, absent and foreign workspace credentials", () => {
  const grant = {
    workspace_id: a,
    status: "active",
    expires_at: new Date(Date.now() + 10000).toISOString(),
  };
  assert.equal(grantValid(grant, a), true);
  assert.equal(grantValid(grant, b), false);
  assert.equal(grantValid(null, a), false);
  assert.equal(grantValid({ ...grant, status: "revoked" }, a), false);
  assert.equal(grantValid({ ...grant, expires_at: "2000-01-01" }, a), false);
});
test("mining migration: workspace RLS, duplicate capture, snapshots, pause, page discovery and one-use authorization", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;`);
    for (const path of [
      "20260906021328_utmliso_mvp.sql",
      "20260909115011_mining_library.sql",
    ])
      await db.exec(readFileSync(`supabase/migrations/${path}`, "utf8"));
    await db.query("insert into auth.users values($1),($2),($3)", [
      a,
      b,
      viewer,
    ]);
    const wa = (
      await db.query<{ id: string }>(
        "select public.utm_create_workspace($1,'A workspace','UTC') id",
        [a],
      )
    ).rows[0].id;
    const wb = (
      await db.query<{ id: string }>(
        "select public.utm_create_workspace($1,'B workspace','UTC') id",
        [b],
      )
    ).rows[0].id;
    await db.query("update public.utm_workspaces set plan='liso' where id=$1", [
      wa,
    ]);
    await db.query("insert into public.utm_members values($1,$2,'viewer')", [
      wa,
      viewer,
    ]);
    const save = async (w: string, c = capture, snapshot = false) =>
      (
        await db.query<{
          value: { offer: { id: string }; duplicate: boolean };
        }>("select public.utm_mining_capture($1,$2,$3) value", [
          w,
          JSON.stringify(c),
          snapshot,
        ])
      ).rows[0].value;
    await db.exec("set role service_role");
    const first = await save(wa);
    assert.equal(first.duplicate, false);
    assert.equal((await save(wa)).duplicate, true);
    const second = await save(wb);
    assert.notEqual(first.offer.id, second.offer.id);
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
    await db.exec("set role authenticated");
    assert.equal(
      (await db.query("select * from public.utm_mined_offers")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.utm_mining_snapshots")).rows.length,
      1,
    );
    await assert.rejects(() =>
      db.query(
        "update public.utm_mined_offers set workspace_id=$1 where id=$2",
        [wb, first.offer.id],
      ),
    );
    await assert.rejects(() =>
      db.query(
        "insert into public.utm_mined_offers(workspace_id,library_id,advertiser,library_url,capture) values($1,'999999','X','https://example.com','{}')",
        [wb],
      ),
    );
    assert.equal(
      (
        await db.query(
          "delete from public.utm_mined_offers where id=$1 returning id",
          [second.offer.id],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(() =>
      db.query("select * from public.utm_extension_grants"),
    );
    await assert.rejects(() => save(wa));
    await assert.rejects(() =>
      db.query("select public.utm_extension_redeem('x','y')"),
    );
    await assert.rejects(() =>
      db.query(
        "insert into public.utm_mining_monitors(workspace_id,offer_id,label) values($1,$2,'Escape')",
        [wa, second.offer.id],
      ),
    );
    const mon = (
      await db.query<{ id: string }>(
        "insert into public.utm_mining_monitors(workspace_id,offer_id,label) values($1,$2,'Oferta A') returning id",
        [wa, first.offer.id],
      )
    ).rows[0].id;
    await db.exec("reset role;set role service_role");
    await save(
      wa,
      { ...capture, copy: "Nova copy", activity: "inactive" },
      true,
    );
    assert.equal(
      (await db.query("select * from public.utm_mining_changes")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.utm_mining_runs")).rows.length,
      1,
    );
    await db.query(
      "update public.utm_mining_monitors set status='paused' where id=$1",
      [mon],
    );
    await assert.rejects(() =>
      save(wa, { ...capture, copy: "Não salvar" }, true),
    );
    assert.equal(
      (
        await db.query(
          "select * from public.utm_mining_snapshots where workspace_id=$1",
          [wa],
        )
      ).rows.length,
      2,
    );
    await db.query(
      "update public.utm_mining_monitors set status='active' where id=$1",
      [mon],
    );
    await save(wa, { ...capture, copy: "Reativada" }, true);
    await db.query(
      "insert into public.utm_mining_monitors(workspace_id,page_id,label) values($1,'555','Página')",
      [wa],
    );
    await save(wa, { ...capture, library_id: "7777777", page_id: "555" }, true);
    assert.equal(
      (
        await db.query(
          "select * from public.utm_mined_offers where workspace_id=$1",
          [wa],
        )
      ).rows.length,
      2,
    );
    await db.query("select public.utm_mining_failure($1,$2,'capture_failed')", [
      wa,
      mon,
    ]);
    assert.equal(
      (
        await db.query<{ last_error: string }>(
          "select last_error from public.utm_mining_monitors where id=$1",
          [mon],
        )
      ).rows[0].last_error,
      "capture_failed",
    );
    await assert.rejects(() =>
      db.query("select public.utm_mining_failure($1,$2,'capture_failed')", [
        wb,
        mon,
      ]),
    );
    await db.query(
      "insert into public.utm_mining_analyses(workspace_id,offer_id,status,result,input_capture,model) values($1,$2,'completed','{}',$3,'test-model')",
      [wa, first.offer.id, JSON.stringify(capture)],
    );
    await assert.rejects(() =>
      db.query(
        "insert into public.utm_mining_analyses(workspace_id,offer_id,status,input_capture,model) values($1,$2,'running','{}','test')",
        [wb, first.offer.id],
      ),
    );
    await db.query(
      "update public.utm_mined_offers set tags=array['educacao'],niche='Cursos' where id=$1",
      [first.offer.id],
    );
    const ch = "a".repeat(64),
      token = "b".repeat(64);
    await db.query(
      "insert into public.utm_extension_grants(workspace_id,user_id,challenge) values($1,$2,$3)",
      [wa, a, ch],
    );
    const redeem = async (c: string) =>
      (
        await db.query<{ value: unknown }>(
          "select public.utm_extension_redeem($1,$2) value",
          [c, token],
        )
      ).rows[0].value;
    assert.ok(await redeem(ch));
    assert.equal(await redeem(ch), null);
    await db.query(
      "insert into public.utm_extension_grants(workspace_id,user_id,challenge) values($1,$2,$3)",
      [wb, b, "f".repeat(64)],
    );
    assert.equal(await redeem("f".repeat(64)), null);
    for (const [challenge, status, expiry] of [
      ["c".repeat(64), "pending", "2000-01-01"],
      ["d".repeat(64), "revoked", "2099-01-01"],
    ]) {
      await db.query(
        "insert into public.utm_extension_grants(workspace_id,user_id,challenge,status,expires_at) values($1,$2,$3,$4,$5)",
        [wa, a, challenge, status, expiry],
      );
      assert.equal(await redeem(challenge), null);
    }
    await db.query(
      "insert into public.utm_extension_grants(workspace_id,user_id,challenge) values($1,$2,$3)",
      [wa, viewer, "e".repeat(64)],
    );
    assert.equal(await redeem("e".repeat(64)), null);
    // Derived history is read-only; all new workspace relations deny the other tenant.
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
    await db.exec("set role authenticated");
    for (const table of [
      "utm_mining_monitors",
      "utm_mining_changes",
      "utm_mining_runs",
      "utm_mining_analyses",
    ])
      assert.equal(
        (
          await db.query(
            `select * from public.${table} where workspace_id=$1`,
            [wa],
          )
        ).rows.length,
        0,
      );
    await assert.rejects(() =>
      db.query(
        "insert into public.utm_mining_snapshots(workspace_id,offer_id,capture) values($1,$2,'{}')",
        [wa, first.offer.id],
      ),
    );
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      viewer,
    ]);
    await db.exec("set role authenticated");
    assert.equal(
      (
        await db.query(
          "update public.utm_mined_offers set notes='viewer write' returning id",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select * from public.utm_mined_offers where workspace_id=$1 and tags @> array['educacao'] and days_active >= 10 and niche ilike '%curso%'",
          [wa],
        )
      ).rows.length,
      1,
    );
    await assert.rejects(() =>
      db.query(
        "insert into public.utm_mining_monitors(workspace_id,page_id,label) values($1,'666','Viewer')",
        [wa],
      ),
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(() =>
      db.query("select * from public.utm_mined_offers"),
    );
  } finally {
    await db.close();
  }
});

test("extension parser: visible DOM only, dates, redirects and missing fields", () => {
  const context: Record<string, unknown> = {
    URL,
    Date,
    getComputedStyle: () => ({ visibility: "visible" }),
  };
  runInNewContext(readFileSync("extension/parser.js", "utf8"), context);
  const parser = context.TrackbaseParser as {
    idFromText: (s: string) => string;
    safeUrl: (s: string) => string | null;
    destination: (s: string) => string | null;
    startDate: (s: string) => string | null;
    capture: (c: unknown) => {
      page_id: string | null;
      media: unknown[];
      library_id: string;
    };
  };
  assert.equal(parser.idFromText("ID da biblioteca: 123456789"), "123456789");
  assert.equal(parser.safeUrl("blob:https://facebook.com/123"), null);
  assert.equal(
    parser.destination(
      "https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com",
    ),
    "https://example.com/",
  );
  assert.equal(
    parser.startDate("Veiculação iniciada em 1 de set de 2025"),
    "2025-09-01",
  );
  assert.equal(
    parser.startDate("Veiculação iniciada em 31 de fev de 2025"),
    null,
  );
  const page = {
    href: "https://www.facebook.com/advertiser",
    innerText: "Anunciante",
    getClientRects: () => [1],
  };
  const card = {
    innerText: "ID da biblioteca: 123456789\nAtivo",
    querySelectorAll: (s: string) => (s === "a[href]" ? [page] : []),
  };
  const parsed = parser.capture(card);
  assert.equal(parsed.page_id, null);
  assert.equal(parsed.media.length, 0);
  assert.throws(() => parser.capture({ ...card, innerText: "Sem ID" }));
});
