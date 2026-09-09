# Verificação da mineração de ofertas

Data da verificação: 2026-09-09. Ambiente de execução final: Node.js 24.19.0 do runtime local. O `package.json` exige Node.js 22 ou superior; o terminal padrão desta sessão expôs Node 20.20.2, por isso os comandos finais foram executados com o runtime Node 24 já instalado, sem instalar dependências.

## Arquivos criados

- `docs/MINERACAO.md`
- `docs/MINERACAO_VERIFICACAO.md`
- `extension/manifest.json`
- `extension/background.js`
- `extension/content.js`
- `extension/content.css`
- `extension/parser.js`
- `extension/popup.html`
- `extension/popup.js`
- `extension/popup.css`
- `scripts/verify-mining-browser.mjs`
- `src/app/api/mining/extension/route.ts`
- `src/app/api/mining/monitors/route.ts`
- `src/app/api/mining/monitors/[id]/history/route.ts`
- `src/app/api/mining/offers/route.ts`
- `src/app/api/mining/offers/[id]/route.ts`
- `src/app/api/mining/offers/[id]/history/route.ts`
- `src/app/api/mining/offers/[id]/analysis/route.ts`
- `src/components/mining-view.tsx`
- `src/components/mining.css`
- `src/lib/mining/schema.ts`
- `src/lib/mining/server.ts`
- `src/lib/assistant-transport.ts`
- `supabase/migrations/20260909115011_mining_library.sql`
- `tests/mining.test.ts`
- `tests/mining-endpoints.test.ts`
- `tests/mining-extension.test.ts`

A mineração e o Shield foram configurados no catálogo para o Plano Básico (`liso`) e permanecem disponíveis no Premium (`vorcaro`); o Free (`devedor`) recebe 403 no backend e não vê as áreas funcionais na interface.

## Arquivos alterados

- `src/components/dashboard.tsx`: navegação, título e montagem das três áreas da funcionalidade.
- `src/lib/plans.ts`: inclui a mineração no Plano Básico e mantém o Premium; Free continua sem acesso.
- `src/app/api/assistant/route.ts`: reutilização do transporte/resposta da Responses API, preservando o comportamento existente.
- `next.config.ts`: permite reprodução direta de mídia HTTPS capturada, sem proxy do Next Image.
- `eslint.config.mjs`: ignora diretórios `.next-*` temporários de verificação.
- `tests/push-worker.test.ts`: substitui `any` por tipos locais para que a suíte passe com a configuração atual de ESLint; comportamento do teste não mudou.
- `tests/payment-contract.test.ts`: atualiza o contrato de planos para verificar o acesso da mineração no Básico e no Premium.

`tsconfig.json` e `next-env.d.ts` foram regenerados durante uma build alternativa e restaurados ao conteúdo original; não fazem parte da mudança funcional.

## Migração

`supabase/migrations/20260909115011_mining_library.sql` é aditiva. Cria `utm_mined_offers`, `utm_mining_monitors`, `utm_mining_snapshots`, `utm_mining_changes`, `utm_mining_runs`, `utm_mining_analyses` e `utm_extension_grants`; índices; RLS; FKs compostas; as RPCs server-only `utm_mining_capture`, `utm_extension_redeem` e `utm_mining_failure`.

A migração não foi aplicada ao projeto Supabase remoto. Também não foi possível executar `supabase migration list --local` ou `supabase db lint --local`: o PostgreSQL local não está em execução em `127.0.0.1:54322` (Docker/Supabase local ausente). O teste PGlite aplica a migração e verifica suas políticas em memória.

## Resultados

| Verificação | Resultado |
| --- | --- |
| `npx tsc --noEmit` | PASS — sem erros de tipos, Node 24 |
| `npm test` | PASS — 65 testes, 65 aprovados |
| `npm run test:db` | PASS — suíte de banco existente aprovada |
| `npm run lint` | PASS — 0 erros; 3 avisos preexistentes em `campaigns-view.tsx`, `sales-notifier.tsx` e `sound.ts` |
| `npm run build` | PASS — build de produção concluído |
| `git diff --check` | PASS — sem whitespace inválido |
| Testes de mineração de banco | PASS — RLS, isolamento, duplicidade, snapshots, alterações, pausa, falha, filtros e resgate único |
| Testes de endpoints | PASS — sessão/bearer, workspace estrangeiro, token expirado/revogado, usuário ausente, viewer, payload e idempotência |
| Testes da extensão | PASS — MV3, sem segredo fixo, remetente, origem, storage de sessão, credencial não exposta, DOM dinâmico e duplicidade |
| Verificação browser `scripts/verify-mining-browser.mjs` | PASS — UI real (detalhes, vazio, erro, XSS como texto, pause/resume, responsivo), extensão carregada e cards dinâmicos; dados mockados |
| Manifesto MV3 | PASS — aberto pelo Chrome como “Load unpacked”; popup renderizado sem erro |
| Validação CLI da migração | BLOQUEADA — requer Docker/Postgres local, que não estava disponível |

O script browser opcional usa Playwright fornecido pelo runtime e um Chrome conectado por CDP; não adiciona dependência ao projeto. Ele deixou screenshots temporários fora do repositório em `C:\Users\guiii\AppData\Local\Temp`.

## Limitações conhecidas

- O monitoramento contínuo não foi prometido nem ativado. Não há executor cron/job para consultar a Biblioteca de terceiros; `next_check_at` permanece nulo e o usuário registra capturas visíveis pela extensão.
- Não foi adicionada uma chamada nova à Meta. A integração existente usa contas próprias/Business Manager; a cobertura de `ads_archive` não foi confirmada durante a auditoria.
- O parser depende dos textos/HTML que a Meta exibe e possui seletores isolados em `extension/parser.js`. Mudanças de idioma/estrutura exigem manutenção.
- Mídia é referenciada por URL temporária; não é copiada para o banco/storage e pode expirar.
- A análise de IA é textual/metadados, síncrona e pode ficar `failed` se o provedor estiver indisponível. Não declara ter visto a mídia.
- Nenhum teste usou sessão Supabase real, conta Meta real, resposta real de IA ou HTML de produção da Meta; essas validações exigem ambiente configurado e credenciais do usuário.

## Próximos passos necessários

1. Iniciar Docker/Supabase local ou usar uma branch de desenvolvimento e aplicar a migração após conferir a ordem com `supabase migration list`.
2. Executar smoke test autenticado: aprovar vínculo, salvar um anúncio real em dois workspaces, confirmar isolamento, editar, arquivar, excluir com confirmação, ativar/pausar e revogar.
3. Validar a extensão em variantes atuais PT/EN da Biblioteca da Meta e ajustar apenas `extension/parser.js` quando a estrutura mudar.
4. Antes de implementar monitoramento autônomo, confirmar oficialmente elegibilidade/permissões/cobertura da Meta e decidir o executor (cron/job) e limites do produto.
5. Se desejado, executar `supabase db lint --linked` na branch/ambiente autorizado antes de promover a migração.
