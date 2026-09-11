-- Quebra de idade/gênero da conta Meta (nível conta, não por anúncio, pra não
-- multiplicar o volume de utm_insights por combinação de faixa etária).
-- Alimenta o card "Demográficos" do Resumo com dado real em vez de vazio.
create table public.utm_insights_demographics (
  workspace_id uuid not null,
  integration_id uuid not null,
  day date not null,
  age text not null,
  gender text not null,
  currency text not null,
  spend numeric(20,6) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  primary key (integration_id, day, age, gender),
  foreign key (workspace_id, integration_id) references public.utm_integrations(workspace_id, id)
);

alter table public.utm_insights_demographics enable row level security;
revoke all on public.utm_insights_demographics from anon, authenticated;
grant all on public.utm_insights_demographics to service_role;
grant select on public.utm_insights_demographics to authenticated;
create policy member_read on public.utm_insights_demographics for select to authenticated
  using (utm_private.member(workspace_id));
create index utm_insights_demographics_workspace_idx on public.utm_insights_demographics(workspace_id);

-- utm_commit_meta_sync ganha um parâmetro opcional pra também reconciliar a
-- quebra demográfica no mesmo commit atômico do resto do snapshot Meta. Ao
-- contrário de insights/entidades, um array demográfico vazio NÃO derruba o
-- sync inteiro — contas com pouco gasto às vezes não retornam quebra por
-- idade/gênero, e isso não deve impedir o resto dos dados de serem salvos.
-- A assinatura antiga (5 parâmetros) precisa ser removida explicitamente:
-- como o novo parâmetro tem valor padrão, as duas coexistindo tornariam uma
-- chamada com 5 argumentos nomeados ambígua entre as duas sobrecargas.
drop function if exists public.utm_commit_meta_sync(uuid,date,date,jsonb,jsonb);
create or replace function public.utm_commit_meta_sync(
  p_integration uuid, p_since date, p_until date, p_entities jsonb, p_insights jsonb,
  p_demographics jsonb default '[]'::jsonb
) returns void language plpgsql set search_path='' as $$
declare w uuid; begin
  select workspace_id into strict w from public.utm_integrations
   where id=p_integration and provider='meta' for update;
  if p_until < p_since or p_until-p_since > 31 then raise exception 'Invalid interval'; end if;
  if jsonb_typeof(p_insights) <> 'array'
     or jsonb_array_length(case when jsonb_typeof(p_insights)='array' then p_insights else '[]'::jsonb end)=0
     or jsonb_typeof(p_entities) <> 'array'
     or jsonb_array_length(case when jsonb_typeof(p_entities)='array' then p_entities else '[]'::jsonb end)=0 then
    raise exception 'Empty or partial Meta snapshot';
  end if;
  delete from public.utm_insights where integration_id=p_integration and day between p_since and p_until;
  insert into public.utm_insights(workspace_id,integration_id,ad_id,campaign_id,adset_id,day,currency,spend,impressions,clicks,reach,meta_initiate_checkouts,meta_purchases,meta_revenue)
  select w,p_integration,r.ad_id,r.campaign_id,r.adset_id,r.day,r.currency,r.spend,r.impressions,r.clicks,r.reach,coalesce(r.meta_initiate_checkouts,0),r.meta_purchases,r.meta_revenue
  from jsonb_to_recordset(p_insights) as r(ad_id text,campaign_id text,adset_id text,day date,currency text,spend numeric,impressions bigint,clicks bigint,reach bigint,meta_initiate_checkouts numeric,meta_purchases numeric,meta_revenue numeric)
  where r.day between p_since and p_until;
  delete from public.utm_ad_entities where integration_id=p_integration;
  insert into public.utm_ad_entities(workspace_id,integration_id,external_id,kind,parent_id,name,status,budget_minor,budget_currency,budget_type,meta_created_at)
  select w,p_integration,r.external_id,r.kind,r.parent_id,r.name,r.status,r.budget_minor,r.budget_currency,r.budget_type,r.meta_created_at
  from jsonb_to_recordset(p_entities) as r(external_id text,kind text,parent_id text,name text,status text,budget_minor numeric,budget_currency text,budget_type text,meta_created_at timestamptz);
  delete from public.utm_insights_demographics where integration_id=p_integration and day between p_since and p_until;
  if jsonb_typeof(p_demographics) = 'array' and jsonb_array_length(p_demographics) > 0 then
    insert into public.utm_insights_demographics(workspace_id,integration_id,day,age,gender,currency,spend,impressions,clicks)
    select w,p_integration,r.day,r.age,r.gender,r.currency,r.spend,r.impressions,r.clicks
    from jsonb_to_recordset(p_demographics) as r(day date,age text,gender text,currency text,spend numeric,impressions bigint,clicks bigint)
    where r.day between p_since and p_until;
  end if;
  update public.utm_integrations set last_synced_at=now(),status='connected' where id=p_integration;
end $$;
revoke all on function public.utm_commit_meta_sync(uuid,date,date,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.utm_commit_meta_sync(uuid,date,date,jsonb,jsonb,jsonb) to service_role;
