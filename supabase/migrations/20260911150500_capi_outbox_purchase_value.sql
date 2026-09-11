-- processCapiOutbox (src/lib/capi-outbox.ts) never passed customData to
-- sendCapiEvent, so every Purchase/Refund/Chargeback CAPI event sent to Meta
-- carried no "value"/"currency" -- crippling value-based optimization and
-- ROAS reporting on Meta's side for every workspace using CAPI. The outbox
-- row enqueued in api/webhooks/[provider]/[integration]/route.ts never had
-- anywhere to put that amount either. Add the columns so the enqueue step
-- can record it and the outbox worker can forward it as custom_data.
alter table public.utm_capi_outbox
  add column if not exists value numeric,
  add column if not exists currency text;
