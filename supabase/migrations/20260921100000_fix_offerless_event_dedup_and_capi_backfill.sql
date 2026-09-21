-- 20260920140000_allow_links_and_events_without_offer.sql rewrote
-- utm_track_event to support offerless links, but dropped event_id from the
-- utm_events INSERT and its ON CONFLICT dedup guard in the process (both
-- present in the prior version, 20260910190000_tracking_reliability_finalize.sql).
-- A retried tracker request (flaky network, bfcache re-fire) can now insert
-- the same pageview/checkout twice, inflating funnel counts, and the missing
-- event_id also made it impossible to later send a retroactive CAPI event for
-- a click that only learned its offer_id after the sale (see below).

-- Defensive: event_id already exists in production since
-- 20260910190000_tracking_reliability_finalize.sql, but keep this migration
-- self-contained (idempotent) rather than depending on that file having run
-- first in every environment this applies to.
alter table public.utm_events add column if not exists event_id text;

-- The existing dedup index treats two NULLs as distinct by default, which
-- would defeat dedup specifically for offerless events (offer_id IS NULL is
-- exactly the new case this migration restores dedup for) -- NULLS NOT
-- DISTINCT makes two NULL offer_ids compare equal for this unique index.
drop index if exists public.utm_events_dedup_idx;
create unique index utm_events_dedup_idx
  on public.utm_events(workspace_id, offer_id, event_id, event_type)
  nulls not distinct
  where event_id is not null;

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
  select l.workspace_id, l.offer_id, l.id
  into v_workspace, v_offer, v_link
  from public.utm_links l
  left join public.utm_offers o on o.workspace_id = l.workspace_id and o.id = l.offer_id
  where l.public_key = p_key
    and l.active
    and (l.offer_id is null or o.active);

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

  v_url := left(coalesce(p_event->>'url', ''), 2048);
  v_attr := coalesce(p_event->'attribution', '{}'::jsonb);
  v_event_id := nullif(nullif(trim(coalesce(p_event->>'event_id', '')), ''), 'null');
  v_capi_ciphertext := nullif(nullif(trim(coalesce(p_event->>'capi_payload_ciphertext', '')), ''), 'null');

  insert into public.utm_events (workspace_id, offer_id, link_id, event_type, event_id, session_id, url, attribution, created_at)
  values (v_workspace, v_offer, v_link, v_type, v_event_id, v_session, v_url, v_attr, now())
  on conflict (workspace_id, offer_id, event_id, event_type) where event_id is not null do nothing;

  -- Only queue to CAPI outbox immediately if an offer is already known (the
  -- outbox's pixel config is per-offer); an offerless click's PageView/
  -- InitiateCheckout is queued later, retroactively, once a matching sale
  -- backfills its offer_id (see the webhook route's attribution backfill).
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
