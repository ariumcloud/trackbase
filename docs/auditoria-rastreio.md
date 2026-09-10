# Auditoria de rastreamento — 2026-09-10

## Baseline e limites

Branch `main`, working tree inicialmente limpo. Nenhum AGENTS.md encontrado no repositório ou diretório pai. Lidos scripts de teste e docs/IMPLEMENTACAO.md. Node 24 do runtime existente; nenhuma dependência instalada.

Baseline: `npm test -- --runInBand`: 80/80; o runner Node ignora o argumento de Jest. `npm run test:db`: aprovado; `npm run lint`: 0 erros e 14 avisos; `npm run build`: aprovado (VAPID não configurado); `npm audit --omit=dev`: 0 vulnerabilidades.

Produção: **não verificado**. O conector disponível lista Arium e Saas-cabanas; não há referência local de projeto Supabase que identifique inequivocamente Trackbase. Nenhuma consulta a dados de clientes executada. A venda relatada, cron efetivamente ativo, 21 pendências, ausência de logs e drift remoto não foram confirmados.

## Diagnóstico inicial

| Severidade | Evidência local / causa |
| --- | --- |
| P0 potencial | `attribution.ts` permite join por fbp (identificador de navegador, não clique), mistura eventos sem corte temporal; campanha resolve no cliente. |
| P1 | `utm_track_event` insere evento sem event_id/unique; outbox deduplica, métrica própria não. |
| P1 | `public/tracker.js` usa chave global sem TTL, mistura UTMs de visitas e trata todo link da mesma origem como checkout. |
| P1 | `sendBeacon` não confirma persistência; fallback fetch descarta falhas. |
| P1 | webhook chama CAPI diretamente e ignora exceções; Chargeback não é enfileirado. |
| P1 | `capi.ts` escolhe pixels[0], usa Date.now e ignora erros de leitura/gravação de log. |
| P1 | sync manual marca erro desconhecido como connected; cron não usa effective_status/start_time. |
| P1 | `utm_commit_meta_sync` apaga janela inteira antes de gravar resposta, inclusive vazia. |
| P1 | não existe vercel.json; logs CAPI existem em migração local, existência remota não verificada. |
| P2 | painel já paraleliza consultas, mas pagina até 1 milhão de linhas e usa buffer temporal de 24h. |

## Fluxo real antes da correção

| Etapa / arquivo | Entrada → saída e persistência | Erros, perda, duplicação e atribuição |
| --- | --- | --- |
| Landing: public/tracker.js e src/app/tracker.js/route.ts | data-key/URL → evento e localStorage/sessionStorage | Duas cópias; cache longo; chave global; exceções ocultas. |
| Checkout: public/tracker.js | click em A → URL decorada sck/xcod/src | Botões/formulários sem cobertura; navegação interna contada como checkout. |
| Coleta: src/app/api/track/route.ts | JSON → utm_track_event → utm_events/outbox | RPC atômica mas eventos sem dedup; fallback workspace escolhe primeira oferta. |
| Gateway: src/lib/payment-adapters.ts | webhook → contrato normalizado | Campos fora de tracking ignorados; Hotmart prioriza criação da notificação sobre aprovação. |
| Webhook: src/app/api/webhooks/[provider]/[integration]/route.ts | payload autenticado → utm_process_payment → utm_sales/logs | Idempotência de venda existe; replay reabre logs; CAPI direta pode perder envio. |
| Atribuição: src/lib/attribution.ts, campaigns-view.tsx | UTMs/referências + eventos → mapa no cliente | Não persistida, sem tempo, fbp indevido, mistura de visitas. |
| CAPI: src/lib/capi-outbox.ts, capi.ts | ciphertext → Graph → log/status | Retry existe para PV/IC; recuperação de lease pode ultrapassar limite; updates sem checar erro. |
| Meta: api/meta/sync, api/cron/sync | insights/entidades → utm_commit_meta_sync | Aliases Purchase incompletos; divergência manual/cron; snapshot apagado. |
| Painel: app/painel/page.tsx | consultas por workspace → componentes | Promise.all já usado; falhas e paginação precisam revisão; Meta e tracker têm coberturas distintas. |

## Correções aplicadas localmente

- `public/tracker.js` agora isola armazenamento por origem/chave, aplica TTL de 30 dias, mantém sessão estável, rejeita macros não resolvidos, observa links, botões, formulários e navegação via History API, e mantém fila com retry.
- `src/lib/attribution.ts` remove `fbp` como chave de clique, aplica corte temporal, detecta ambiguidade e retorna origem, confiança e motivo. Sem correspondência única, o resultado é `none`.
- O webhook Hotmart (e demais adaptadores pelo mesmo caminho) reconcilia tracking no servidor, persiste evidência de atribuição e coloca Purchase/Refund/Chargeback em outbox durável.
- A CAPI valida erros de leitura/gravação, usa o horário real do evento, seleciona pixel específico da oferta e suporta Chargeback. A outbox reaproveita esse timestamp.
- Sync manual e cron reconhecem aliases de Purchase/InitiateCheckout, preservam snapshot quando a resposta é vazia/parcial e classificam erro como `sync_error`/`rate_limited`/`token_expired`/`permission_insufficient`.
- `utm_track_event` passou a exigir sessão, aceitar os tipos de evento separados e deduplicar por workspace/oferta/event_id/tipo. `utm_sales` guarda origem, confiança, motivo e sessão.
- O cron foi versionado em `vercel.json` (`/api/cron/sync`, diário às 03:00 UTC). A execução efetiva depende de deploy e `CRON_SECRET`, portanto permanece não verificada.

## Migrations criadas (não aplicadas em produção)

- `supabase/migrations/20260910161109_tracking_reliability_audit.sql` — marcador gerado pelo CLI; não contém alteração.
- `supabase/migrations/20260910190000_tracking_reliability_finalize.sql` — contrato final aditivo: deduplicação de eventos, tipos, índices, metadados de atribuição, timestamp da outbox e RPC de sync/eventos endurecidas.

Antes de aplicar, revisar a ordem com `supabase migration list` no projeto correto e executar em staging. Não foi possível identificar com segurança o projeto Supabase do Trackbase no conector disponível.

## Validação executada

- `npm test -- --runInBand`: **80/80 aprovados**.
- `npm run test:db`: **aprovado**.
- `npx tsc --noEmit`: **aprovado**.
- `npm run lint`: **aprovado**, 18 avisos preexistentes/legados e nenhum erro.
- `npm run build`: **aprovado**; avisos informam apenas VAPID ausente e compatibilidade do SDK.
- `npm audit --omit=dev`: **0 vulnerabilidades**.
- Smoke de produção, execução real do cron, estado do Supabase remoto e compra real: **não verificados** (intencionalmente não executados).

## Riscos e próximos passos manuais

O HTML da Meta e URLs de mídia continuam sujeitos a mudanças; os seletores da extensão devem ser mantidos isolados. URLs de mídia são armazenadas como referência, sem cópia binária. A atribuição não tenta adivinhar quando há múltiplos criativos candidatos. Após publicar, configurar/verificar `CRON_SECRET`, observar a primeira execução do cron e aplicar a migration somente após revisão do drift no Supabase correto. Nenhuma alteração SQL remota, dado de produção, credencial, deploy, commit ou push foi executado.
