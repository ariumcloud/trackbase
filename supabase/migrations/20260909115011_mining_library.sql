-- Additive mining domain. Existing commercial offers and Meta integrations are untouched.
create table public.utm_mined_offers (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
 library_id text not null check(library_id ~ '^[0-9]{5,40}$'), advertiser text not null,
 library_url text not null, capture jsonb not null, days_active integer check(days_active >= 0),
 niche text not null default '', tags text[] not null default '{}', notes text not null default '',
 status text not null default 'saved' check(status in ('saved','reviewed','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), captured_at timestamptz not null default now(),
 unique(workspace_id,library_id), unique(workspace_id,id)
);
create index utm_mined_search on public.utm_mined_offers using gin(to_tsvector('simple',advertiser || ' ' || niche || ' ' || capture::text));
create index utm_mined_tags on public.utm_mined_offers using gin(tags);
create index utm_mined_order on public.utm_mined_offers(workspace_id,created_at desc);
create table public.utm_mining_monitors (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
 offer_id uuid, page_id text, label text not null,
 status text not null default 'active' check(status in ('active','paused')),
 execution_status text not null default 'awaiting_capture' check(execution_status in ('awaiting_capture','failed')),
 last_checked_at timestamptz, next_check_at timestamptz, last_error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((offer_id is null) <> (page_id is null)),
 foreign key(workspace_id,offer_id) references public.utm_mined_offers(workspace_id,id) on delete cascade,
 unique(workspace_id,offer_id), unique(workspace_id,page_id), unique(workspace_id,id)
);
create table public.utm_mining_snapshots (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, offer_id uuid not null,
 capture jsonb not null, captured_at timestamptz not null default now(), source text not null default 'extension' check(source='extension'),
 foreign key(workspace_id,offer_id) references public.utm_mined_offers(workspace_id,id) on delete cascade,
 unique(workspace_id,id)
);
create table public.utm_mining_changes (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, offer_id uuid not null,
 snapshot_id uuid not null, previous_snapshot_id uuid, differences jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(workspace_id,offer_id) references public.utm_mined_offers(workspace_id,id) on delete cascade,
 foreign key(workspace_id,snapshot_id) references public.utm_mining_snapshots(workspace_id,id) on delete cascade,
 foreign key(workspace_id,previous_snapshot_id) references public.utm_mining_snapshots(workspace_id,id)
);
create table public.utm_mining_runs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, monitor_id uuid not null,
 offer_id uuid, status text not null check(status in ('observed','failed')), error text,
 created_at timestamptz not null default now(),
 foreign key(workspace_id,monitor_id) references public.utm_mining_monitors(workspace_id,id) on delete cascade,
 foreign key(workspace_id,offer_id) references public.utm_mined_offers(workspace_id,id) on delete cascade
);
create table public.utm_mining_analyses (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, offer_id uuid not null,
 status text not null check(status in ('running','completed','failed')), result jsonb, error text,
 input_capture jsonb not null, model text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,offer_id) references public.utm_mined_offers(workspace_id,id) on delete cascade
);
create unique index utm_mining_analysis_running on public.utm_mining_analyses(workspace_id,offer_id) where status='running';
create table public.utm_extension_grants (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 challenge text not null unique check(challenge ~ '^[a-f0-9]{64}$'), token_hash text unique,
 status text not null default 'pending' check(status in ('pending','active','revoked')),
 expires_at timestamptz not null default now() + interval '5 minutes',
 created_at timestamptz not null default now(), revoked_at timestamptz,
 foreign key(workspace_id,user_id) references public.utm_members(workspace_id,user_id) on delete cascade
);
do $$ declare t text; begin
 foreach t in array array['utm_mined_offers','utm_mining_monitors','utm_mining_snapshots','utm_mining_changes','utm_mining_runs','utm_mining_analyses','utm_extension_grants'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create index on public.%I(workspace_id)',t);
  if t <> 'utm_extension_grants' then
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy member_read on public.%I for select to authenticated using(utm_private.member(workspace_id))',t);
  end if;
 end loop;
 foreach t in array array['utm_mined_offers','utm_mining_monitors'] loop
  execute format('grant insert,update,delete on public.%I to authenticated',t);
  execute format('create policy member_insert on public.%I for insert to authenticated with check(utm_private.member(workspace_id,true))',t);
  execute format('create policy member_update on public.%I for update to authenticated using(utm_private.member(workspace_id,true)) with check(utm_private.member(workspace_id,true))',t);
  execute format('create policy member_delete on public.%I for delete to authenticated using(utm_private.member(workspace_id,true))',t);
 end loop;
end $$;
create index on public.utm_mining_snapshots(workspace_id,offer_id,captured_at desc);
create index on public.utm_mining_changes(workspace_id,offer_id,created_at desc);
create index on public.utm_mining_analyses(workspace_id,offer_id,created_at desc);

-- Invoker functions callable only by the authorized server. Row locks serialize captures.
create function public.utm_mining_capture(p_workspace uuid,p_capture jsonb,p_snapshot boolean default false)
returns jsonb language plpgsql set search_path='' as $$
declare o public.utm_mined_offers; prior uuid; snap uuid; diff jsonb; duplicate boolean; begin
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text || ':' || (p_capture->>'library_id'),0));
 select * into o from public.utm_mined_offers where workspace_id=p_workspace and library_id=p_capture->>'library_id' for update;
 duplicate := found;
 if not duplicate then
  insert into public.utm_mined_offers(workspace_id,library_id,advertiser,library_url,capture,days_active)
  values(p_workspace,p_capture->>'library_id',p_capture->>'advertiser','https://www.facebook.com/ads/library/?id='||(p_capture->>'library_id'),p_capture,(p_capture->>'days_active')::integer) returning * into o;
 elsif not p_snapshot then
  return jsonb_build_object('offer',to_jsonb(o),'duplicate',true);
 end if;
 if p_snapshot and not exists(select 1 from public.utm_mining_monitors where workspace_id=p_workspace and status='active' and (offer_id=o.id or page_id=p_capture->>'page_id')) then
  raise exception 'Monitoramento não ativo.';
 end if;
 select id into prior from public.utm_mining_snapshots where workspace_id=p_workspace and offer_id=o.id order by captured_at desc,id desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('field',key,'before',o.capture->key,'after',value)),'[]'::jsonb) into diff
 from jsonb_each(p_capture) where o.capture->key is distinct from value;
 insert into public.utm_mining_snapshots(workspace_id,offer_id,capture) values(p_workspace,o.id,p_capture) returning id into snap;
 if duplicate and diff <> '[]'::jsonb then
  insert into public.utm_mining_changes(workspace_id,offer_id,snapshot_id,previous_snapshot_id,differences) values(p_workspace,o.id,snap,prior,diff);
 end if;
 update public.utm_mined_offers set capture=p_capture,advertiser=p_capture->>'advertiser',days_active=(p_capture->>'days_active')::integer,captured_at=now(),updated_at=now() where workspace_id=p_workspace and id=o.id returning * into o;
 if p_snapshot then
  insert into public.utm_mining_runs(workspace_id,monitor_id,offer_id,status)
  select p_workspace,id,o.id,'observed' from public.utm_mining_monitors where workspace_id=p_workspace and status='active' and (offer_id=o.id or page_id=p_capture->>'page_id');
  update public.utm_mining_monitors set last_checked_at=now(),last_error=null,execution_status='awaiting_capture',updated_at=now()
  where workspace_id=p_workspace and status='active' and (offer_id=o.id or page_id=p_capture->>'page_id');
 end if;
 return jsonb_build_object('offer',to_jsonb(o),'duplicate',duplicate,'snapshot_id',snap);
end $$;
create function public.utm_extension_redeem(p_challenge text,p_hash text) returns jsonb language plpgsql set search_path='' as $$
declare g public.utm_extension_grants; begin
 update public.utm_extension_grants set status='active',token_hash=p_hash,expires_at=now()+interval '24 hours'
 where challenge=p_challenge and status='pending' and expires_at>now()
 and exists(select 1 from public.utm_members m where m.workspace_id=utm_extension_grants.workspace_id and m.user_id=utm_extension_grants.user_id and m.role in ('owner','admin'))
 and exists(select 1 from public.utm_workspaces w where w.id=utm_extension_grants.workspace_id and w.plan in ('liso','vorcaro','classe_media','rico'))
 returning * into g;
 if not found then return null; end if;
 return jsonb_build_object('workspace_id',g.workspace_id,'expires_at',g.expires_at,'workspace_name',(select name from public.utm_workspaces where id=g.workspace_id));
end $$;
revoke all on function public.utm_mining_capture(uuid,jsonb,boolean),public.utm_extension_redeem(text,text) from public,anon,authenticated;
grant execute on function public.utm_mining_capture(uuid,jsonb,boolean),public.utm_extension_redeem(text,text) to service_role;
create function public.utm_mining_failure(p_workspace uuid,p_monitor uuid,p_reason text) returns void language plpgsql set search_path='' as $$
begin
 if p_reason not in ('capture_failed','insufficient_data','api_unavailable') then raise exception 'Invalid reason'; end if;
 update public.utm_mining_monitors set last_error=p_reason,execution_status='failed',updated_at=now()
 where workspace_id=p_workspace and id=p_monitor and status='active';
 if not found then raise exception 'Monitoramento não ativo.'; end if;
 insert into public.utm_mining_runs(workspace_id,monitor_id,status,error) values(p_workspace,p_monitor,'failed',p_reason);
end $$;
revoke all on function public.utm_mining_failure(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.utm_mining_failure(uuid,uuid,text) to service_role;
