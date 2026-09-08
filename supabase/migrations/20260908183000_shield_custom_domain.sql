-- UTMLiso Migration 20260908183000: Trackbase Shield Custom Domain (CNAME)

alter table public.utm_shields
  add column if not exists custom_domain text;

create unique index if not exists utm_shields_custom_domain_uidx
  on public.utm_shields (custom_domain)
  where custom_domain is not null;
