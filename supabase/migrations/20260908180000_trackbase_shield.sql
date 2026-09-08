-- UTMLiso Migration 20260908180000: Trackbase Shield (Zero-Redirect, Gray Page & Datacenter Detection)

create table if not exists public.utm_shields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
  offer_id uuid not null,
  name text not null check (length(trim(name)) > 0 and length(name) <= 100),
  slug text not null check (slug ~ '^[a-z0-9\-_]{3,64}$'),
  white_url text not null check (white_url ~ '^https?://'),
  gray_url text not null check (gray_url ~ '^https?://'),
  black_url text not null check (black_url ~ '^https?://'),
  require_click_id boolean not null default true,
  block_datacenters boolean not null default true,
  block_unknown_user_agents boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint utm_shields_slug_unique unique (slug),
  foreign key (workspace_id, offer_id) references public.utm_offers(workspace_id, id) on delete cascade
);

create table if not exists public.utm_shield_logs (
  id uuid primary key default gen_random_uuid(),
  shield_id uuid not null references public.utm_shields(id) on delete cascade,
  workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
  verdict text not null check (verdict in ('white', 'gray', 'black')),
  reason text not null check (length(reason) <= 100),
  ip_masked text,
  is_datacenter boolean not null default false,
  user_agent text,
  referer text,
  created_at timestamptz not null default now()
);

create index if not exists utm_shields_workspace_idx on public.utm_shields(workspace_id);
create index if not exists utm_shields_slug_idx on public.utm_shields(slug);
create index if not exists utm_shield_logs_shield_idx on public.utm_shield_logs(shield_id, created_at desc);
create index if not exists utm_shield_logs_workspace_idx on public.utm_shield_logs(workspace_id, created_at desc);

alter table public.utm_shields enable row level security;
alter table public.utm_shield_logs enable row level security;

revoke all on public.utm_shields, public.utm_shield_logs from anon, authenticated;
grant all on public.utm_shields, public.utm_shield_logs to service_role;
grant select, insert, update, delete on public.utm_shields to authenticated;
grant select on public.utm_shield_logs to authenticated;

drop policy if exists member_read on public.utm_shields;
create policy member_read on public.utm_shields for select to authenticated
  using (utm_private.member(workspace_id));

drop policy if exists member_write on public.utm_shields;
create policy member_write on public.utm_shields for insert to authenticated
  with check (utm_private.member(workspace_id, true));

drop policy if exists member_update on public.utm_shields;
create policy member_update on public.utm_shields for update to authenticated
  using (utm_private.member(workspace_id, true))
  with check (utm_private.member(workspace_id, true));

drop policy if exists member_delete on public.utm_shields;
create policy member_delete on public.utm_shields for delete to authenticated
  using (utm_private.member(workspace_id, true));

drop policy if exists member_read on public.utm_shield_logs;
create policy member_read on public.utm_shield_logs for select to authenticated
  using (utm_private.member(workspace_id));
