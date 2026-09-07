-- O plano Free precisa conseguir conectar a Meta para experimentar o rastreamento.
create or replace function utm_private.check_integration_limit()
returns trigger language plpgsql set search_path='' as $$
declare
  v_plan text;
  v_count integer;
  v_max integer;
begin
  select plan into v_plan from public.utm_workspaces where id = new.workspace_id;
  if new.provider = 'meta' then
    select count(*) into v_count
      from public.utm_integrations
     where workspace_id = new.workspace_id
       and provider = 'meta';
    v_max := case
      when v_plan in ('vorcaro', 'rico', 'classe_media') then 100
      when v_plan = 'liso' then 3
      else 1
    end;
    if v_count >= v_max then
      raise exception 'Limite de contas Meta Ads atingido para o plano do workspace.';
    end if;
  end if;
  return new;
end;
$$;
