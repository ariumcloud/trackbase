-- Lifetime gross revenue for the dashboard milestone badge.
-- Keep this aggregate in the database: the client should never download every
-- sale just to calculate a workspace-wide total.
create index if not exists utm_sales_lifetime_revenue_idx
  on public.utm_sales(workspace_id, currency)
  include (gross_amount, amount)
  where is_test = false
    and lower(trim(status)) in ('approved', 'paid', 'completed');

create or replace function public.utm_lifetime_revenue(p_workspace uuid)
returns table(currency text, gross_revenue numeric)
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is not null and not utm_private.member(p_workspace) then
    raise exception 'Workspace não autorizado';
  end if;

  return query
  select s.currency,
         sum(coalesce(nullif(s.gross_amount, 0), s.amount)) as gross_revenue
    from public.utm_sales s
   where s.workspace_id = p_workspace
     and lower(trim(s.status)) in ('approved', 'paid', 'completed')
     and s.is_test = false
     and s.currency is not null
   group by s.currency
   order by s.currency;
end;
$$;

revoke all on function public.utm_lifetime_revenue(uuid) from public, anon;
grant execute on function public.utm_lifetime_revenue(uuid) to authenticated, service_role;
