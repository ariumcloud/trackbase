-- Persist the InitiateCheckout action returned by Meta Insights.  The
-- campaigns table must use Meta's conversion count instead of inferring it
-- from the small subset of checkout events captured by the tracker.
alter table public.utm_insights
  add column if not exists meta_initiate_checkouts numeric;

create or replace function public.utm_commit_meta_sync(
  p_integration uuid,
  p_since date,
  p_until date,
  p_entities jsonb,
  p_insights jsonb
) returns void
language plpgsql
set search_path=''
as $$
declare
  w uuid;
begin
  select workspace_id into strict w
    from public.utm_integrations
   where id = p_integration
     and provider = 'meta'
   for update;

  if p_until < p_since or p_until - p_since > 31 then
    raise exception 'Invalid interval';
  end if;

  delete from public.utm_insights
   where integration_id = p_integration
     and day between p_since and p_until;

  insert into public.utm_insights(
    workspace_id,
    integration_id,
    ad_id,
    campaign_id,
    adset_id,
    day,
    currency,
    spend,
    impressions,
    clicks,
    reach,
    meta_initiate_checkouts,
    meta_purchases,
    meta_revenue
  )
  select
    w,
    p_integration,
    r.ad_id,
    r.campaign_id,
    r.adset_id,
    r.day,
    r.currency,
    r.spend,
    r.impressions,
    r.clicks,
    r.reach,
    coalesce(r.meta_initiate_checkouts, 0),
    r.meta_purchases,
    r.meta_revenue
  from jsonb_to_recordset(p_insights) as r(
    ad_id text,
    campaign_id text,
    adset_id text,
    day date,
    currency text,
    spend numeric,
    impressions bigint,
    clicks bigint,
    reach bigint,
    meta_initiate_checkouts numeric,
    meta_purchases numeric,
    meta_revenue numeric
  )
  where r.day between p_since and p_until;

  delete from public.utm_ad_entities
   where integration_id = p_integration;

  insert into public.utm_ad_entities(
    workspace_id,
    integration_id,
    external_id,
    kind,
    parent_id,
    name,
    status,
    budget_minor,
    budget_currency,
    budget_type,
    meta_created_at
  )
  select
    w,
    p_integration,
    r.external_id,
    r.kind,
    r.parent_id,
    r.name,
    r.status,
    r.budget_minor,
    r.budget_currency,
    r.budget_type,
    r.meta_created_at
  from jsonb_to_recordset(p_entities) as r(
    external_id text,
    kind text,
    parent_id text,
    name text,
    status text,
    budget_minor numeric,
    budget_currency text,
    budget_type text,
    meta_created_at timestamptz
  );

  update public.utm_integrations
     set last_synced_at = now(),
         status = 'connected'
   where id = p_integration;
end;
$$;

revoke all on function public.utm_commit_meta_sync(uuid, date, date, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.utm_commit_meta_sync(uuid, date, date, jsonb, jsonb)
  to service_role;
