-- Allow PerfectPay, Cartpanda, Shopify, Ticto as valid payment providers in integrations and sales
alter table public.utm_integrations drop constraint if exists utm_integrations_provider_check;
alter table public.utm_integrations add constraint utm_integrations_provider_check
  check (provider in ('meta','hotmart','kiwify','cakto','kirvano','eduzz','monetizze','wiapy','lowfy','greenn','stripe','google','yampi','perfectpay','cartpanda','shopify','ticto'));

alter table public.utm_sales drop constraint if exists utm_sales_provider_check;
alter table public.utm_sales add constraint utm_sales_provider_check
  check (provider in ('meta','hotmart','kiwify','cakto','kirvano','eduzz','monetizze','wiapy','lowfy','greenn','stripe','google','yampi','perfectpay','cartpanda','shopify','ticto'));

-- Update utm_process_payment to include all payment providers
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
   where id=p_integration and provider in ('hotmart','kiwify','cakto','kirvano','eduzz','monetizze','wiapy','lowfy','greenn','stripe','yampi','perfectpay','cartpanda','shopify','ticto')
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
    workspace_id, integration_id, offer_id, provider, external_transaction_id,
    external_event_id, external_product_id, external_offer_id,
    product_type, parent_product_id, parent_transaction_id,
    amount, gross_amount, fee_amount, net_amount,
    currency, fee_currency, net_currency, country,
    customer_name, customer_email, status,
    occurred_at, is_test, raw_payload,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    campaign_id, adset_id, ad_id, creative_id, click_id
  )
  values (
    i.workspace_id, i.id, i.offer_id, i.provider, p_payment->>'external_transaction_id',
    p_payment->>'external_event_id', p_payment->>'product_id', p_payment->>'offer_id',
    v_prod_type, p_payment->>'parent_product_id', p_payment->>'parent_transaction_id',
    v_gross, v_gross, v_fee, v_net,
    v_currency, v_fee_currency, v_net_currency, p_payment->>'country',
    p_payment->'buyer'->>'name', p_payment->'buyer'->>'email', p_payment->>'type',
    (p_payment->>'occurred_at')::timestamptz, coalesce((p_payment->>'is_test')::boolean, false), p_payment,
    p_payment->'attribution'->>'utm_source', p_payment->'attribution'->>'utm_medium',
    p_payment->'attribution'->>'utm_campaign', p_payment->'attribution'->>'utm_content',
    p_payment->'attribution'->>'utm_term',
    p_payment->>'campaign_id', p_payment->>'adset_id', p_payment->>'ad_id',
    p_payment->>'creative_id', p_payment->>'click_id'
  )
  on conflict (integration_id, external_transaction_id, product_type) do update
    set status = excluded.status,
        amount = excluded.amount,
        gross_amount = excluded.gross_amount,
        fee_amount = excluded.fee_amount,
        net_amount = excluded.net_amount,
        currency = excluded.currency,
        fee_currency = excluded.fee_currency,
        net_currency = excluded.net_currency,
        raw_payload = excluded.raw_payload;

  update public.utm_webhook_logs
     set status = 'processed', processed_at = now()
   where id = log_id;

  return 'processed';
exception
  when others then
    if log_id is not null then
      update public.utm_webhook_logs
         set status = 'failed', reason = SQLERRM, processed_at = now()
       where id = log_id;
    end if;
    raise;
end;
$$;
