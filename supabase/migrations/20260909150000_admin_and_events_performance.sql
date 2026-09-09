-- Migration 20260909150000: Performance indexes for platform admin and high-volume tracking tables
create index if not exists utm_events_created_at_desc_idx
  on public.utm_events(created_at desc);

create index if not exists utm_sales_occurred_at_idx
  on public.utm_sales(occurred_at desc)
  where not is_test;

create index if not exists utm_webhook_logs_invalid_received_idx
  on public.utm_webhook_logs(received_at desc)
  where status = 'invalid' and not is_test;

-- Optimized RPC: stores boundary timestamps in variables to ensure indexed B-tree range scans
create or replace function public.utm_admin_overview()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  v_capi_failed bigint;
  v_today timestamptz;
  v_7d timestamptz;
  v_30d timestamptz;
begin
  if to_regclass('public.utm_capi_outbox') is not null then
    execute 'select count(*) from public.utm_capi_outbox where status=''failed''' into v_capi_failed;
  end if;

  v_today := (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
  v_7d := now() - interval '7 days';
  v_30d := now() - interval '30 days';

  return jsonb_build_object(
    'customers',(select count(*) from auth.users u where exists(select 1 from public.utm_members m where m.user_id=u.id) or u.raw_user_meta_data->>'app'='trackbase'),
    'new_customers',(select count(*) from auth.users u where u.created_at>=v_7d and (exists(select 1 from public.utm_members m where m.user_id=u.id) or u.raw_user_meta_data->>'app'='trackbase')),
    'active_customers',(select count(*) from auth.users u where u.last_sign_in_at>=v_30d and (exists(select 1 from public.utm_members m where m.user_id=u.id) or u.raw_user_meta_data->>'app'='trackbase')),
    'workspaces',(select count(*) from public.utm_workspaces),
    'plans',(select coalesce(jsonb_object_agg(plan,n),'{}'::jsonb) from (select plan,count(*) n from public.utm_workspaces group by plan) t),
    'integrations_attention',(select count(*) from public.utm_integrations where status<>'connected'),
    'webhook_errors',(select count(*) from public.utm_webhook_logs where status='invalid' and received_at>=v_7d and not is_test),
    'capi_failed',v_capi_failed,
    'open_tickets',(select count(*) from public.utm_admin_tickets where status<>'resolved'),
    'events_today',(select count(*) from public.utm_events where created_at>=v_today),
    'sales_30d',(select count(*) from public.utm_sales where occurred_at>=v_30d and not is_test)
  );
end;
$$;
