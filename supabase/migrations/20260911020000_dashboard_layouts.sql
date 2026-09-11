-- Layout do canvas do Resumo (quais widgets aparecem e em que ordem), por
-- usuário dentro de cada workspace — cada pessoa customiza o próprio painel,
-- igual à UTMify. Guarda só a lista ordenada de ids de widget; o catálogo de
-- widgets em si (rótulo, categoria, componente) vive no código do frontend.
create table public.utm_dashboard_layouts (
  workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  widget_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.utm_dashboard_layouts enable row level security;
revoke all on public.utm_dashboard_layouts from anon;
grant all on public.utm_dashboard_layouts to service_role;
grant select, insert, update, delete on public.utm_dashboard_layouts to authenticated;

-- Cada pessoa só enxerga e mexe no próprio layout, e só dentro de um
-- workspace do qual ela realmente participa.
create policy own_read on public.utm_dashboard_layouts for select to authenticated
  using (user_id = auth.uid() and utm_private.member(workspace_id));
create policy own_write on public.utm_dashboard_layouts for all to authenticated
  using (user_id = auth.uid() and utm_private.member(workspace_id))
  with check (user_id = auth.uid() and utm_private.member(workspace_id));
