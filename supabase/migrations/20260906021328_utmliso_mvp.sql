-- UTMLiso: additive only. Does not touch CRM data, auth triggers or project settings.
create schema if not exists utm_private;
revoke all on schema utm_private from public, anon, authenticated;
grant usage on schema utm_private to authenticated, service_role;
create table public.utm_workspaces (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 100),
 owner_id uuid not null references auth.users(id), timezone text not null default 'America/Sao_Paulo',
 plan text not null default 'devedor' check(plan in ('devedor','liso','classe_media','rico')), created_at timestamptz not null default now()
);
create table public.utm_members (
 workspace_id uuid not null references public.utm_workspaces(id), user_id uuid not null references auth.users(id),
 role text not null check(role in ('owner','admin','viewer')), primary key(workspace_id,user_id)
);
create index utm_members_user_idx on public.utm_members(user_id);
-- Private helper avoids recursive membership policies; no externally supplied user ID.
create function utm_private.member(w uuid, writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.utm_members m where m.workspace_id=w and m.user_id=(select auth.uid()) and (not writing or m.role in ('owner','admin')));
$$;
revoke all on function utm_private.member(uuid,boolean) from public,anon;
grant execute on function utm_private.member(uuid,boolean) to authenticated;
create table public.utm_offers (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.utm_workspaces(id),
 name text not null check(length(name) between 2 and 120), landing_url text not null, currency text not null check(currency ~ '^[A-Z]{3}$'), active boolean not null default true,
 created_at timestamptz not null default now(), unique(workspace_id,id)
);
create table public.utm_links (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.utm_workspaces(id),offer_id uuid not null,
 name text not null, url text not null, params jsonb not null default '{}',active boolean not null default true,created_at timestamptz not null default now(),
 foreign key(workspace_id,offer_id) references public.utm_offers(workspace_id,id)
);
create table public.utm_integrations (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.utm_workspaces(id),offer_id uuid,
 provider text not null check(provider in ('meta','hotmart','cakto')),name text not null,status text not null default 'pending',
 external_product_id text,external_offer_id text,currency text check(currency ~ '^[A-Z]{3}$'),account_id text,account_timezone text,last_synced_at timestamptz,
 created_at timestamptz not null default now(),unique(workspace_id,id),foreign key(workspace_id,offer_id) references public.utm_offers(workspace_id,id),
 check(provider='meta' or (offer_id is not null and external_product_id is not null))
);
create table public.utm_credentials (
 integration_id uuid primary key,workspace_id uuid not null,token_ciphertext text,webhook_hash text,expires_at timestamptz,
 foreign key(workspace_id,integration_id) references public.utm_integrations(workspace_id,id)
);
create table public.utm_oauth_states (
 state_hash text primary key, workspace_id uuid not null references public.utm_workspaces(id),user_id uuid not null references auth.users(id),expires_at timestamptz not null
);
create table public.utm_webhook_logs (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,integration_id uuid not null,event_id text not null,
 status text not null check(status in ('received','processed','ignored','invalid')),reason text,payment jsonb,is_test boolean not null default false,
 received_at timestamptz not null default now(),unique(integration_id,event_id),foreign key(workspace_id,integration_id) references public.utm_integrations(workspace_id,id)
);
create table public.utm_sales (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,integration_id uuid not null,offer_id uuid not null,
 transaction_id text not null,provider text not null,status text not null,amount numeric(20,6) not null check(amount>=0),currency text check(currency ~ '^[A-Z]{3}$'),
 country text,attribution jsonb not null default '{}',occurred_at timestamptz not null,is_test boolean not null default false,
 unique(integration_id,transaction_id,is_test),foreign key(workspace_id,integration_id) references public.utm_integrations(workspace_id,id),
 foreign key(workspace_id,offer_id) references public.utm_offers(workspace_id,id)
);
create table public.utm_ad_entities (
 workspace_id uuid not null,integration_id uuid not null,external_id text not null,kind text not null check(kind in ('campaign','adset','ad')),
 parent_id text,name text not null,status text not null,primary key(integration_id,external_id),foreign key(workspace_id,integration_id) references public.utm_integrations(workspace_id,id)
);
create table public.utm_insights (
 workspace_id uuid not null,integration_id uuid not null,ad_id text not null,campaign_id text,adset_id text,day date not null,
 currency text not null,spend numeric(20,6) not null,impressions bigint not null,clicks bigint not null,reach bigint not null default 0,
 meta_purchases numeric not null default 0,meta_revenue numeric not null default 0,
 primary key(integration_id,ad_id,day),foreign key(workspace_id,integration_id) references public.utm_integrations(workspace_id,id)
);
create table public.utm_rate_buckets (key text primary key,window_start timestamptz not null,hits integer not null);

-- RLS even on server-only relations; no client grants on credentials, OAuth or limiter.
do $$ declare t text; begin foreach t in array array['utm_workspaces','utm_members','utm_offers','utm_links','utm_integrations','utm_credentials','utm_oauth_states','utm_webhook_logs','utm_sales','utm_ad_entities','utm_insights','utm_rate_buckets'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop; end $$;
grant select on public.utm_workspaces,public.utm_members,public.utm_integrations,public.utm_webhook_logs,public.utm_sales,public.utm_ad_entities,public.utm_insights to authenticated;
grant select,insert,update on public.utm_offers,public.utm_links to authenticated;
create policy workspace_read on public.utm_workspaces for select to authenticated using (utm_private.member(id));
create policy member_read on public.utm_members for select to authenticated using (utm_private.member(workspace_id));
do $$ declare t text; begin foreach t in array array['utm_offers','utm_links','utm_integrations','utm_webhook_logs','utm_sales','utm_ad_entities','utm_insights'] loop
 execute format('create policy member_read on public.%I for select to authenticated using (utm_private.member(workspace_id))',t);
 execute format('create index %I on public.%I(workspace_id)', t||'_workspace_idx',t);
 end loop;
 foreach t in array array['utm_offers','utm_links'] loop
 execute format('create policy member_insert on public.%I for insert to authenticated with check (utm_private.member(workspace_id,true))',t);
 execute format('create policy member_update on public.%I for update to authenticated using (utm_private.member(workspace_id,true)) with check (utm_private.member(workspace_id,true))',t);
 end loop; end $$;

-- Invoker RPCs are server-only. API authenticates the user before calling with service_role.
create function public.utm_create_workspace(p_user uuid,p_name text,p_timezone text) returns uuid language plpgsql set search_path='' as $$
 declare w uuid; begin
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
 insert into public.utm_workspaces(name,owner_id,timezone) values(p_name,p_user,p_timezone) returning id into w;
 insert into public.utm_members values(w,p_user,'owner');return w;end $$;
create function public.utm_rate_limit(p_key text,p_limit integer) returns boolean language plpgsql set search_path='' as $$
 declare n integer; begin
 delete from public.utm_rate_buckets where window_start<now()-interval '2 minutes';
 insert into public.utm_rate_buckets values(p_key,date_trunc('minute',now()),1)
 on conflict(key) do update set hits=case when utm_rate_buckets.window_start=excluded.window_start then utm_rate_buckets.hits+1 else 1 end,window_start=excluded.window_start returning hits into n;
 return n<=p_limit;end $$;
create function public.utm_process_payment(p_integration uuid,p_payment jsonb) returns text language plpgsql set search_path='' as $$
 declare i public.utm_integrations; log_id uuid; begin
 select * into strict i from public.utm_integrations where id=p_integration and provider in ('hotmart','cakto') for update;
 if p_payment->>'product_id' is distinct from i.external_product_id or (i.external_offer_id is not null and p_payment->>'external_offer_id' is distinct from i.external_offer_id) then raise exception 'Product mismatch'; end if;
 insert into public.utm_webhook_logs(workspace_id,integration_id,event_id,status,payment,is_test)
 values(i.workspace_id,i.id,p_payment->>'event_id','received',p_payment,(p_payment->>'is_test')::boolean)
 on conflict(integration_id,event_id) do nothing returning id into log_id;
 if log_id is null then
 select id into log_id from public.utm_webhook_logs where integration_id=i.id and event_id=p_payment->>'event_id' and status='received' for update;
 if log_id is null then return 'duplicate';end if;end if;
 insert into public.utm_sales(workspace_id,integration_id,offer_id,transaction_id,provider,status,amount,currency,country,attribution,occurred_at,is_test)
 values(i.workspace_id,i.id,i.offer_id,p_payment->>'transaction_id',i.provider,p_payment->>'status',(p_payment->>'amount')::numeric,p_payment->>'currency',p_payment->>'country',p_payment->'attribution',(p_payment->>'occurred_at')::timestamptz,(p_payment->>'is_test')::boolean)
 on conflict(integration_id,transaction_id,is_test) do update set status=excluded.status,amount=excluded.amount,currency=excluded.currency,country=excluded.country,attribution=excluded.attribution,occurred_at=excluded.occurred_at
 where excluded.occurred_at>utm_sales.occurred_at or (excluded.occurred_at=utm_sales.occurred_at and excluded.status in ('refunded','chargeback','canceled'));
 update public.utm_webhook_logs set status='processed' where id=log_id;
 update public.utm_integrations set status='connected' where id=i.id;return 'processed';end $$;
revoke all on function public.utm_create_workspace(uuid,text,text),public.utm_rate_limit(text,integer),public.utm_process_payment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.utm_create_workspace(uuid,text,text),public.utm_rate_limit(text,integer),public.utm_process_payment(uuid,jsonb) to service_role;
create unique index utm_one_account_per_workspace on public.utm_integrations(workspace_id,account_id) where provider='meta' and account_id is not null;
create function public.utm_commit_meta_sync(p_integration uuid,p_since date,p_until date,p_entities jsonb,p_insights jsonb) returns void language plpgsql set search_path='' as $$
 declare w uuid;begin
 select workspace_id into strict w from public.utm_integrations where id=p_integration and provider='meta' for update;
 if p_until<p_since or p_until-p_since>31 then raise exception 'Invalid interval';end if;
 delete from public.utm_insights where integration_id=p_integration and day between p_since and p_until;
 insert into public.utm_insights(workspace_id,integration_id,ad_id,campaign_id,adset_id,day,currency,spend,impressions,clicks,reach,meta_purchases,meta_revenue)
 select w,p_integration,r.ad_id,r.campaign_id,r.adset_id,r.day,r.currency,r.spend,r.impressions,r.clicks,r.reach,r.meta_purchases,r.meta_revenue
 from jsonb_to_recordset(p_insights) as r(ad_id text,campaign_id text,adset_id text,day date,currency text,spend numeric,impressions bigint,clicks bigint,reach bigint,meta_purchases numeric,meta_revenue numeric)
 where r.day between p_since and p_until;
 delete from public.utm_ad_entities where integration_id=p_integration;
 insert into public.utm_ad_entities(workspace_id,integration_id,external_id,kind,parent_id,name,status)
 select w,p_integration,r.external_id,r.kind,r.parent_id,r.name,r.status from jsonb_to_recordset(p_entities) as r(external_id text,kind text,parent_id text,name text,status text);
 update public.utm_integrations set last_synced_at=now(),status='connected' where id=p_integration;end $$;
revoke all on function public.utm_commit_meta_sync(uuid,date,date,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.utm_commit_meta_sync(uuid,date,date,jsonb,jsonb) to service_role;
