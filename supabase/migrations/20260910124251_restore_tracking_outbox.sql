-- Restore the public tracker RPC and durable CAPI outbox in production.
-- The tables already exist in some environments, so this migration is idempotent.
create table if not exists public.utm_capi_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id),
  offer_id uuid not null,
  event_id text not null check(length(event_id) between 1 and 100),
  event_name text not null check(event_name in ('PageView', 'InitiateCheckout')),
  event_source_url text not null check(length(event_source_url) <= 2048),
  user_data_ciphertext text not null,
  status text not null default 'pending' check(status in ('pending', 'processing', 'retry', 'sent', 'skipped', 'failed')),
  attempt_count integer not null default 0 check(attempt_count >= 0 and attempt_count <= 5),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(workspace_id, offer_id) references public.utm_offers(workspace_id, id),
  unique(workspace_id, offer_id, event_id, event_name)
);

create index if not exists utm_capi_outbox_pending_idx
  on public.utm_capi_outbox(status, next_attempt_at, created_at);

alter table public.utm_capi_outbox enable row level security;
revoke all on public.utm_capi_outbox from public, anon, authenticated;
grant all on public.utm_capi_outbox to service_role;

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
  v_event_id text;
  v_event_name text;
  v_capi_ciphertext text;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'Chave de rastreamento ausente';
  end if;

  select l.workspace_id, l.offer_id, l.id
    into v_workspace, v_offer, v_link
    from public.utm_links l
    join public.utm_offers o on o.workspace_id = l.workspace_id and o.id = l.offer_id
   where l.public_key = p_key and l.active = true and o.active = true;

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

  v_event_id := nullif(nullif(trim(coalesce(p_event->>'event_id', '')), ''), 'null');
  v_capi_ciphertext := nullif(nullif(trim(coalesce(p_event->>'capi_payload_ciphertext', '')), ''), 'null');
  if v_type in ('pageview', 'checkout') and v_event_id is not null and v_capi_ciphertext is not null then
    v_event_name := case when v_type = 'pageview' then 'PageView' else 'InitiateCheckout' end;
    insert into public.utm_capi_outbox(
      workspace_id, offer_id, event_id, event_name, event_source_url, user_data_ciphertext
    ) values (
      v_workspace, v_offer, v_event_id, v_event_name, v_url, v_capi_ciphertext
    ) on conflict(workspace_id, offer_id, event_id, event_name) do nothing;
  end if;

  return 'recorded';
end;
$$;

create or replace function public.utm_claim_capi_outbox(p_limit integer default 10)
returns setof public.utm_capi_outbox language plpgsql security definer set search_path='' as $$
begin
  return query
  update public.utm_capi_outbox o
     set status = 'processing',
         locked_at = now(),
         attempt_count = o.attempt_count + 1,
         updated_at = now()
   where o.id in (
     select id
       from public.utm_capi_outbox
      where (status in ('pending', 'retry') and next_attempt_at <= now())
         or (status = 'processing' and locked_at < now() - interval '5 minutes')
      order by created_at
      limit greatest(1, least(coalesce(p_limit, 10), 25))
   )
     and (o.status in ('pending', 'retry') or (o.status = 'processing' and o.locked_at < now() - interval '5 minutes'))
  returning o.*;
end;
$$;

revoke all on function public.utm_track_event(text, jsonb), public.utm_claim_capi_outbox(integer) from public, anon, authenticated;
grant execute on function public.utm_track_event(text, jsonb), public.utm_claim_capi_outbox(integer) to service_role;

