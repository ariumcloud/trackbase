-- Replaces the workspace deletion function with a migration-tolerant version.
-- It remains owner-only and only deletes tables already present in the project.
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
    'utm_insights', 'utm_meta_action_logs', 'utm_credentials',
    'utm_integrations', 'utm_links', 'utm_offers', 'utm_members'
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
