-- Kirofy: Provedores adicionais, limites quantitativos por plano e ampliação de ofertas
alter table public.utm_workspaces drop constraint if exists utm_workspaces_plan_check;
alter table public.utm_workspaces add constraint utm_workspaces_plan_check check (plan in ('devedor','liso','classe_media','rico','vorcaro'));

-- 1. Ampliação de Provedores de Pagamento (Hotmart, Kiwify, Cakto, Kirvano, Eduzz, Monetizze, Wiapy)
alter table public.utm_integrations drop constraint if exists utm_integrations_provider_check;
alter table public.utm_integrations add constraint utm_integrations_provider_check check (provider in ('meta','hotmart','kiwify','cakto','kirvano','eduzz','monetizze','wiapy'));

alter table public.utm_sales drop constraint if exists utm_sales_provider_check;
alter table public.utm_sales add constraint utm_sales_provider_check check (provider in ('meta','hotmart','kiwify','cakto','kirvano','eduzz','monetizze','wiapy'));

alter table public.utm_sales drop constraint if exists utm_sales_product_type_check;
alter table public.utm_sales add constraint utm_sales_product_type_check check (product_type in ('main', 'upsell', 'downsell', 'order_bump', 'subscription', 'complementary', 'alternative'));

-- 2. Ampliação do Cadastro de Ofertas
alter table public.utm_offers add column if not exists product_type text not null default 'main' check (product_type in ('main', 'upsell', 'downsell', 'order_bump', 'subscription', 'complementary', 'alternative'));
alter table public.utm_offers add column if not exists parent_offer_id uuid references public.utm_offers(id) on delete set null;
alter table public.utm_offers add column if not exists external_product_id text;
alter table public.utm_offers add column if not exists external_offer_id text;
alter table public.utm_offers add column if not exists percent_fee numeric not null default 0 check (percent_fee >= 0);
alter table public.utm_offers add column if not exists fixed_fee numeric not null default 0 check (fixed_fee >= 0);
alter table public.utm_offers add column if not exists cost_per_sale numeric not null default 0 check (cost_per_sale >= 0);
alter table public.utm_offers add column if not exists platform text check (platform in ('hotmart', 'kiwify', 'cakto', 'kirvano', 'eduzz', 'monetizze', 'wiapy') or platform is null);
alter table public.utm_offers add column if not exists checkout_url text;
alter table public.utm_offers add column if not exists alternative_links jsonb not null default '[]'::jsonb;

-- 3. Limites Quantitativos no Banco de Dados
create or replace function public.utm_create_workspace(p_user uuid, p_name text, p_timezone text)
returns uuid language plpgsql set search_path='' as $$
declare
  w uuid;
  v_count integer;
  v_plan text;
  v_max integer;
begin
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then
    raise exception 'Invalid timezone';
  end if;

  select count(*) into v_count from public.utm_workspaces where owner_id = p_user;
  if v_count > 0 then
    select plan into v_plan from public.utm_workspaces where owner_id = p_user
    order by case when plan in ('vorcaro','rico','classe_media') then 1 when plan = 'liso' then 2 else 3 end asc limit 1;
    v_max := case when v_plan in ('vorcaro','rico','classe_media') then 25 else 1 end;
    if v_count >= v_max then
      raise exception 'Limite de workspaces atingido para o seu plano.';
    end if;
  end if;

  insert into public.utm_workspaces(name, owner_id, timezone, plan)
  values(p_name, p_user, p_timezone, coalesce(v_plan, 'devedor'))
  returning id into w;

  insert into public.utm_members values(w, p_user, 'owner');
  return w;
end;
$$;

create or replace function utm_private.check_offer_limit()
returns trigger language plpgsql set search_path='' as $$
declare
  v_plan text;
  v_count integer;
  v_max integer;
begin
  select plan into v_plan from public.utm_workspaces where id = new.workspace_id;
  select count(*) into v_count from public.utm_offers where workspace_id = new.workspace_id;
  v_max := case
    when v_plan in ('vorcaro', 'rico', 'classe_media') then 500
    when v_plan = 'liso' then 10
    else 1
  end;
  if v_count >= v_max then
    raise exception 'Limite de ofertas atingido para o plano do workspace.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_offer_limit on public.utm_offers;
create trigger trg_check_offer_limit
before insert on public.utm_offers
for each row execute function utm_private.check_offer_limit();

create or replace function utm_private.check_link_limit()
returns trigger language plpgsql set search_path='' as $$
declare
  v_plan text;
  v_count integer;
  v_max integer;
begin
  select plan into v_plan from public.utm_workspaces where id = new.workspace_id;
  select count(*) into v_count from public.utm_links where workspace_id = new.workspace_id;
  v_max := case
    when v_plan in ('vorcaro', 'rico', 'classe_media') then 10000
    when v_plan = 'liso' then 200
    else 10
  end;
  if v_count >= v_max then
    raise exception 'Limite de links atingido para o plano do workspace.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_link_limit on public.utm_links;
create trigger trg_check_link_limit
before insert on public.utm_links
for each row execute function utm_private.check_link_limit();

create or replace function utm_private.check_integration_limit()
returns trigger language plpgsql set search_path='' as $$
declare
  v_plan text;
  v_count integer;
  v_max integer;
begin
  select plan into v_plan from public.utm_workspaces where id = new.workspace_id;
  if new.provider = 'meta' then
    select count(*) into v_count from public.utm_integrations where workspace_id = new.workspace_id and provider = 'meta';
    v_max := case
      when v_plan in ('vorcaro', 'rico', 'classe_media') then 100
      when v_plan = 'liso' then 3
      else 0
    end;
    if v_count >= v_max then
      raise exception 'Limite de contas Meta Ads atingido para o plano do workspace.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_integration_limit on public.utm_integrations;
create trigger trg_check_integration_limit
before insert on public.utm_integrations
for each row execute function utm_private.check_integration_limit();

-- 4. Suporte aos 7 Provedores em utm_process_payment
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
  select * into strict i from public.utm_integrations
  where id=p_integration and provider in ('hotmart','kiwify','cakto','kirvano','eduzz','monetizze','wiapy') for update;

  if p_payment->>'product_id' is distinct from i.external_product_id or (i.external_offer_id is not null and p_payment->>'external_offer_id' is distinct from i.external_offer_id) then
    raise exception 'Product mismatch';
  end if;

  insert into public.utm_webhook_logs(workspace_id,integration_id,event_id,status,payment,is_test)
  values(i.workspace_id,i.id,p_payment->>'event_id','received',p_payment,coalesce((p_payment->>'is_test')::boolean, false))
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
    v_gross, p_payment->>'currency', p_payment->>'country', p_payment->'attribution', (p_payment->>'occurred_at')::timestamptz, coalesce((p_payment->>'is_test')::boolean, false),
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

-- 5. Atualização de utm_dashboard_summary para incluir todas as métricas por produto e país
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
  v_upsell_rate numeric := 0;
  v_downsell_rate numeric := 0;
  v_avg_ticket numeric := 0;
  v_main_count bigint := 0;
  v_upsell_count bigint := 0;
  v_downsell_count bigint := 0;
begin
  if auth.uid() is not null and not utm_private.member(p_workspace) then
    raise exception 'Workspace não autorizado';
  end if;

  select
    coalesce(count(*), 0),
    coalesce(count(distinct coalesce(parent_transaction_id, transaction_id)), 0),
    coalesce(sum(gross_amount), sum(amount), 0),
    coalesce(sum(fee_amount), 0),
    coalesce(sum(net_amount), sum(gross_amount) - sum(fee_amount), 0)
  into
    v_approved_count,
    v_unique_buyers,
    v_gross_revenue,
    v_platform_fees,
    v_net_revenue
  from public.utm_sales
  where workspace_id = p_workspace
    and status in ('approved', 'paid')
    and currency = p_currency
    and occurred_at >= p_since
    and occurred_at <= p_until
    and is_test = false
    and (p_offer_id is null or offer_id = p_offer_id);

  select
    coalesce(count(*), 0),
    coalesce(sum(gross_amount), sum(amount), 0)
  into
    v_refunded_count,
    v_refunded_amount
  from public.utm_sales
  where workspace_id = p_workspace
    and status in ('refunded', 'chargeback', 'partial_refund')
    and currency = p_currency
    and occurred_at >= p_since
    and occurred_at <= p_until
    and is_test = false
    and (p_offer_id is null or offer_id = p_offer_id);

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

  select
    coalesce(count(*) filter (where event_type = 'pageview'), 0),
    coalesce(count(*) filter (where event_type = 'cta'), 0),
    coalesce(count(*) filter (where event_type = 'checkout'), 0)
  into
    v_pageviews,
    v_ctas,
    v_checkouts
  from public.utm_events
  where workspace_id = p_workspace
    and created_at >= p_since
    and created_at <= p_until
    and (p_offer_id is null or offer_id = p_offer_id);

  select coalesce(
    jsonb_object_agg(
      product_type,
      jsonb_build_object(
        'count', cnt,
        'revenue', rev,
        'fees', f,
        'net', n
      )
    ),
    '{}'::jsonb
  ) into v_by_product
  from (
    select
      product_type,
      count(*) as cnt,
      coalesce(sum(gross_amount), 0) as rev,
      coalesce(sum(fee_amount), 0) as f,
      coalesce(sum(net_amount), 0) as n
    from public.utm_sales
    where workspace_id = p_workspace
      and status in ('approved', 'paid')
      and currency = p_currency
      and occurred_at >= p_since
      and occurred_at <= p_until
      and is_test = false
      and (p_offer_id is null or offer_id = p_offer_id)
    group by product_type
  ) p;

  select coalesce(
    jsonb_object_agg(
      coalesce(country, 'BR'),
      jsonb_build_object('count', cnt, 'revenue', rev)
    ),
    '{}'::jsonb
  ) into v_by_country
  from (
    select
      country,
      count(*) as cnt,
      coalesce(sum(gross_amount), 0) as rev
    from public.utm_sales
    where workspace_id = p_workspace
      and status in ('approved', 'paid')
      and currency = p_currency
      and occurred_at >= p_since
      and occurred_at <= p_until
      and is_test = false
      and (p_offer_id is null or offer_id = p_offer_id)
    group by country
  ) c;

  v_main_count := coalesce((v_by_product->'main'->>'count')::bigint, 0);
  v_upsell_count := coalesce((v_by_product->'upsell'->>'count')::bigint, 0);
  v_downsell_count := coalesce((v_by_product->'downsell'->>'count')::bigint, 0);

  if v_main_count > 0 then
    v_upsell_rate := round((v_upsell_count::numeric / v_main_count::numeric) * 100, 1);
    v_downsell_rate := round((v_downsell_count::numeric / v_main_count::numeric) * 100, 1);
  end if;

  if v_unique_buyers > 0 then
    v_avg_ticket := round(v_gross_revenue / v_unique_buyers, 2);
  end if;

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
    'by_country', v_by_country,
    'upsell_acceptance_rate', v_upsell_rate,
    'downsell_acceptance_rate', v_downsell_rate,
    'average_ticket', v_avg_ticket
  );
end;
$$;
