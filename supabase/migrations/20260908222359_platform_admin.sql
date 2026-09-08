-- Platform administration is separate from workspace ownership and CRM roles.
create table public.utm_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.utm_platform_admins enable row level security;
revoke all on public.utm_platform_admins from public, anon, authenticated;
grant select on public.utm_platform_admins to authenticated;
grant all on public.utm_platform_admins to service_role;
create policy admin_self_read on public.utm_platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

create table public.utm_admin_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (length(subject) between 3 and 160),
  notes text not null check (length(notes) between 3 and 5000),
  status text not null default 'open' check (status in ('open','waiting','resolved')),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index utm_admin_tickets_user_idx on public.utm_admin_tickets(user_id,created_at desc);
create index utm_admin_tickets_status_idx on public.utm_admin_tickets(status,updated_at desc);
create table public.utm_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_id uuid not null,
  reason text not null check (length(reason) between 3 and 5000),
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);
create index utm_admin_audit_created_idx on public.utm_admin_audit(created_at desc);
do $$ declare t text; begin
  foreach t in array array['utm_admin_tickets','utm_admin_audit'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

-- Narrow DTO: never return auth tokens, passwords, provider credentials or CRM users.
create function public.utm_admin_directory(p_search text default '',p_page integer default 1)
returns jsonb language sql stable security invoker set search_path='' as $$
  with customers as (
    select u.id,u.email,u.created_at,u.last_sign_in_at,u.email_confirmed_at,
      left(coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',''),160) as name,
      left(coalesce(u.raw_user_meta_data->>'phone',u.phone,''),40) as phone,
      (select count(*) from public.utm_members m where m.user_id=u.id) as workspace_count
    from auth.users u
    where exists(select 1 from public.utm_members m where m.user_id=u.id)
       or u.raw_user_meta_data->>'app'='trackbase'
  ), filtered as (
    select * from customers where position(lower(left(coalesce(p_search,''),160)) in lower(coalesce(email,'')||' '||name||' '||id::text||' '||phone))>0
  ), paged as (
    select * from filtered order by created_at desc,id limit 25 offset ((greatest(1,least(coalesce(p_page,1),100000))-1)*25)
  ) select jsonb_build_object('total',(select count(*) from filtered),'users',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb));
$$;

create function public.utm_admin_overview()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_capi_failed bigint;
begin
  -- Older installations do not yet have the durable CAPI queue.
  if to_regclass('public.utm_capi_outbox') is not null then
    execute 'select count(*) from public.utm_capi_outbox where status=''failed''' into v_capi_failed;
  end if;
  return jsonb_build_object(
    'customers',(select count(*) from auth.users u where exists(select 1 from public.utm_members m where m.user_id=u.id) or u.raw_user_meta_data->>'app'='trackbase'),
    'new_customers',(select count(*) from auth.users u where u.created_at>=now()-interval '7 days' and (exists(select 1 from public.utm_members m where m.user_id=u.id) or u.raw_user_meta_data->>'app'='trackbase')),
    'active_customers',(select count(*) from auth.users u where u.last_sign_in_at>=now()-interval '30 days' and (exists(select 1 from public.utm_members m where m.user_id=u.id) or u.raw_user_meta_data->>'app'='trackbase')),
    'workspaces',(select count(*) from public.utm_workspaces),
    'plans',(select coalesce(jsonb_object_agg(plan,n),'{}'::jsonb) from (select plan,count(*) n from public.utm_workspaces group by plan) t),
    'integrations_attention',(select count(*) from public.utm_integrations where status<>'connected'),
    'webhook_errors',(select count(*) from public.utm_webhook_logs where status='invalid' and received_at>=now()-interval '7 days' and not is_test),
    'capi_failed',v_capi_failed,
    'open_tickets',(select count(*) from public.utm_admin_tickets where status<>'resolved'),
    'events_today',(select count(*) from public.utm_events where created_at>=date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),
    'sales_30d',(select count(*) from public.utm_sales where occurred_at>=now()-interval '30 days' and not is_test)
  );
end;
$$;

-- Change and audit commit together. Actor is supplied only by the authenticated server.
create function public.utm_admin_mutate(p_actor uuid,p_action text,p_target uuid,p_input jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare v_before jsonb; v_after jsonb; v_id uuid; v_reason text;
begin
  if not exists(select 1 from public.utm_platform_admins where user_id=p_actor) then
    raise exception 'Admin não autorizado';
  end if;
  v_reason := trim(coalesce(p_input->>'reason',''));
  if length(v_reason) not between 3 and 5000 then raise exception 'Informe o motivo'; end if;
  if p_action='plan' then
    if coalesce(p_input->>'plan','') not in ('devedor','liso','vorcaro') then raise exception 'Plano inválido'; end if;
    select jsonb_build_object('plan',plan) into v_before from public.utm_workspaces where id=p_target for update;
    if not found then raise exception 'Workspace não encontrado'; end if;
    update public.utm_workspaces set plan=p_input->>'plan' where id=p_target;
    v_after := jsonb_build_object('plan',p_input->>'plan');
  elsif p_action='ticket_create' then
    if not exists(select 1 from auth.users u where u.id=p_target and (exists(select 1 from public.utm_members m where m.user_id=u.id) or u.raw_user_meta_data->>'app'='trackbase')) then
      raise exception 'Cliente Trackbase não encontrado';
    end if;
    insert into public.utm_admin_tickets(user_id,subject,notes,priority,created_by)
      values(p_target,trim(p_input->>'subject'),v_reason,p_input->>'priority',p_actor) returning id into v_id;
    v_after := jsonb_build_object('ticket_id',v_id,'status','open','priority',p_input->>'priority');
  elsif p_action='ticket_status' then
    if coalesce(p_input->>'status','') not in ('open','waiting','resolved') then raise exception 'Status inválido'; end if;
    select jsonb_build_object('status',status) into v_before from public.utm_admin_tickets where id=p_target for update;
    if not found then raise exception 'Atendimento não encontrado'; end if;
    update public.utm_admin_tickets set status=p_input->>'status',updated_at=now() where id=p_target;
    v_after := jsonb_build_object('status',p_input->>'status');
  else raise exception 'Ação inválida'; end if;
  insert into public.utm_admin_audit(actor_id,action,target_id,reason,before_value,after_value)
    values(p_actor,p_action,p_target,v_reason,v_before,v_after);
end $$;
revoke all on function public.utm_admin_directory(text,integer),public.utm_admin_overview(),public.utm_admin_mutate(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.utm_admin_directory(text,integer),public.utm_admin_overview(),public.utm_admin_mutate(uuid,text,uuid,jsonb) to service_role;
