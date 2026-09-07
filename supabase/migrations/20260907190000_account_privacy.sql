-- Account deletion is intentionally server-only: the caller is authenticated
-- by the application and service_role invokes this transaction.
create or replace function public.utm_delete_account_data(p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_user is null then
    raise exception 'User is required';
  end if;

  delete from public.utm_push_subscriptions
   where user_id = p_user
      or workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_oauth_states
   where user_id = p_user
      or workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_capi_outbox
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_capi_logs
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_alerts
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_alert_rules
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_funnel_diagnostics
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_funnels
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_events
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_pixels
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_webhook_logs
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_sales
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_ad_entities
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_insights
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_credentials
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_integrations
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_links
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_offers
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user);
  delete from public.utm_members
   where workspace_id in (select id from public.utm_workspaces where owner_id = p_user)
      or user_id = p_user;
  delete from public.utm_workspaces where owner_id = p_user;
end;
$$;

revoke all on function public.utm_delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.utm_delete_account_data(uuid) to service_role;
