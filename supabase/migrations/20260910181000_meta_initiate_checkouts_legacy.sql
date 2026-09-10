-- Rows written before Meta IC was persisted must remain distinguishable from
-- a real zero returned by the API. This lets the UI keep its tracker fallback
-- until the next complete Meta synchronization.
alter table public.utm_insights
  alter column meta_initiate_checkouts drop default,
  alter column meta_initiate_checkouts drop not null;

update public.utm_insights
   set meta_initiate_checkouts = null
 where meta_initiate_checkouts = 0;
