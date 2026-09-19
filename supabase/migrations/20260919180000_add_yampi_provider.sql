-- Allow Yampi as a valid payment provider in integrations and sales
alter table public.utm_integrations drop constraint if exists utm_integrations_provider_check;
alter table public.utm_integrations add constraint utm_integrations_provider_check
  check (provider in ('meta','hotmart','kiwify','cakto','kirvano','eduzz','monetizze','wiapy','lowfy','greenn','stripe','google','yampi'));

alter table public.utm_sales drop constraint if exists utm_sales_provider_check;
alter table public.utm_sales add constraint utm_sales_provider_check
  check (provider in ('meta','hotmart','kiwify','cakto','kirvano','eduzz','monetizze','wiapy','lowfy','greenn','stripe','google','yampi'));

-- Update utm_process_payment to include Yampi
create or replace function public.utm_process_payment(p_integration uuid, p_payment jsonb)
returns text language plpgsql set search_path='' as $$
declare
  i public.utm_integrations;
  log_id uuid;
  v_prod_type text;
  v_gross numeric;
  v_fee numeric;
  v_net numeric;
  v_currency text;
  v_fee_currency text;
  v_net_currency text;
begin
  select * into strict i
    from public.utm_integrations
   where id=p_integration and provider in ('hotmart','kiwify','cakto','kirvano','eduzz','monetizze','wiapy','lowfy','greenn','stripe','yampi')
   for update;

  if p_payment->>'product_id' is distinct from i.external_product_id
     or (i.external_offer_id is not null and p_payment->>'external_offer_id' is distinct from i.external_offer_id) then
    raise exception 'Product mismatch';
  end if;

  insert into public.utm_webhook_logs(workspace_id,integration_id,event_id,status,payment,is_test)
  values(i.workspace_id,i.id,p_payment->>'event_id','received',p_payment,coalesce((p_payment->>'is_test')::boolean, false))
  on conflict(integration_id,event_id) do nothing returning id into log_id;

  if log_id is null then
    -- This is a replay of a previously processed event. Re-open its log so
    -- the normalized payload can be applied again without creating a second
    -- sale row.
    select id into log_id
      from public.utm_webhook_logs
     where integration_id=i.id and event_id=p_payment->>'event_id'
     for update;
    if log_id is null then return 'duplicate'; end if;
    update public.utm_webhook_logs
       set status='received', payment=p_payment,
           is_test=coalesce((p_payment->>'is_test')::boolean, false),
           reason=null, received_at=now()
     where id=log_id;
  end if;

  v_prod_type := coalesce(p_payment->>'product_type', 'main');
  v_gross := coalesce((p_payment->>'gross_amount')::numeric, (p_payment->>'amount')::numeric, 0);
  v_fee := coalesce((p_payment->>'fee_amount')::numeric, 0);
  v_net := coalesce((p_payment->>'net_amount')::numeric, v_gross - v_fee);
  v_currency := p_payment->>'currency';
  v_fee_currency := coalesce(nullif(p_payment->>'fee_currency', ''), v_currency);
  v_net_currency := coalesce(nullif(p_payment->>'net_currency', ''), v_currency);

  insert into public.utm_sales(
    workspace_id, integration_id, offer_id, transaction_id, provider, status,
    amount, currency, country, attribution, occurred_at, is_test,
    product_type, parent_transaction_id, gross_amount, fee_amount, fee_currency,
    net_amount, net_currency
  )
  values(
    i.workspace_id, i.id, i.offer_id, p_payment->>'transaction_id', i.provider, p_payment->>'status',
    v_gross, v_currency, p_payment->>'country', coalesce(p_payment->'attribution', '{}'::jsonb),
    (p_payment->>'occurred_at')::timestamptz, coalesce((p_payment->>'is_test')::boolean, false),
    v_prod_type, p_payment->>'parent_transaction_id', v_gross, v_fee, v_fee_currency,
    v_net, v_net_currency
  )
  on conflict(integration_id, transaction_id, product_type, is_test) do update set
    status = case
      when excluded.occurred_at > utm_sales.occurred_at
        or (excluded.occurred_at = utm_sales.occurred_at and excluded.status in ('refunded','chargeback','canceled'))
      then excluded.status else utm_sales.status end,
    amount = excluded.amount,
    gross_amount = excluded.gross_amount,
    fee_amount = case
      when utm_sales.fee_currency is distinct from utm_sales.currency
       and excluded.fee_currency = excluded.currency
      then utm_sales.fee_amount else excluded.fee_amount end,
    fee_currency = case
      when utm_sales.fee_currency is distinct from utm_sales.currency
       and excluded.fee_currency = excluded.currency
      then utm_sales.fee_currency else excluded.fee_currency end,
    net_amount = case
      when utm_sales.net_currency is distinct from utm_sales.currency
       and excluded.net_currency = excluded.currency
      then utm_sales.net_amount else excluded.net_amount end,
    net_currency = case
      when utm_sales.net_currency is distinct from utm_sales.currency
       and excluded.net_currency = excluded.currency
      then utm_sales.net_currency else excluded.net_currency end,
    currency = excluded.currency,
    country = coalesce(nullif(excluded.country, ''), utm_sales.country),
    attribution = case
      when coalesce(excluded.attribution, '{}'::jsonb) = '{}'::jsonb then coalesce(utm_sales.attribution, '{}'::jsonb)
      when coalesce(utm_sales.attribution, '{}'::jsonb) = '{}'::jsonb then excluded.attribution
      else coalesce(utm_sales.attribution, '{}'::jsonb) || excluded.attribution
    end,
    occurred_at = case
      when excluded.occurred_at > utm_sales.occurred_at then excluded.occurred_at
      else utm_sales.occurred_at end,
    parent_transaction_id = coalesce(excluded.parent_transaction_id, utm_sales.parent_transaction_id)
  where excluded.occurred_at > utm_sales.occurred_at
     or (excluded.occurred_at = utm_sales.occurred_at and excluded.status in ('refunded','chargeback','canceled'))
     or (excluded.country is not null and excluded.country is distinct from utm_sales.country)
     or (coalesce(excluded.attribution, '{}'::jsonb) <> '{}'::jsonb and coalesce(excluded.attribution, '{}'::jsonb) is distinct from utm_sales.attribution);

  update public.utm_webhook_logs
     set status='processed', payment=p_payment,
         is_test=coalesce((p_payment->>'is_test')::boolean, false), reason=null
   where id=log_id;
  update public.utm_integrations set status='connected' where id=i.id;
  return 'processed';
end;
$$;

revoke all on function public.utm_process_payment(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.utm_process_payment(uuid,jsonb) to service_role;
