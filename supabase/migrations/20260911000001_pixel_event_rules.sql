-- Regras de evento por Pixel/CAPI (Lead, AddToCart, InitiateCheckout, Purchase),
-- no mesmo espírito do configurador da UTMify: cada regra decide QUANDO um
-- evento dispara (gatilho) e PARA ONDE ele vai (qual utm_pixels), sem exigir
-- código por oferta. Purchase continua também disparando automaticamente via
-- webhook do gateway — aqui ela é opcional, pra permitir silenciar/duplicar.
create table if not exists public.utm_pixel_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.utm_workspaces(id) on delete cascade,
  pixel_id uuid not null references public.utm_pixels(id) on delete cascade,
  offer_id uuid references public.utm_offers(id) on delete cascade,
  event_name text not null check (event_name in ('PageView', 'Lead', 'AddToCart', 'InitiateCheckout', 'Purchase')),
  trigger_type text not null check (trigger_type in ('page_load', 'url_contains', 'element_click', 'form_submit', 'checkout_url_match', 'gateway_webhook')),
  trigger_config jsonb not null default '{}'::jsonb,
  send_pixel boolean not null default true,
  send_capi boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, offer_id) references public.utm_offers(workspace_id, id)
);

create index if not exists utm_pixel_rules_pixel_idx on public.utm_pixel_rules(pixel_id) where enabled;
create index if not exists utm_pixel_rules_offer_idx on public.utm_pixel_rules(offer_id) where offer_id is not null;

alter table public.utm_pixel_rules enable row level security;

create policy member_read on public.utm_pixel_rules for select to authenticated using (utm_private.member(workspace_id));
create policy member_insert on public.utm_pixel_rules for insert to authenticated with check (utm_private.member(workspace_id, true));
create policy member_update on public.utm_pixel_rules for update to authenticated using (utm_private.member(workspace_id, true)) with check (utm_private.member(workspace_id, true));
create policy member_delete on public.utm_pixel_rules for delete to authenticated using (utm_private.member(workspace_id, true));

grant select, insert, update, delete on public.utm_pixel_rules to authenticated;
grant all on public.utm_pixel_rules to service_role;

-- Amplia o outbox de CAPI para os demais eventos do funil (hoje só PageView e
-- InitiateCheckout existiam). Lead/AddToCart chegam pelo tracker.js quando o
-- motor de detecção rodar; Purchase chega direto do webhook do gateway.
alter table public.utm_capi_outbox drop constraint if exists utm_capi_outbox_event_name_check;
alter table public.utm_capi_outbox add constraint utm_capi_outbox_event_name_check
  check (event_name in ('PageView', 'Lead', 'AddToCart', 'InitiateCheckout', 'Purchase'));
