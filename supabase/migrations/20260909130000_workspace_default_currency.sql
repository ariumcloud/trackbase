alter table public.utm_workspaces
  add column if not exists default_currency text not null default 'BRL'
  check (default_currency in ('BRL','USD','EUR','MXN','COP'));
