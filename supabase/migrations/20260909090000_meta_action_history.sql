-- Histórico imutável das ações de pausa/reativação disparadas pelo usuário.
create table if not exists public.utm_meta_action_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
  integration_id uuid not null,
  entity_id text not null,
  entity_kind text not null check (entity_kind in ('campaign','adset','ad')),
  requested_status text not null check (requested_status in ('ACTIVE','PAUSED')),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, integration_id) references public.utm_integrations(workspace_id,id)
);
create index if not exists utm_meta_action_logs_workspace_idx on public.utm_meta_action_logs(workspace_id, created_at desc);
alter table public.utm_meta_action_logs enable row level security;
revoke all on public.utm_meta_action_logs from anon, authenticated;
grant all on public.utm_meta_action_logs to service_role;

-- Keep database validation aligned with the providers exposed in the guided UI.
alter table public.utm_integrations drop constraint if exists utm_integrations_provider_check;
alter table public.utm_integrations add constraint utm_integrations_provider_check
  check (provider in ('meta','hotmart','kiwify','cakto','kirvano','eduzz','monetizze','wiapy','lowfy','greenn','stripe','google'));
alter table public.utm_sales drop constraint if exists utm_sales_provider_check;
alter table public.utm_sales add constraint utm_sales_provider_check
  check (provider in ('meta','hotmart','kiwify','cakto','kirvano','eduzz','monetizze','wiapy','lowfy','greenn','stripe','google'));
