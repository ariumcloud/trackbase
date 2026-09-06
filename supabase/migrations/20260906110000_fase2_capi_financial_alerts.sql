-- UTMLiso Migration 20260906110000: Fase 2 — CAPI, Métricas Financeiras e Alertas

-- 1. Evolução de utm_sales para suportar produtos adicionais e taxas
alter table public.utm_sales add column if not exists product_type text not null default 'main' check(product_type in ('main', 'order_bump', 'upsell', 'downsell'));
alter table public.utm_sales add column if not exists parent_transaction_id text;
alter table public.utm_sales add column if not exists gross_amount numeric(20,6) not null default 0;
alter table public.utm_sales add column if not exists fee_amount numeric(20,6) not null default 0;
alter table public.utm_sales add column if not exists net_amount numeric(20,6) not null default 0;

update public.utm_sales
   set gross_amount = amount,
       net_amount = amount
 where gross_amount = 0 and amount > 0;

-- Substituição segura da constraint de unicidade de vendas por produto
alter table public.utm_sales drop constraint if exists utm_sales_integration_id_transaction_id_is_test_key;
alter table public.utm_sales drop constraint if exists utm_sales_product_unique;
alter table public.utm_sales add constraint utm_sales_product_unique unique(integration_id, transaction_id, product_type, is_test);

create index if not exists utm_sales_buyer_idx on public.utm_sales(workspace_id, coalesce(parent_transaction_id, transaction_id));
create index if not exists utm_sales_product_type_idx on public.utm_sales(workspace_id, product_type);

-- 2. Tabela de Pixels Meta com FK Composta (workspace_id, offer_id)
create table if not exists public.utm_pixels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id),
  offer_id uuid,
  pixel_id text not null,
  capi_token_ciphertext text not null,
  test_event_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key(workspace_id, offer_id) references public.utm_offers(workspace_id, id)
);

create unique index if not exists utm_pixels_workspace_pixel_offer_idx on public.utm_pixels(workspace_id, pixel_id, coalesce(offer_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists utm_pixels_workspace_idx on public.utm_pixels(workspace_id);

alter table public.utm_pixels enable row level security;
revoke all on public.utm_pixels from anon, authenticated;
grant all on public.utm_pixels to service_role;
grant select, insert, update, delete on public.utm_pixels to authenticated;

create policy member_read on public.utm_pixels for select to authenticated using (utm_private.member(workspace_id));
create policy member_insert on public.utm_pixels for insert to authenticated with check (utm_private.member(workspace_id, true));
create policy member_update on public.utm_pixels for update to authenticated using (utm_private.member(workspace_id, true)) with check (utm_private.member(workspace_id, true));
create policy member_delete on public.utm_pixels for delete to authenticated using (utm_private.member(workspace_id, true));

-- 3. Histórico de Envios CAPI (sem tokens, com event_id de deduplicação)
create table if not exists public.utm_capi_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id),
  pixel_id text not null,
  event_id text not null,
  event_name text not null,
  status text not null check(status in ('sent', 'failed', 'skipped', 'duplicate')),
  http_code integer,
  response_summary text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists utm_capi_logs_dedup_idx on public.utm_capi_logs(workspace_id, pixel_id, event_id, event_name);
create index if not exists utm_capi_logs_workspace_idx on public.utm_capi_logs(workspace_id, created_at);

alter table public.utm_capi_logs enable row level security;
revoke all on public.utm_capi_logs from anon, authenticated;
grant all on public.utm_capi_logs to service_role;
grant select on public.utm_capi_logs to authenticated;
create policy member_read on public.utm_capi_logs for select to authenticated using (utm_private.member(workspace_id));

-- 4. Alertas Inteligentes: Regras e Alertas com FK Composta
create table if not exists public.utm_alert_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id),
  offer_id uuid,
  rule_type text not null,
  threshold numeric not null,
  window_days integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key(workspace_id, offer_id) references public.utm_offers(workspace_id, id)
);

create unique index if not exists utm_alert_rules_uniq on public.utm_alert_rules(workspace_id, rule_type, coalesce(offer_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists utm_alert_rules_workspace_idx on public.utm_alert_rules(workspace_id);

alter table public.utm_alert_rules enable row level security;
revoke all on public.utm_alert_rules from anon, authenticated;
grant all on public.utm_alert_rules to service_role;
grant select, insert, update, delete on public.utm_alert_rules to authenticated;

create policy member_read on public.utm_alert_rules for select to authenticated using (utm_private.member(workspace_id));
create policy member_insert on public.utm_alert_rules for insert to authenticated with check (utm_private.member(workspace_id, true));
create policy member_update on public.utm_alert_rules for update to authenticated using (utm_private.member(workspace_id, true)) with check (utm_private.member(workspace_id, true));
create policy member_delete on public.utm_alert_rules for delete to authenticated using (utm_private.member(workspace_id, true));

create table if not exists public.utm_alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id),
  offer_id uuid,
  rule_type text not null,
  severity text not null check(severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  message text not null,
  evidence jsonb not null default '{}',
  link text,
  read boolean not null default false,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  foreign key(workspace_id, offer_id) references public.utm_offers(workspace_id, id)
);

create unique index if not exists utm_alerts_fingerprint_idx on public.utm_alerts(workspace_id, fingerprint);
create index if not exists utm_alerts_workspace_read_idx on public.utm_alerts(workspace_id, read, created_at);

alter table public.utm_alerts enable row level security;
revoke all on public.utm_alerts from anon, authenticated;
grant all on public.utm_alerts to service_role;
grant select, update on public.utm_alerts to authenticated;

create policy member_read on public.utm_alerts for select to authenticated using (utm_private.member(workspace_id));
create policy member_update on public.utm_alerts for update to authenticated using (utm_private.member(workspace_id, true)) with check (utm_private.member(workspace_id, true));

-- 5. Atualização de utm_process_payment para suportar produtos adicionais e taxas
create or replace function public.utm_process_payment(p_integration uuid, p_payment jsonb)
returns text language plpgsql set search_path='' as $$
declare
  i public.utm_integrations;
  log_id uuid;
  v_prod_type text;
  v_gross numeric;
  v_fee numeric;
  v_net numeric;
begin
  select * into strict i from public.utm_integrations where id=p_integration and provider in ('hotmart','cakto') for update;
  if p_payment->>'product_id' is distinct from i.external_product_id or (i.external_offer_id is not null and p_payment->>'external_offer_id' is distinct from i.external_offer_id) then
    raise exception 'Product mismatch';
  end if;

  insert into public.utm_webhook_logs(workspace_id,integration_id,event_id,status,payment,is_test)
  values(i.workspace_id,i.id,p_payment->>'event_id','received',p_payment,(p_payment->>'is_test')::boolean)
  on conflict(integration_id,event_id) do nothing returning id into log_id;

  if log_id is null then
    select id into log_id from public.utm_webhook_logs where integration_id=i.id and event_id=p_payment->>'event_id' and status='received' for update;
    if log_id is null then return 'duplicate'; end if;
  end if;

  v_prod_type := coalesce(p_payment->>'product_type', 'main');
  v_gross := coalesce((p_payment->>'gross_amount')::numeric, (p_payment->>'amount')::numeric, 0);
  v_fee := coalesce((p_payment->>'fee_amount')::numeric, 0);
  v_net := coalesce((p_payment->>'net_amount')::numeric, v_gross - v_fee);

  insert into public.utm_sales(
    workspace_id, integration_id, offer_id, transaction_id, provider, status,
    amount, currency, country, attribution, occurred_at, is_test,
    product_type, parent_transaction_id, gross_amount, fee_amount, net_amount
  )
  values(
    i.workspace_id, i.id, i.offer_id, p_payment->>'transaction_id', i.provider, p_payment->>'status',
    v_gross, p_payment->>'currency', p_payment->>'country', p_payment->'attribution', (p_payment->>'occurred_at')::timestamptz, (p_payment->>'is_test')::boolean,
    v_prod_type, p_payment->>'parent_transaction_id', v_gross, v_fee, v_net
  )
  on conflict(integration_id, transaction_id, product_type, is_test) do update set
    status = excluded.status,
    amount = excluded.amount,
    gross_amount = excluded.gross_amount,
    fee_amount = excluded.fee_amount,
    net_amount = excluded.net_amount,
    currency = excluded.currency,
    country = excluded.country,
    attribution = excluded.attribution,
    occurred_at = excluded.occurred_at,
    parent_transaction_id = excluded.parent_transaction_id
  where excluded.occurred_at > utm_sales.occurred_at
     or (excluded.occurred_at = utm_sales.occurred_at and excluded.status in ('refunded','chargeback','canceled'));

  update public.utm_webhook_logs set status='processed' where id=log_id;
  update public.utm_integrations set status='connected' where id=i.id;
  return 'processed';
end;
$$;

-- 6. Atualização de utm_dashboard_summary com compradores únicos e detalhamentos
create or replace function public.utm_dashboard_summary(
  p_workspace uuid,
  p_since timestamptz,
  p_until timestamptz,
  p_currency text,
  p_offer_id uuid default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_approved_count bigint := 0;
  v_unique_buyers bigint := 0;
  v_gross_revenue numeric := 0;
  v_platform_fees numeric := 0;
  v_net_revenue numeric := 0;
  v_operating_profit numeric := null;
  v_refunded_count bigint := 0;
  v_refunded_amount numeric := 0;
  v_meta_spend numeric := 0;
  v_meta_clicks bigint := 0;
  v_meta_impressions bigint := 0;
  v_pageviews bigint := 0;
  v_ctas bigint := 0;
  v_checkouts bigint := 0;
  v_by_product jsonb := '{}'::jsonb;
  v_by_country jsonb := '{}'::jsonb;
begin
  if auth.uid() is not null and not utm_private.member(p_workspace) then
    raise exception 'Workspace não autorizado';
  end if;

  -- 1. Vendas aprovadas com contagem de clientes únicos por transaction_id / parent_transaction_id
  select
    coalesce(count(*), 0),
    coalesce(count(distinct coalesce(parent_transaction_id, transaction_id)), 0),
    coalesce(sum(gross_amount), sum(amount), 0),
    coalesce(sum(fee_amount), 0),
    coalesce(sum(net_amount), sum(amount), 0)
    into v_approved_count, v_unique_buyers, v_gross_revenue, v_platform_fees, v_net_revenue
    from public.utm_sales
   where workspace_id = p_workspace
     and is_test = false
     and status = 'approved'
     and currency = p_currency
     and occurred_at >= p_since and occurred_at <= p_until
     and (p_offer_id is null or offer_id = p_offer_id);

  -- 2. Reembolsos / Chargebacks
  select coalesce(count(*), 0), coalesce(sum(gross_amount), sum(amount), 0)
    into v_refunded_count, v_refunded_amount
    from public.utm_sales
   where workspace_id = p_workspace
     and is_test = false
     and status in ('refunded', 'chargeback')
     and currency = p_currency
     and occurred_at >= p_since and occurred_at <= p_until
     and (p_offer_id is null or offer_id = p_offer_id);

  -- 3. Detalhamento por tipo de produto
  select coalesce(
    jsonb_object_agg(
      sub.product_type,
      jsonb_build_object('count', sub.cnt, 'revenue', sub.total)
    ),
    '{}'::jsonb
  )
    into v_by_product
    from (
      select
        product_type,
        count(*) as cnt,
        coalesce(sum(gross_amount), sum(amount), 0) as total
        from public.utm_sales
       where workspace_id = p_workspace
         and is_test = false
         and status = 'approved'
         and currency = p_currency
         and occurred_at >= p_since and occurred_at <= p_until
         and (p_offer_id is null or offer_id = p_offer_id)
       group by product_type
    ) sub;

  -- 4. Detalhamento por país
  select coalesce(
    jsonb_object_agg(
      sub.country,
      jsonb_build_object('count', sub.cnt, 'revenue', sub.total)
    ),
    '{}'::jsonb
  )
    into v_by_country
    from (
      select
        coalesce(country, 'N/A') as country,
        count(*) as cnt,
        coalesce(sum(gross_amount), sum(amount), 0) as total
        from public.utm_sales
       where workspace_id = p_workspace
         and is_test = false
         and status = 'approved'
         and currency = p_currency
         and occurred_at >= p_since and occurred_at <= p_until
         and (p_offer_id is null or offer_id = p_offer_id)
       group by country
       order by total desc
       limit 10
    ) sub;

  -- 5. Insights Meta (Gasto geral do workspace quando p_offer_id é null)
  if p_offer_id is null then
    select coalesce(sum(spend), 0), coalesce(sum(clicks), 0), coalesce(sum(impressions), 0)
      into v_meta_spend, v_meta_clicks, v_meta_impressions
      from public.utm_insights
     where workspace_id = p_workspace
       and currency = p_currency
       and day >= (p_since at time zone 'UTC')::date
       and day <= (p_until at time zone 'UTC')::date;

    v_operating_profit := v_net_revenue - v_meta_spend;
  else
    v_meta_spend := null;
    v_meta_clicks := 0;
    v_meta_impressions := 0;
    v_operating_profit := null;
  end if;

  -- 6. Eventos do funil
  select
    coalesce(count(*) filter (where event_type = 'pageview'), 0),
    coalesce(count(*) filter (where event_type = 'cta'), 0),
    coalesce(count(*) filter (where event_type = 'checkout'), 0)
    into v_pageviews, v_ctas, v_checkouts
    from public.utm_events
   where workspace_id = p_workspace
     and created_at >= p_since and created_at <= p_until
     and (p_offer_id is null or offer_id = p_offer_id);

  return jsonb_build_object(
    'sales_count', v_approved_count,
    'unique_buyers', v_unique_buyers,
    'gross_revenue', v_gross_revenue,
    'platform_fees', v_platform_fees,
    'net_revenue', v_net_revenue,
    'operating_profit', v_operating_profit,
    'refunded_count', v_refunded_count,
    'refunded_amount', v_refunded_amount,
    'meta_spend', v_meta_spend,
    'meta_clicks', v_meta_clicks,
    'meta_impressions', v_meta_impressions,
    'pageviews', v_pageviews,
    'ctas', v_ctas,
    'checkouts', v_checkouts,
    'by_product_type', v_by_product,
    'by_country', v_by_country
  );
end;
$$;
