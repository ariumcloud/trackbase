-- connectGatewayHub (src/app/actions.ts) inserts a "hub" row for
-- Hotmart/Kiwify/Cakto with offer_id and external_product_id both null (it
-- holds credentials only; each product is discovered later from its own
-- approved sale, per the parent_integration_id design added in
-- 20260911000000_integration_parent_for_product_autodiscovery.sql). The
-- original check constraint from 20260906021328_utmliso_mvp.sql requires
-- both to be non-null for every non-"meta" provider, so every hub-flow
-- connection attempt failed at the database with no code path ever
-- surfacing why. Relaxed to: both null (a hub, or "meta") or both set
-- together (a bound satellite/offer, same as before) -- never just one.
alter table public.utm_integrations
  drop constraint utm_integrations_check;

alter table public.utm_integrations
  add constraint utm_integrations_check
  check (provider = 'meta' or (offer_id is not null) = (external_product_id is not null));
