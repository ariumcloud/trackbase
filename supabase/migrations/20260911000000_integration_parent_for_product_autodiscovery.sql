-- Permite 1 "conexão" (credenciais + segredo de webhook) atender vários produtos
-- descobertos automaticamente na primeira venda aprovada de cada um, em vez de
-- exigir escolher o produto antes de conectar. A linha "hub" (parent_integration_id
-- null) guarda as credenciais; cada produto descoberto vira uma linha satélite
-- própria (offer_id, nome, moeda) ligada ao hub, reaproveitando as credenciais dele.
alter table public.utm_integrations
  add column parent_integration_id uuid references public.utm_integrations(id) on delete cascade;

create index utm_integrations_parent_idx on public.utm_integrations(parent_integration_id) where parent_integration_id is not null;
