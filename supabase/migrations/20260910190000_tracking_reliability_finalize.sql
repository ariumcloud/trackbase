-- Reliability contract applied after the existing tracking/outbox/meta migrations.
-- Additive: no production data is removed or rewritten.
alter table public.utm_events add column if not exists event_id text;
alter table public.utm_events drop constraint if exists utm_events_event_type_check;
alter table public.utm_events add constraint utm_events_event_type_check
  check (event_type in ('pageview','cta','cta_view','cta_click','checkout'));
create unique index if not exists utm_events_dedup_idx
  on public.utm_events(workspace_id, offer_id, event_id, event_type)
  where event_id is not null;
create index if not exists utm_events_session_idx
  on public.utm_events(workspace_id, offer_id, session_id, created_at desc);

alter table public.utm_sales
  add column if not exists attribution_source text not null default 'none',
  add column if not exists attribution_confidence text not null default 'none',
  add column if not exists attribution_reason text,
  add column if not exists attribution_session_id text;
alter table public.utm_sales drop constraint if exists utm_sales_attribution_confidence_check;
alter table public.utm_sales add constraint utm_sales_attribution_confidence_check
  check (attribution_confidence in ('high','medium','none'));
create index if not exists utm_sales_attribution_idx
  on public.utm_sales(workspace_id, offer_id, attribution_confidence, occurred_at desc);

alter table public.utm_capi_outbox add column if not exists occurred_at timestamptz;
update public.utm_capi_outbox set occurred_at = created_at where occurred_at is null;
alter table public.utm_capi_outbox alter column occurred_at set default now();
alter table public.utm_capi_outbox alter column occurred_at set not null;
alter table public.utm_capi_outbox drop constraint if exists utm_capi_outbox_event_name_check;
alter table public.utm_capi_outbox add constraint utm_capi_outbox_event_name_check
  check (event_name in ('PageView','ViewContent','Lead','InitiateCheckout','Purchase','Refund','Chargeback'));
create index if not exists utm_capi_outbox_workspace_status_idx
  on public.utm_capi_outbox(workspace_id, status, next_attempt_at);

-- A failed/empty Meta sync must never erase the last valid snapshot.
create or replace function public.utm_commit_meta_sync(
  p_integration uuid, p_since date, p_until date, p_entities jsonb, p_insights jsonb
) returns void language plpgsql set search_path='' as $$
declare w uuid; begin
  select workspace_id into strict w from public.utm_integrations
   where id=p_integration and provider='meta' for update;
  if p_until < p_since or p_until-p_since > 31 then raise exception 'Invalid interval'; end if;
  if jsonb_typeof(p_insights) <> 'array'
     or jsonb_array_length(case when jsonb_typeof(p_insights)='array' then p_insights else '[]'::jsonb end)=0
     or jsonb_typeof(p_entities) <> 'array'
     or jsonb_array_length(case when jsonb_typeof(p_entities)='array' then p_entities else '[]'::jsonb end)=0 then
    raise exception 'Empty or partial Meta snapshot';
  end if;
  delete from public.utm_insights where integration_id=p_integration and day between p_since and p_until;
  insert into public.utm_insights(workspace_id,integration_id,ad_id,campaign_id,adset_id,day,currency,spend,impressions,clicks,reach,meta_initiate_checkouts,meta_purchases,meta_revenue)
  select w,p_integration,r.ad_id,r.campaign_id,r.adset_id,r.day,r.currency,r.spend,r.impressions,r.clicks,r.reach,coalesce(r.meta_initiate_checkouts,0),r.meta_purchases,r.meta_revenue
  from jsonb_to_recordset(p_insights) as r(ad_id text,campaign_id text,adset_id text,day date,currency text,spend numeric,impressions bigint,clicks bigint,reach bigint,meta_initiate_checkouts numeric,meta_purchases numeric,meta_revenue numeric)
  where r.day between p_since and p_until;
  delete from public.utm_ad_entities where integration_id=p_integration;
  insert into public.utm_ad_entities(workspace_id,integration_id,external_id,kind,parent_id,name,status,budget_minor,budget_currency,budget_type,meta_created_at)
  select w,p_integration,r.external_id,r.kind,r.parent_id,r.name,r.status,r.budget_minor,r.budget_currency,r.budget_type,r.meta_created_at
  from jsonb_to_recordset(p_entities) as r(external_id text,kind text,parent_id text,name text,status text,budget_minor numeric,budget_currency text,budget_type text,meta_created_at timestamptz);
  update public.utm_integrations set last_synced_at=now(),status='connected' where id=p_integration;
end $$;
revoke all on function public.utm_commit_meta_sync(uuid,date,date,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.utm_commit_meta_sync(uuid,date,date,jsonb,jsonb) to service_role;

create or replace function public.utm_track_event(p_key text, p_event jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare v_workspace uuid; v_offer uuid; v_link uuid; v_type text; v_session text; v_event_id text; v_url text; v_attr jsonb; v_cipher text;
begin
  select l.workspace_id,l.offer_id,l.id into v_workspace,v_offer,v_link from public.utm_links l join public.utm_offers o on o.workspace_id=l.workspace_id and o.id=l.offer_id where l.public_key=p_key and l.active and o.active;
  if v_workspace is null then select o.workspace_id,o.id,null into v_workspace,v_offer,v_link from public.utm_offers o where o.public_key=p_key and o.active; end if;
  if v_workspace is null then raise exception 'Chave de rastreamento inválida ou inativa'; end if;
  v_type := p_event->>'event_type';
  if v_type not in ('pageview','cta','cta_view','cta_click','checkout') then raise exception 'Tipo de evento inválido'; end if;
  v_session := substring(trim(coalesce(p_event->>'session_id','')) from 1 for 80);
  if length(v_session)=0 then raise exception 'Sessão inválida'; end if;
  v_event_id := nullif(nullif(trim(coalesce(p_event->>'event_id','')),''),'null');
  v_url := left(coalesce(p_event->>'url',''),2048); v_attr := coalesce(p_event->'attribution','{}'::jsonb); v_cipher := nullif(nullif(trim(coalesce(p_event->>'capi_payload_ciphertext','')),''),'null');
  insert into public.utm_events(workspace_id,offer_id,link_id,event_type,event_id,session_id,url,attribution,created_at)
  values(v_workspace,v_offer,v_link,v_type,v_event_id,v_session,v_url,v_attr,now())
  on conflict(workspace_id,offer_id,event_id,event_type) where event_id is not null do nothing;
  if v_type in ('pageview','checkout') and v_event_id is not null and v_cipher is not null then
    insert into public.utm_capi_outbox(workspace_id,offer_id,event_id,event_name,event_source_url,user_data_ciphertext,occurred_at)
    values(v_workspace,v_offer,v_event_id,case when v_type='pageview' then 'PageView' else 'InitiateCheckout' end,v_url,v_cipher,now())
    on conflict(workspace_id,offer_id,event_id,event_name) do nothing;
  end if;
  return 'recorded';
end $$;
revoke all on function public.utm_track_event(text,jsonb) from public,anon,authenticated;
grant execute on function public.utm_track_event(text,jsonb) to service_role;
