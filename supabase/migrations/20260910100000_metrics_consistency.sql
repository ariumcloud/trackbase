-- Keep dashboard totals aligned with the statuses accepted by the webhook adapters.
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
  v_timezone text := 'UTC';
begin
  if auth.uid() is not null and not utm_private.member(p_workspace) then
    raise exception 'Workspace não autorizado';
  end if;

  select coalesce(timezone, 'UTC') into v_timezone
    from public.utm_workspaces
   where id = p_workspace;

  select coalesce(count(*), 0),
    coalesce(count(distinct coalesce(parent_transaction_id, transaction_id)), 0),
    coalesce(sum(gross_amount), sum(amount), 0),
    coalesce(sum(fee_amount), 0),
    coalesce(sum(net_amount), sum(gross_amount) - sum(fee_amount), 0)
  into v_approved_count, v_unique_buyers, v_gross_revenue, v_platform_fees, v_net_revenue
  from public.utm_sales
  where workspace_id = p_workspace
    and status in ('approved', 'paid', 'completed')
    and currency = p_currency
    and (occurred_at at time zone v_timezone)::date >= (p_since at time zone 'UTC')::date
    and (occurred_at at time zone v_timezone)::date <= (p_until at time zone 'UTC')::date
    and is_test = false
    and (p_offer_id is null or offer_id = p_offer_id);

  select coalesce(count(*), 0), coalesce(sum(gross_amount), sum(amount), 0)
  into v_refunded_count, v_refunded_amount
  from public.utm_sales
  where workspace_id = p_workspace
    and status in ('refunded', 'chargeback', 'partial_refund', 'chargedback')
    and currency = p_currency
    and (occurred_at at time zone v_timezone)::date >= (p_since at time zone 'UTC')::date
    and (occurred_at at time zone v_timezone)::date <= (p_until at time zone 'UTC')::date
    and is_test = false
    and (p_offer_id is null or offer_id = p_offer_id);

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

  select coalesce(count(*) filter (where event_type = 'pageview'), 0),
    coalesce(count(*) filter (where event_type = 'cta'), 0),
    coalesce(count(*) filter (where event_type = 'checkout'), 0)
  into v_pageviews, v_ctas, v_checkouts
  from public.utm_events
  where workspace_id = p_workspace
    and (created_at at time zone v_timezone)::date >= (p_since at time zone 'UTC')::date
    and (created_at at time zone v_timezone)::date <= (p_until at time zone 'UTC')::date
    and (p_offer_id is null or offer_id = p_offer_id);

  select coalesce(jsonb_object_agg(product_type,
    jsonb_build_object('count', cnt, 'revenue', rev, 'fees', f, 'net', n)), '{}'::jsonb)
  into v_by_product
  from (
    select product_type, count(*) as cnt,
      coalesce(sum(gross_amount), 0) as rev,
      coalesce(sum(fee_amount), 0) as f,
      coalesce(sum(net_amount), 0) as n
    from public.utm_sales
    where workspace_id = p_workspace
      and status in ('approved', 'paid', 'completed')
      and currency = p_currency
      and (occurred_at at time zone v_timezone)::date >= (p_since at time zone 'UTC')::date
      and (occurred_at at time zone v_timezone)::date <= (p_until at time zone 'UTC')::date
      and is_test = false
      and (p_offer_id is null or offer_id = p_offer_id)
    group by product_type
  ) p;

  select coalesce(jsonb_object_agg(coalesce(country, 'BR'),
    jsonb_build_object('count', cnt, 'revenue', rev)), '{}'::jsonb)
  into v_by_country
  from (
    select country, count(*) as cnt, coalesce(sum(gross_amount), 0) as rev
    from public.utm_sales
    where workspace_id = p_workspace
      and status in ('approved', 'paid', 'completed')
      and currency = p_currency
      and (occurred_at at time zone v_timezone)::date >= (p_since at time zone 'UTC')::date
      and (occurred_at at time zone v_timezone)::date <= (p_until at time zone 'UTC')::date
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

revoke all on function public.utm_dashboard_summary(uuid, timestamptz, timestamptz, text, uuid) from public, anon;
grant execute on function public.utm_dashboard_summary(uuid, timestamptz, timestamptz, text, uuid) to authenticated, service_role;
