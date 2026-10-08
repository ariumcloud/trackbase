-- Durable inbox for authenticated webhooks whose processing failed. Cakto does
-- not retry non-2xx answers, so the route acknowledges and parks the payload
-- here; the cron replays it (utm_process_payment and the CAPI outbox are
-- idempotent, so a replay is safe).
create table if not exists public.utm_webhook_inbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
  integration_id uuid not null references public.utm_integrations(id) on delete cascade,
  provider text not null,
  payload_ciphertext text not null,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists utm_webhook_inbox_due_idx
  on public.utm_webhook_inbox(next_attempt_at) where status = 'pending';
alter table public.utm_webhook_inbox enable row level security;
-- No policies: only the service role touches this table.
