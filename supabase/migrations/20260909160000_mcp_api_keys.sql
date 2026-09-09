-- Migration for Trackbase MCP Server and API Keys
create table if not exists public.utm_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Claude / Codex MCP',
  key_hash text not null unique,
  key_prefix text not null,
  permissions text[] not null default '{"read","write"}',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(workspace_id, id)
);

create index if not exists utm_api_keys_hash_idx on public.utm_api_keys(key_hash) where revoked_at is null;
create index if not exists utm_api_keys_workspace_idx on public.utm_api_keys(workspace_id, created_at desc);

alter table public.utm_api_keys enable row level security;

create policy "Workspace members can view API keys" on public.utm_api_keys
  for select using (
    exists (
      select 1 from public.utm_members
      where utm_members.workspace_id = utm_api_keys.workspace_id
      and utm_members.user_id = auth.uid()
    )
  );

create policy "Workspace admins can insert API keys" on public.utm_api_keys
  for insert with check (
    exists (
      select 1 from public.utm_members
      where utm_members.workspace_id = utm_api_keys.workspace_id
      and utm_members.user_id = auth.uid()
      and utm_members.role in ('owner', 'admin')
    )
  );

create policy "Workspace admins can update/revoke API keys" on public.utm_api_keys
  for update using (
    exists (
      select 1 from public.utm_members
      where utm_members.workspace_id = utm_api_keys.workspace_id
      and utm_members.user_id = auth.uid()
      and utm_members.role in ('owner', 'admin')
    )
  );
