-- UTMLiso Migration 20260906100000: Dashboard Aggregations & Tracking Events

alter table public.utm_offers add column if not exists public_key text unique default replace(gen_random_uuid()::text, '-', '');
create index if not exists utm_offers_public_key_idx on public.utm_offers(public_key);

alter table public.utm_links add column if not exists public_key text unique default replace(gen_random_uuid()::text, '-', '');
create index if not exists utm_links_public_key_idx on public.utm_links(public_key);

grant select on public.utm_offers to authenticated;
grant select on public.utm_links to authenticated;

create table if not exists public.utm_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id),
  offer_id uuid not null,
  link_id uuid,
  event_type text not null check(event_type in ('pageview', 'cta', 'checkout')),
  session_id text not null check(length(session_id) <= 80),
  url text not null,
  attribution jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key(workspace_id, offer_id) references public.utm_offers(workspace_id, id)
);

create index if not exists utm_events_workspace_idx on public.utm_events(workspace_id);
create index if not exists utm_events_offer_idx on public.utm_events(workspace_id, offer_id);
create index if not exists utm_events_created_at_idx on public.utm_events(workspace_id, created_at);

alter table public.utm_events enable row level security;
revoke all on public.utm_events from anon, authenticated;
grant all on public.utm_events to service_role;
grant select on public.utm_events to authenticated;

create policy member_read on public.utm_events for select to authenticated using (utm_private.member(workspace_id));

-- Ingest tracking event by public key (link or offer)
create or replace function public.utm_track_event(p_key text, p_event jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare
  v_workspace uuid;
  v_offer uuid;
  v_link uuid;
  v_type text;
  v_session text;
  v_url text;
  v_attr jsonb;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'Chave de rastreamento ausente';
  end if;

  -- 1. Check if key belongs to an active link
  select l.workspace_id, l.offer_id, l.id
    into v_workspace, v_offer, v_link
    from public.utm_links l
    join public.utm_offers o on o.workspace_id = l.workspace_id and o.id = l.offer_id
   where l.public_key = p_key and l.active = true and o.active = true;

  -- 2. If not found in links, check if key belongs to an active offer
  if v_workspace is null then
    select o.workspace_id, o.id, null
      into v_workspace, v_offer, v_link
      from public.utm_offers o
     where o.public_key = p_key and o.active = true;
  end if;

  if v_workspace is null then
    raise exception 'Chave de rastreamento inválida ou inativa';
  end if;

  v_type := p_event->>'event_type';
  if v_type not in ('pageview', 'cta', 'checkout') then
    raise exception 'Tipo de evento inválido';
  end if;

  v_session := substring(trim(coalesce(p_event->>'session_id', '')) from 1 for 80);
  if length(v_session) = 0 then
    raise exception 'Sessão inválida';
  end if;

  v_url := coalesce(p_event->>'url', '');
  v_attr := coalesce(p_event->'attribution', '{}'::jsonb);

  insert into public.utm_events (workspace_id, offer_id, link_id, event_type, session_id, url, attribution, created_at)
  values (v_workspace, v_offer, v_link, v_type, v_session, v_url, v_attr, now());

  return 'recorded';
end;
$$;

revoke all on function public.utm_track_event(text, jsonb) from public, anon, authenticated;
grant execute on function public.utm_track_event(text, jsonb) to service_role;

-- Dashboard aggregated summary RPC
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
  v_gross_revenue numeric := 0;
  v_refunded_count bigint := 0;
  v_refunded_amount numeric := 0;
  v_meta_spend numeric := 0;
  v_meta_clicks bigint := 0;
  v_meta_impressions bigint := 0;
  v_pageviews bigint := 0;
  v_ctas bigint := 0;
  v_checkouts bigint := 0;
begin
  if auth.uid() is not null and not utm_private.member(p_workspace) then
    raise exception 'Workspace não autorizado';
  end if;

  -- 1. Vendas aprovadas
  select coalesce(count(*), 0), coalesce(sum(amount), 0)
    into v_approved_count, v_gross_revenue
    from public.utm_sales
   where workspace_id = p_workspace
     and is_test = false
     and status = 'approved'
     and currency = p_currency
     and occurred_at >= p_since and occurred_at <= p_until
     and (p_offer_id is null or offer_id = p_offer_id);

  -- 2. Reembolsos / Chargebacks
  select coalesce(count(*), 0), coalesce(sum(amount), 0)
    into v_refunded_count, v_refunded_amount
    from public.utm_sales
   where workspace_id = p_workspace
     and is_test = false
     and status in ('refunded', 'chargeback')
     and currency = p_currency
     and occurred_at >= p_since and occurred_at <= p_until
     and (p_offer_id is null or offer_id = p_offer_id);

  -- 3. Insights Meta (Gasto e Impressões gerais do workspace quando p_offer_id é null)
  if p_offer_id is null then
    select coalesce(sum(spend), 0), coalesce(sum(clicks), 0), coalesce(sum(impressions), 0)
      into v_meta_spend, v_meta_clicks, v_meta_impressions
      from public.utm_insights
     where workspace_id = p_workspace
       and currency = p_currency
       and day >= (p_since at time zone 'UTC')::date
       and day <= (p_until at time zone 'UTC')::date;
  else
    v_meta_spend := null;
    v_meta_clicks := 0;
    v_meta_impressions := 0;
  end if;

  -- 4. Eventos do funil
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
    'gross_revenue', v_gross_revenue,
    'refunded_count', v_refunded_count,
    'refunded_amount', v_refunded_amount,
    'meta_spend', v_meta_spend,
    'meta_clicks', v_meta_clicks,
    'meta_impressions', v_meta_impressions,
    'pageviews', v_pageviews,
    'ctas', v_ctas,
    'checkouts', v_checkouts
  );
end;
$$;

revoke all on function public.utm_dashboard_summary(uuid, timestamptz, timestamptz, text, uuid) from public, anon;
grant execute on function public.utm_dashboard_summary(uuid, timestamptz, timestamptz, text, uuid) to authenticated, service_role;
