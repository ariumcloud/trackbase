-- Funil coerente com o Gerenciador: sincroniza as visualizações da página de
-- destino (landing_page_view) e o resumo devolve IC e LPV do Meta. A UI usa esses
-- dois no funil enquanto existirem, já que são o mesmo número que o cliente confere
-- no Meta; o tracker segue como fallback e para ofertas individuais.
alter table public.utm_insights add column if not exists meta_landing_page_views numeric;

create or replace function public.utm_commit_meta_sync(p_integration uuid, p_since date, p_until date, p_entities jsonb, p_insights jsonb, p_demographics jsonb default '[]'::jsonb)
 returns void
 language plpgsql
 set search_path to ''
as $function$
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
  insert into public.utm_insights(workspace_id,integration_id,ad_id,campaign_id,adset_id,day,currency,spend,impressions,clicks,reach,meta_initiate_checkouts,meta_landing_page_views,meta_purchases,meta_revenue)
  select w,p_integration,r.ad_id,r.campaign_id,r.adset_id,r.day,r.currency,r.spend,r.impressions,r.clicks,r.reach,coalesce(r.meta_initiate_checkouts,0),r.meta_landing_page_views,r.meta_purchases,r.meta_revenue
  from jsonb_to_recordset(p_insights) as r(ad_id text,campaign_id text,adset_id text,day date,currency text,spend numeric,impressions bigint,clicks bigint,reach bigint,meta_initiate_checkouts numeric,meta_landing_page_views numeric,meta_purchases numeric,meta_revenue numeric)
  where r.day between p_since and p_until;
  delete from public.utm_ad_entities where integration_id=p_integration;
  insert into public.utm_ad_entities(workspace_id,integration_id,external_id,kind,parent_id,name,status,budget_minor,budget_currency,budget_type,meta_created_at)
  select w,p_integration,r.external_id,r.kind,r.parent_id,r.name,r.status,r.budget_minor,r.budget_currency,r.budget_type,r.meta_created_at
  from jsonb_to_recordset(p_entities) as r(external_id text,kind text,parent_id text,name text,status text,budget_minor numeric,budget_currency text,budget_type text,meta_created_at timestamptz);
  delete from public.utm_insights_demographics where integration_id=p_integration and day between p_since and p_until;
  if jsonb_typeof(p_demographics) = 'array' and jsonb_array_length(p_demographics) > 0 then
    insert into public.utm_insights_demographics(workspace_id,integration_id,day,age,gender,currency,spend,impressions,clicks)
    select w,p_integration,r.day,r.age,r.gender,r.currency,r.spend,r.impressions,r.clicks
    from jsonb_to_recordset(p_demographics) as r(day date,age text,gender text,currency text,spend numeric,impressions bigint,clicks bigint)
    where r.day between p_since and p_until;
  end if;
  update public.utm_integrations set last_synced_at=now(),status='connected' where id=p_integration;
end $function$;

create or replace function public.utm_dashboard_summary(
  p_workspace uuid,
  p_since timestamp with time zone,
  p_until timestamp with time zone,
  p_currency text,
  p_offer_id uuid default null::uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
  v_pageviews_px bigint := 0;
  v_checkouts_px bigint := 0;
  v_pixel_data boolean := false;
  v_meta_ic numeric := 0;
  v_meta_lpv numeric := 0;
  v_meta_funnel boolean := false;
  v_by_product jsonb := '{}'::jsonb;
  v_by_country jsonb := '{}'::jsonb;
  v_upsell_rate numeric := 0;
  v_downsell_rate numeric := 0;
  v_avg_ticket numeric := 0;
  v_main_count bigint := 0;
  v_upsell_count bigint := 0;
  v_downsell_count bigint := 0;
  v_timezone text := 'UTC';
begin
  if auth.uid() is not null and not utm_private.member(p_workspace) then
    raise exception 'Workspace não autorizado';
  end if;
  select coalesce(timezone, 'UTC') into v_timezone from public.utm_workspaces where id = p_workspace;
  select coalesce(count(*), 0), coalesce(count(distinct coalesce(parent_transaction_id, transaction_id)), 0), coalesce(sum(gross_amount), sum(amount), 0), coalesce(sum(fee_amount), 0), coalesce(sum(net_amount), sum(gross_amount) - sum(fee_amount), 0)
  into v_approved_count, v_unique_buyers, v_gross_revenue, v_platform_fees, v_net_revenue
  from public.utm_sales
  where workspace_id = p_workspace and lower(status) in ('approved', 'paid', 'completed') and currency = p_currency
    and (occurred_at at time zone v_timezone)::date >= (p_since at time zone 'UTC')::date and (occurred_at at time zone v_timezone)::date <= (p_until at time zone 'UTC')::date
    and is_test = false and (p_offer_id is null or offer_id = p_offer_id);
  select coalesce(count(*), 0), coalesce(sum(gross_amount), sum(amount), 0)
  into v_refunded_count, v_refunded_amount
  from public.utm_sales
  where workspace_id = p_workspace and lower(status) in ('refunded', 'chargeback', 'partial_refund', 'chargedback') and currency = p_currency
    and (occurred_at at time zone v_timezone)::date >= (p_since at time zone 'UTC')::date and (occurred_at at time zone v_timezone)::date <= (p_until at time zone 'UTC')::date
    and is_test = false and (p_offer_id is null or offer_id = p_offer_id);
  if p_offer_id is null then
    select coalesce(sum(spend), 0), coalesce(sum(clicks), 0), coalesce(sum(impressions), 0),
      coalesce(sum(meta_initiate_checkouts), 0), coalesce(sum(meta_landing_page_views), 0), coalesce(bool_and(meta_landing_page_views is not null), false)
    into v_meta_spend, v_meta_clicks, v_meta_impressions, v_meta_ic, v_meta_lpv, v_meta_funnel
    from public.utm_insights where workspace_id = p_workspace and currency = p_currency
      and day >= (p_since at time zone 'UTC')::date and day <= (p_until at time zone 'UTC')::date;
    v_operating_profit := v_net_revenue - v_meta_spend;
  else
    v_meta_spend := null; v_meta_clicks := 0; v_meta_impressions := 0; v_operating_profit := null;
  end if;
  select coalesce(count(distinct coalesce(session_id, id::text)) filter (where event_type = 'pageview'), 0),
    coalesce(count(*) filter (where (event_type = 'cta' and coalesce(attribution->>'action', '') in ('', 'cta_click')) or event_type = 'cta_click') + count(*) filter (where event_type = 'checkout'), 0),
    coalesce(count(distinct coalesce(session_id, id::text)) filter (where event_type = 'checkout'), 0)
  into v_pageviews, v_ctas, v_checkouts
  from public.utm_events
  where workspace_id = p_workspace and (created_at at time zone v_timezone)::date >= (p_since at time zone 'UTC')::date
    and (created_at at time zone v_timezone)::date <= (p_until at time zone 'UTC')::date and (p_offer_id is null or offer_id = p_offer_id);
  select coalesce(count(distinct coalesce(session_id, id::text)) filter (
      where attribution->>'pixel_loaded' = 'true' and (coalesce(attribution->>'fbclid', '') <> ''
        or lower(coalesce(attribution->>'utm_source', '')) in ('meta', 'facebook', 'fb', 'ig', 'instagram'))), 0),
    coalesce(count(distinct coalesce(session_id, id::text)) filter (
      where event_type = 'checkout' and attribution->>'pixel_loaded' = 'true' and (coalesce(attribution->>'fbclid', '') <> ''
        or lower(coalesce(attribution->>'utm_source', '')) in ('meta', 'facebook', 'fb', 'ig', 'instagram'))), 0),
    coalesce(bool_or(attribution ? 'pixel_loaded'), false)
  into v_pageviews_px, v_checkouts_px, v_pixel_data
  from public.utm_events
  where workspace_id = p_workspace and (created_at at time zone v_timezone)::date >= (p_since at time zone 'UTC')::date
    and (created_at at time zone v_timezone)::date <= (p_until at time zone 'UTC')::date and (p_offer_id is null or offer_id = p_offer_id);
  select coalesce(jsonb_object_agg(product_type, jsonb_build_object('count', cnt, 'revenue', rev, 'fees', f, 'net', n)), '{}'::jsonb)
  into v_by_product
  from (select product_type, count(*) as cnt, coalesce(sum(gross_amount), 0) as rev, coalesce(sum(fee_amount), 0) as f, coalesce(sum(net_amount), 0) as n
    from public.utm_sales where workspace_id = p_workspace and lower(status) in ('approved', 'paid', 'completed') and currency = p_currency
      and (occurred_at at time zone v_timezone)::date >= (p_since at time zone 'UTC')::date and (occurred_at at time zone v_timezone)::date <= (p_until at time zone 'UTC')::date
      and is_test = false and (p_offer_id is null or offer_id = p_offer_id) group by product_type) p;
  select coalesce(jsonb_object_agg(coalesce(country, 'BR'), jsonb_build_object('count', cnt, 'revenue', rev)), '{}'::jsonb)
  into v_by_country
  from (select country, count(*) as cnt, coalesce(sum(gross_amount), 0) as rev from public.utm_sales
    where workspace_id = p_workspace and lower(status) in ('approved', 'paid', 'completed') and currency = p_currency
      and (occurred_at at time zone v_timezone)::date >= (p_since at time zone 'UTC')::date and (occurred_at at time zone v_timezone)::date <= (p_until at time zone 'UTC')::date
      and is_test = false and (p_offer_id is null or offer_id = p_offer_id) group by country) c;
  v_main_count := coalesce((v_by_product->'main'->>'count')::bigint, 0);
  v_upsell_count := coalesce((v_by_product->'upsell'->>'count')::bigint, 0);
  v_downsell_count := coalesce((v_by_product->'downsell'->>'count')::bigint, 0);
  if v_main_count > 0 then
    v_upsell_rate := round((v_upsell_count::numeric / v_main_count::numeric) * 100, 1);
    v_downsell_rate := round((v_downsell_count::numeric / v_main_count::numeric) * 100, 1);
  end if;
  if v_unique_buyers > 0 then v_avg_ticket := round(v_gross_revenue / v_unique_buyers, 2); end if;
  return jsonb_build_object('sales_count', v_approved_count, 'unique_buyers', v_unique_buyers, 'gross_revenue', v_gross_revenue, 'platform_fees', v_platform_fees, 'net_revenue', v_net_revenue, 'operating_profit', v_operating_profit, 'refunded_count', v_refunded_count, 'refunded_amount', v_refunded_amount, 'meta_spend', v_meta_spend, 'meta_clicks', v_meta_clicks, 'meta_impressions', v_meta_impressions, 'pageviews', v_pageviews, 'ctas', v_ctas, 'checkouts', v_checkouts, 'pageviews_px', v_pageviews_px, 'checkouts_px', v_checkouts_px, 'pixel_data', v_pixel_data, 'meta_ic', v_meta_ic, 'meta_lpv', v_meta_lpv, 'meta_funnel', v_meta_funnel, 'by_product_type', v_by_product, 'by_country', v_by_country, 'upsell_acceptance_rate', v_upsell_rate, 'downsell_acceptance_rate', v_downsell_rate, 'average_ticket', v_avg_ticket);
end;
$function$;
