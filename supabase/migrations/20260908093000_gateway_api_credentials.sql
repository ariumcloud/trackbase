-- Credenciais de catálogo ficam criptografadas e nunca são expostas pelo Data API.
alter table public.utm_credentials
  add column if not exists api_credentials_ciphertext text;
