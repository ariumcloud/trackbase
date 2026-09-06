# UTMLiso — implementação

## Inspeção antes de codificar
Referência: pedawfall1/arium-crm (package.json confirmado pelo GitHub), cópia local arium-crm-dev. Estudados lib/supabase/server.ts, lib/trafego/{metricas,atribuicao,pagamentos}.ts, lib/meta/client.ts e rotas OAuth/webhook.

Arium: Next 15, React 19, TypeScript, Tailwind 4, Supabase SSR. Há padrões úteis de cookies SSR, macros, última origem conhecida e adaptadores de pagamento. Configurações Meta globais, token único de webhook e consultas CRM sem workspace não podem ser reutilizados no SaaS. Nenhum arquivo ou tabela CRM será alterado.

Compartilhado conceitualmente: stack, fluxo OAuth, vocabulário de métricas e contratos dos provedores. Exclusivo: todo código deste repositório, identidade visual, autenticação com cookie próprio, tabelas utm_, políticas, endpoints, chaves de criptografia e configuração Meta. Supabase Auth poderá usar o mesmo projeto, mas associação a workspace é sempre explícita.

## Fases
1. MVP: autenticação, workspaces, ofertas, UTMs persistidas, OAuth/contas/sincronização Meta, webhooks Hotmart/Cakto, dashboard por moeda e RLS. Validar lint, build, contratos de webhook, cálculos, atribuição e isolamento. Homologação real exige configuração das contas dos provedores.
2. Pixel/CAPI, atribuição entre domínios autorizados, métricas líquidas, moedas/países, produtos adicionais e alertas.
3. Gargalos com evidências, telemetria, A/B, VSL e Jeen com consultas autorizadas.
4. Cobrança, aplicação dos limites comerciais, site, onboarding, exportações e agência.

Cada fase recebe commit próprio. Não usar fixtures como métricas reais. Credenciais nunca entram no Git. Integrações não configuradas devem aparecer como pendentes. Métricas indisponíveis não são zero.
