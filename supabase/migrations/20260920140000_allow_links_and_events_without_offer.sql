-- Allow UTM links and tracking events without a pre-bound offer (Utmify-style auto-discovery)
-- Relaxes NOT NULL constraint on offer_id in utm_links and utm_events.
-- Composite foreign key (workspace_id, offer_id) -> utm_offers(workspace_id, id)
-- is preserved: PostgreSQL MATCH SIMPLE naturally allows offer_id to be NULL without
-- violating the constraint, while strictly enforcing cross-workspace isolation when offer_id is set.

alter table public.utm_links
  alter column offer_id drop not null;

alter table public.utm_events
  alter column offer_id drop not null;

-- Index to accelerate resolution and backfill of events created without an offer
create index if not exists utm_events_workspace_session_null_offer_idx
  on public.utm_events(workspace_id, session_id)
  where offer_id is null;

-- Update utm_track_event to handle links without an offer
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
  v_capi_ciphertext text;
  v_event_name text;
begin
  -- Look up link by public key: support offerless links via LEFT JOIN
  select l.workspace_id, l.offer_id, l.id
  into v_workspace, v_offer, v_link
  from public.utm_links l
  left join public.utm_offers o on o.workspace_id = l.workspace_id and o.id = l.offer_id
  where l.public_key = p_key
    and l.active
    and (l.offer_id is null or o.active);

  -- If not found as link, look up directly as offer public key
  if v_workspace is null then
    select o.workspace_id, o.id, null
    into v_workspace, v_offer, v_link
    from public.utm_offers o
    where o.public_key = p_key
      and o.active;
  end if;

  if v_workspace is null then
    raise exception 'Chave de rastreamento inválida ou inativa';
  end if;

  v_type := p_event->>'event_type';
  if v_type not in ('pageview', 'cta', 'cta_view', 'cta_click', 'checkout') then
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

  -- Only queue to CAPI outbox if an offer is known (CAPI outbox requires offer_id)
  if v_offer is not null and v_type in ('pageview', 'checkout') and v_event_id is not null and v_capi_ciphertext is not null then
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

revoke all on function public.utm_track_event(text, jsonb) from public, anon, authenticated;
grant execute on function public.utm_track_event(text, jsonb) to service_role;
