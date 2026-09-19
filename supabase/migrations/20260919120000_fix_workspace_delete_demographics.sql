-- utm_insights_demographics (added 2026-09-11) has no ON DELETE CASCADE back
-- to utm_integrations, and utm_delete_workspace's table list predates it --
-- deleting a workspace with any Meta demographic rows synced fails with a
-- foreign key violation. Same root cause already fixed for the two
-- integration-level delete paths in application code.
create or replace function public.utm_delete_workspace(p_user uuid, p_workspace uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  t text;
begin
  if p_user is null or p_workspace is null then raise exception 'Workspace inválido'; end if;
  if not exists(select 1 from public.utm_workspaces where id=p_workspace and owner_id=p_user) then
    raise exception 'Somente o proprietário pode excluir este workspace';
  end if;

  foreach t in array array[
    'utm_push_subscriptions', 'utm_oauth_states', 'utm_capi_outbox',
    'utm_capi_logs', 'utm_alerts', 'utm_alert_rules',
    'utm_funnel_diagnostics', 'utm_funnels', 'utm_events', 'utm_pixels',
    'utm_shields', 'utm_webhook_logs', 'utm_sales', 'utm_ad_entities',
    'utm_insights', 'utm_insights_demographics', 'utm_meta_action_logs',
    'utm_credentials', 'utm_integrations', 'utm_links', 'utm_offers',
    'utm_members'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I where workspace_id = $1', t) using p_workspace;
    end if;
  end loop;
  delete from public.utm_workspaces where id=p_workspace and owner_id=p_user;
end;
$$;
revoke all on function public.utm_delete_workspace(uuid,uuid) from public, anon, authenticated;
grant execute on function public.utm_delete_workspace(uuid,uuid) to service_role;
