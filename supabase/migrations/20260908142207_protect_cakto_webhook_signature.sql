-- Preserva o segredo do webhook cifrado para validar a assinatura HMAC da Cakto.
-- O hash continua existindo para integrações antigas e outros gateways.
alter table public.utm_credentials
  add column if not exists webhook_secret_ciphertext text;
