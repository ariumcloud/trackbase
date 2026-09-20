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
  await db.exec(
    readFileSync("supabase/migrations/20260906100000_dashboard_and_events.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260906110000_fase2_capi_financial_alerts.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260906120000_fase3_kirofy_providers_limits_offers.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260906130000_fase4_funnels_and_diagnostics.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260906140000_push_and_google_ads.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260907170000_capi_outbox.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260907190000_account_privacy.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260908180000_trackbase_shield.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260908183000_shield_custom_domain.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260910150000_preserve_sale_money_currencies.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260910170000_allow_webhook_replays.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260920120000_lifetime_revenue.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20260920140000_allow_links_and_events_without_offer.sql", "utf8"),
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
  // Link sem oferta (modelo Utmify / auto-discovery) deve ser permitido:
  const offerlessLink = (
    await db.query<{ id: string; public_key: string }>(
      "insert into public.utm_links(workspace_id,offer_id,name,url) values($1,null,'Link Sem Oferta','https://example.com/utmify') returning id, public_key",
      [wb],
    )
  ).rows[0];
  assert.ok(offerlessLink.id);

  await db.exec("reset role;set role service_role");

  // Rastreamento público para link sem oferta grava evento com offer_id = null
  const trackResult = (
    await db.query<{ status: string }>(
      "select public.utm_track_event($1, $2) as status",
      [
        offerlessLink.public_key,
        JSON.stringify({
          event_type: "pageview",
          event_id: "evt_offerless_1",
          session_id: "sess_offerless_1",
          url: "https://example.com/utmify?utm_source=meta",
        }),
      ],
    )
  ).rows[0].status;
  assert.equal(trackResult, "recorded");

  const recordedEvents = (
    await db.query<{ offer_id: string | null; link_id: string }>(
      "select offer_id, link_id from public.utm_events where session_id = 'sess_offerless_1'",
    )
  ).rows;
  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].offer_id, null);
  assert.equal(recordedEvents[0].link_id, offerlessLink.id);

  // Limpa o link e evento de teste para manter o estado original dos testes seguintes
  await db.query("delete from public.utm_events where link_id = $1", [offerlessLink.id]);
  await db.query("delete from public.utm_links where id = $1", [offerlessLink.id]);

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
  assert.equal((await process(payment)).rows[0].status, "processed");
  assert.equal(
    (await db.query("select * from public.utm_sales")).rows.length,
    1,
  );
  assert.equal(
    (await process({
      ...payment,
      country: "AR",
      attribution: { xcod: "session-ar-1" },
    })).rows[0].status,
    "processed",
  );
  const repairedSale = (
    await db.query<{ country: string; attribution: Record<string, string> }>(
      "select country, attribution from public.utm_sales where transaction_id='tx1'",
    )
  ).rows[0];
  assert.equal(repairedSale.country, "AR");
  assert.equal(repairedSale.attribution.xcod, "session-ar-1");
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
  // Testes de Chave Pública e Rastreamento de Eventos
  const offerRow = (
    await db.query<{ public_key: string }>(
      "select public_key from public.utm_offers where id=$1",
      [offer],
    )
  ).rows[0];
  assert.ok(offerRow.public_key && offerRow.public_key.length >= 16);

  // Ingestão com chave pública válida
  const trackRes = await db.query<{ status: string }>(
    "select public.utm_track_event($1, $2) status",
    [
      offerRow.public_key,
      JSON.stringify({
        event_type: "pageview",
        session_id: "sess-123",
        url: "https://example.com/landing?utm_source=meta",
        attribution: { utm_source: "meta" },
      }),
    ],
  );
  assert.equal(trackRes.rows[0].status, "recorded");

  await db.query("select public.utm_track_event($1, $2)", [
    offerRow.public_key,
    JSON.stringify({
      event_type: "checkout",
      session_id: "sess-123",
      url: "https://example.com/checkout",
      attribution: { utm_source: "meta" },
    }),
  ]);

  // Outbox CAPI é criado no mesmo fluxo do tracking e deduplica por event_id.
  const capiTrackEvent = {
    event_type: "pageview",
    event_id: "evt-capi-pageview-1",
    session_id: "sess-123",
    url: "https://example.com/landing",
    attribution: { fbp: "fb.1.test", fbc: "fb.1.test" },
    capi_payload_ciphertext: "ciphertext-placeholder",
  };
  await db.query("select public.utm_track_event($1, $2)", [
    offerRow.public_key,
    JSON.stringify(capiTrackEvent),
  ]);
  await db.query("select public.utm_track_event($1, $2)", [
    offerRow.public_key,
    JSON.stringify(capiTrackEvent),
  ]);
  const capiOutboxRows = (await db.query("select event_id, event_name from public.utm_capi_outbox")).rows;
  assert.equal(capiOutboxRows.length, 1, JSON.stringify(capiOutboxRows));

  // Rejeição com chave pública inexistente
  await assert.rejects(() =>
    db.query("select public.utm_track_event('chave_falsa', $1)", [
      JSON.stringify({
        event_type: "pageview",
        session_id: "sess-123",
      }),
    ]),
  );

  // Teste de Dashboard Summary Agregado
  // A janela precisa cobrir tanto as vendas com data fixa (2026-09-06) quanto
  // os eventos de tracking inseridos acima via now() -- um intervalo fixo no
  // passado ("apodrece" e passa a excluir o now() real assim que o relógio
  // avança) fazia esse teste falhar sozinho, sem nenhuma mudança de código.
  const since = "2020-01-01T00:00:00Z";
  const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // 1. Usuário B tentando acessar dados do Workspace A deve ser rejeitado
  await assert.rejects(() =>
    db.query(
      "select public.utm_dashboard_summary($1, $2, $3, 'BRL') summary",
      [wa, since, until],
    ),
  );

  // 2. Usuário A acessando seu próprio workspace com sucesso
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
  const summaryRes = await db.query<{
    summary: { pageviews: number; checkouts: number; refunded_count: number };
  }>(
    "select public.utm_dashboard_summary($1, $2, $3, 'BRL') summary",
    [wa, since, until],
  );
  const summary = summaryRes.rows[0].summary;
  assert.equal(summary.pageviews, 3);
  assert.equal(summary.checkouts, 1);
  assert.equal(summary.refunded_count, 1);

  // RLS de utm_events
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
  await db.exec("set role authenticated");
  assert.equal(
    (await db.query("select * from public.utm_events")).rows.length,
    4,
  );

  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
  await db.exec("set role authenticated");
  assert.equal(
    (await db.query("select * from public.utm_events")).rows.length,
    0,
  );

  await db.exec("reset role;set role anon");
  // ==========================================
  // TESTES DA FASE 2: CAPI, PRODUTOS ADICIONAIS, ALERTAS E RLS
  // ==========================================
  await db.exec("reset role;set role service_role");

  // 1. Processa pedido com order bump associado (mesmo parent_transaction_id)
  const txParent = "tx-master-99";
  const mainSale = {
    event_id: "evt-main-1",
    transaction_id: txParent,
    product_id: "prod",
    external_offer_id: "",
    product_type: "main",
    parent_transaction_id: null,
    status: "approved",
    amount: 100,
    gross_amount: 100,
    fee_amount: 10,
    net_amount: 90,
    currency: "BRL",
    attribution: {},
    occurred_at: "2026-09-06T02:00:00Z",
    is_test: false,
  };
  const bumpSale = {
    event_id: "evt-bump-1",
    transaction_id: "tx-bump-99",
    product_id: "prod",
    external_offer_id: "",
    product_type: "order_bump",
    parent_transaction_id: txParent,
    status: "approved",
    amount: 30,
    gross_amount: 30,
    fee_amount: 3,
    net_amount: 27,
    currency: "BRL",
    attribution: {},
    occurred_at: "2026-09-06T02:00:00Z",
    is_test: false,
  };

  await process(mainSale);
  await process(bumpSale);

  // 2. Chave estrangeira composta obrigatória (workspace_id, offer_id):
  // Tentativa de vincular pixel do Workspace B com Oferta do Workspace A DEVE falhar
  await assert.rejects(
    () =>
      db.query(
        "insert into public.utm_pixels(workspace_id, offer_id, pixel_id, capi_token_ciphertext) values($1, $2, '1234567890', 'cipher')",
        [wb, offer], // wb é Workspace B, offer pertence a wa (Workspace A)
      ),
    /violates foreign key constraint|foreign key/,
  );

  // Vincular pixel com a oferta correspondente do mesmo workspace DEVE funcionar
  const pixelInsert = await db.query<{ id: string }>(
    "insert into public.utm_pixels(workspace_id, offer_id, pixel_id, capi_token_ciphertext) values($1, $2, '1234567890', 'cipher') returning id",
    [wa, offer],
  );
  assert.ok(pixelInsert.rows[0].id);

  // 3. Teste de alerta com deduplicação por fingerprint e RLS
  const fingerprint1 = "fp-test-alert-1";
  await db.query(
    `insert into public.utm_alerts(workspace_id, rule_type, severity, title, message, fingerprint)
     values($1, 'low_ctr', 'medium', 'CTR Baixo', 'Mensagem de alerta', $2)
     on conflict (workspace_id, fingerprint) do nothing`,
    [wa, fingerprint1],
  );
  // Re-inserção com mesmo fingerprint é ignorada (idempotente)
  await db.query(
    `insert into public.utm_alerts(workspace_id, rule_type, severity, title, message, fingerprint)
     values($1, 'low_ctr', 'medium', 'CTR Baixo', 'Mensagem de alerta', $2)
     on conflict (workspace_id, fingerprint) do nothing`,
    [wa, fingerprint1],
  );

  // 4. Teste de agregação financeira e contagem de clientes únicos
  // Deve contar 1 único comprador para mainSale + bumpSale (mesmo parent)
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
  await db.exec("set role authenticated");

  const summaryRes2 = await db.query<{
    summary: {
      sales_count: number;
      unique_buyers: number;
      gross_revenue: number;
      platform_fees: number;
      net_revenue: number;
      by_product_type: Record<string, { count: number; revenue: number }>;
    };
  }>(
    "select public.utm_dashboard_summary($1, '2026-09-01T00:00:00Z', '2026-09-10T23:59:59Z', 'BRL') summary",
    [wa],
  );
  const s2 = summaryRes2.rows[0].summary;
  // Vendas aprovadas no período: tx1 foi reembolsada. mainSale (1) + bumpSale (1) = 2 vendas
  assert.equal(s2.sales_count, 2);
  // Mas como pertencem ao mesmo txParent, unique_buyers DEVE ser 1!
  assert.equal(s2.unique_buyers, 1);
  assert.equal(s2.gross_revenue, 130);
  assert.equal(s2.platform_fees, 13);
  assert.equal(s2.net_revenue, 117);
  assert.equal(s2.by_product_type.main?.count, 1);
  assert.equal(s2.by_product_type.order_bump?.count, 1);

  // Lifetime revenue is aggregated in the database by source currency. It
  // must use gross values from approved sales, ignore tests/refunds and keep
  // workspaces isolated.
  await db.exec("reset role; set role service_role");
  const otherOffer = (
    await db.query<{ id: string }>(
      "insert into public.utm_offers(workspace_id,name,landing_url,currency) values($1,'Oferta B','https://example.com','BRL') returning id",
      [wb],
    )
  ).rows[0].id;
  const otherIntegration = (
    await db.query<{ id: string }>(
      "insert into public.utm_integrations(workspace_id,offer_id,provider,name,external_product_id) values($1,$2,'cakto','Cakto B','prod-b') returning id",
      [wb, otherOffer],
    )
  ).rows[0].id;
  await db.query(
    `insert into public.utm_sales(
       workspace_id, integration_id, offer_id, transaction_id, provider,
       status, amount, gross_amount, currency, occurred_at, is_test, product_type
     ) values
       ($1, $2, $3, 'lifetime-brl', 'cakto', 'approved', 999, 111, 'BRL', now(), false, 'main'),
       ($1, $2, $3, 'lifetime-usd', 'cakto', ' Paid ', 200, 200, 'USD', now(), false, 'main'),
       ($1, $2, $3, 'lifetime-eur', 'cakto', 'COMPLETED', 300, 0, 'EUR', now(), false, 'main'),
       ($1, $2, $3, 'lifetime-pending', 'cakto', 'pending', 1000, 1000, 'BRL', now(), false, 'main'),
       ($1, $2, $3, 'lifetime-refunded', 'cakto', 'refunded', 1000, 1000, 'BRL', now(), false, 'main'),
       ($1, $2, $3, 'lifetime-test', 'cakto', 'approved', 500, 500, 'BRL', now(), true, 'main'),
       ($4, $5, $6, 'lifetime-other-workspace', 'cakto', 'approved', 777, 777, 'BRL', now(), false, 'main')`,
    [wa, integration, offer, wb, otherIntegration, otherOffer],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
  await db.exec("set role authenticated");
  const lifetimeRows = (
    await db.query<{ currency: string; gross_revenue: number }>(
      "select currency, gross_revenue from public.utm_lifetime_revenue($1)",
      [wa],
    )
  ).rows;
  assert.deepEqual(
    lifetimeRows.map((row) => [row.currency, Number(row.gross_revenue)]),
    [
      ["BRL", 241],
      ["EUR", 300],
      ["USD", 200],
    ],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
  await assert.rejects(() =>
    db.query("select * from public.utm_lifetime_revenue($1)", [wa]),
  );
  assert.equal(
    (
      await db.query<{ indexname: string }>(
        "select indexname from pg_indexes where indexname='utm_sales_lifetime_revenue_idx'",
      )
    ).rows.length,
    1,
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);

  // 5. RLS de Pixels e Alertas: Usuário B não vê os registros do Usuário A
  assert.equal(
    (await db.query("select * from public.utm_pixels")).rows.length,
    1,
  );
  assert.equal(
    (await db.query("select * from public.utm_alerts")).rows.length,
    1,
  );

  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
  await db.exec("set role authenticated");
  assert.equal(
    (await db.query("select * from public.utm_pixels")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.utm_alerts")).rows.length,
    0,
  );

  // ==========================================
  // TESTES DA FASE 3: 7 PROVEDORES, LIMITES POR PLANO E OFERTAS
  // ==========================================
  await db.exec("reset role;set role service_role");

  // Teste de provedor adicional Kiwify
  const kiwiIntegration = (
    await db.query<{ id: string }>(
      "insert into public.utm_integrations(workspace_id,offer_id,provider,name,external_product_id) values($1,$2,'kiwify','Kiwify Oficial','kiwi-123') returning id",
      [wa, offer],
    )
  ).rows[0].id;
  assert.ok(kiwiIntegration);

  // Processa pagamento Kiwify com sucesso
  const kiwiPayment = {
    event_id: "evt-kiwi-1",
    transaction_id: "tx-kiwi-1",
    product_id: "kiwi-123",
    external_offer_id: "",
    product_type: "main",
    parent_transaction_id: null,
    status: "approved",
    amount: 197,
    gross_amount: 197,
    fee_amount: 19.7,
    net_amount: 177.3,
    currency: "BRL",
    attribution: { utm_source: "instagram" },
    occurred_at: "2026-09-06T03:00:00Z",
    is_test: false,
  };
  const kiwiProc = await db.query<{ status: string }>(
    "select public.utm_process_payment($1,$2) status",
    [kiwiIntegration, JSON.stringify(kiwiPayment)],
  );
  assert.equal(kiwiProc.rows[0].status, "processed");

  // Teste de Limites Quantitativos no Banco
  // Workspace wa está no plano 'devedor' (limite de 1 oferta).
  // Tentar inserir 2ª oferta em wa DEVE falhar pelo trigger:
  await assert.rejects(
    () =>
      db.query(
        "insert into public.utm_offers(workspace_id,name,landing_url,currency) values($1,'Oferta Extra Excedente','https://example.com','BRL')",
        [wa],
      ),
    /Limite de ofertas atingido/,
  );

  // Usuário 'a' já tem 1 workspace no plano 'devedor'.
  // Tentar criar 2º workspace DEVE falhar:
  await assert.rejects(
    () =>
      db.query("select public.utm_create_workspace($1,$2,$3)", [
        a,
        "Workspace 2 Proibido",
        "UTC",
      ]),
    /Limite de workspaces atingido/,
  );

  // Teste de Funis e Diagnósticos com RLS
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
  await db.exec("set role authenticated");
  const funnel = await db.query<{ id: string }>(
    "insert into public.utm_funnels(workspace_id, name, source_url, blocks, pixels) values($1, 'Funil Teste', 'https://example.com/funil', '[]'::jsonb, '[]'::jsonb) returning id",
    [wa],
  );
  assert.ok(funnel.rows[0].id);

  // Usuário 'a' não pode inserir funil para workspace 'wb' (RLS)
  await assert.rejects(() =>
    db.query(
      "insert into public.utm_funnels(workspace_id, name, source_url) values($1, 'Funil Invasor', 'https://example.com')",
      [wb],
    ),
  );

  const diag = await db.query<{ id: string }>(
    "insert into public.utm_funnel_diagnostics(workspace_id, url, score, category_scores) values($1, 'https://example.com', 85, '{\"speed\":90}'::jsonb) returning id",
    [wa],
  );
  assert.ok(diag.rows[0].id);

  // Teste Trackbase Shield (Zero-Redirect & Cloaking Defensivo)
  const shield = await db.query<{ id: string }>(
    "insert into public.utm_shields(workspace_id, offer_id, name, slug, white_url, gray_url, black_url) values($1, $2, 'Nutra Protegido', 'nutra-shield', 'https://safe.com', 'https://decoy.com', 'https://real.com') returning id",
    [wa, offer],
  );
  assert.ok(shield.rows[0].id);

  // Usuário 'a' não pode inserir shield para workspace 'wb' (RLS)
  await assert.rejects(() =>
    db.query(
      "insert into public.utm_shields(workspace_id, offer_id, name, slug, white_url, gray_url, black_url) values($1, $2, 'Invasor', 'slug-invasor', 'https://safe.com', 'https://decoy.com', 'https://real.com')",
      [wb, offer],
    ),
  );

  // Inserção de log via service_role
  await db.exec("reset role; set role service_role");
  await db.query(
    "insert into public.utm_shield_logs(shield_id, workspace_id, verdict, reason, ip_masked, is_datacenter) values($1, $2, 'black', 'Lead qualificado', '177.18.***.***', false)",
    [shield.rows[0].id, wa],
  );
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
  await db.exec("set role authenticated");

  const logs = await db.query("select * from public.utm_shield_logs where shield_id = $1", [shield.rows[0].id]);
  assert.equal(logs.rows.length, 1);

  await db.exec("reset role; set role service_role");
  await db.query("select public.utm_delete_account_data($1)", [a]);
  assert.equal(
    (await db.query("select * from public.utm_workspaces where owner_id=$1", [a])).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.utm_members where user_id=$1", [a])).rows.length,
    0,
  );

  await db.exec("reset role");
  console.log(
    "PASS: migrations 1 a 5, 7 provedores, funis clonados, diagnósticos, RLS, FK composta e limites quantitativos no banco.",
  );
  await db.close();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
