-- Kirofy: Tabelas para Clonador de Funil e Diagnóstico de Funil com isolamento RLS
create table if not exists public.utm_funnels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
  offer_id uuid references public.utm_offers(id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  source_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version integer not null default 1,
  blocks jsonb not null default '[]'::jsonb,
  pixels jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.utm_funnels enable row level security;
grant select, insert, update, delete on public.utm_funnels to authenticated, service_role;

create policy member_read on public.utm_funnels for select to authenticated using (utm_private.member(workspace_id));
create policy member_insert on public.utm_funnels for insert to authenticated with check (utm_private.member(workspace_id, true));
create policy member_update on public.utm_funnels for update to authenticated using (utm_private.member(workspace_id, true)) with check (utm_private.member(workspace_id, true));
create policy member_delete on public.utm_funnels for delete to authenticated using (utm_private.member(workspace_id, true));

create index if not exists idx_utm_funnels_workspace on public.utm_funnels(workspace_id, created_at desc);
create index if not exists idx_utm_funnels_status on public.utm_funnels(workspace_id, status);

create table if not exists public.utm_funnel_diagnostics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
  offer_id uuid references public.utm_offers(id) on delete set null,
  url text,
  score integer not null check (score between 0 and 100),
  category_scores jsonb not null default '{}'::jsonb,
  bottlenecks jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.utm_funnel_diagnostics enable row level security;
grant select, insert, delete on public.utm_funnel_diagnostics to authenticated, service_role;

create policy member_read on public.utm_funnel_diagnostics for select to authenticated using (utm_private.member(workspace_id));
create policy member_insert on public.utm_funnel_diagnostics for insert to authenticated with check (utm_private.member(workspace_id, true));
create policy member_delete on public.utm_funnel_diagnostics for delete to authenticated using (utm_private.member(workspace_id, true));

create index if not exists idx_utm_funnel_diag_workspace on public.utm_funnel_diagnostics(workspace_id, created_at desc);
