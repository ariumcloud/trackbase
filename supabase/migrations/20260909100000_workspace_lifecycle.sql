-- Deletes one owned workspace and every record that belongs exclusively to it.
-- The caller is verified again here so a server action cannot delete another
-- member's operation merely by knowing its UUID.
create or replace function public.utm_delete_workspace(p_user uuid, p_workspace uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_user is null or p_workspace is null then raise exception 'Workspace inválido'; end if;
  if not exists(select 1 from public.utm_workspaces where id=p_workspace and owner_id=p_user) then
    raise exception 'Somente o proprietário pode excluir este workspace';
  end if;

  delete from public.utm_push_subscriptions where workspace_id=p_workspace;
  delete from public.utm_oauth_states where workspace_id=p_workspace;
  delete from public.utm_capi_outbox where workspace_id=p_workspace;
  delete from public.utm_capi_logs where workspace_id=p_workspace;
  delete from public.utm_alerts where workspace_id=p_workspace;
  delete from public.utm_alert_rules where workspace_id=p_workspace;
  delete from public.utm_funnel_diagnostics where workspace_id=p_workspace;
  delete from public.utm_funnels where workspace_id=p_workspace;
  delete from public.utm_events where workspace_id=p_workspace;
  delete from public.utm_pixels where workspace_id=p_workspace;
  delete from public.utm_shields where workspace_id=p_workspace;
  delete from public.utm_webhook_logs where workspace_id=p_workspace;
  delete from public.utm_sales where workspace_id=p_workspace;
  delete from public.utm_ad_entities where workspace_id=p_workspace;
  delete from public.utm_insights where workspace_id=p_workspace;
  delete from public.utm_meta_action_logs where workspace_id=p_workspace;
  delete from public.utm_credentials where workspace_id=p_workspace;
  delete from public.utm_integrations where workspace_id=p_workspace;
  delete from public.utm_links where workspace_id=p_workspace;
  delete from public.utm_offers where workspace_id=p_workspace;
  delete from public.utm_members where workspace_id=p_workspace;
  delete from public.utm_workspaces where id=p_workspace and owner_id=p_user;
end;
$$;
revoke all on function public.utm_delete_workspace(uuid,uuid) from public, anon, authenticated;
grant execute on function public.utm_delete_workspace(uuid,uuid) to service_role;
