# Biblioteca de ofertas do Trackbase

## Escopo e arquitetura

A funcionalidade está disponível no **Plano Básico ou superior**. O backend consulta o plano do workspace em cada rota de mineração e a extensão também é bloqueada para workspaces Free. No catálogo atual, o Plano Básico é `liso`; o Premium (`vorcaro`) também inclui a funcionalidade. O plano nunca é aceito a partir do payload do navegador.

Entrada: **Painel → Biblioteca de ofertas**, com **Ofertas salvas**, **Monitoramento** e configuração da extensão. O vínculo também está em **Integrações e Pixels**. O workspace selecionado controla toda a área. Produtos de `utm_offers` continuam separados dos anúncios minerados.

A auditoria local identificou:

- Sessão Supabase SSR em `src/lib/supabase/server.ts`, cookie existente `utmliso-auth`, validação de usuário por `auth.getUser()`.
- Autorização por `authorize(workspace, write)` em `src/lib/security.ts`, membros `utm_members` e papéis `owner`, `admin`, `viewer`. Escrita exige owner/admin.
- RLS existente: `utm_private.member(workspace_id, writing)`. Reutilizada nas novas tabelas; vínculos e resultados derivados não são graváveis pela Data API autenticada.
- Meta em `src/lib/meta.ts`: Graph API configurável (padrão existente v23.0), contas próprias/compartilhadas via `me/adaccounts`, `me/businesses`, `owned_ad_accounts`, `client_ad_accounts`, insights e operações das campanhas. Escopos existentes: `ads_read,ads_management,business_management`. Não havia integração com `ads_archive`. Nenhum escopo, token, cron ou endpoint Meta existente foi alterado.
- IA existente: OpenAI Responses via `fetch`, `OPENAI_API_KEY`, `OPENAI_MODEL` e limite por workspace/usuário. Transporte extraído para `assistant-transport.ts` e compartilhado. Nenhum SDK novo. Respostas REST são lidas também pelos blocos `output[].content[]`.
- Banco usa prefixo `utm_`, relações compostas e RPCs invoker exclusivas do servidor. Auditoria administrativa existente é específica da plataforma; não foi reutilizada como se fosse auditoria de ações de membros. Capturas e verificações têm histórico próprio.
- Referência `pedawfall1/arium-crm`, commit `7512b11173ec7ff52f9c34f843874cb5bd037efb`: consultados manifesto, content script, background e rotas `mineracao/salvar` e `mineracao/snapshot`. O repositório estava privado, acessível pela conexão Git autorizada. Aproveitados conceitualmente ação no card, MutationObserver e snapshots. Não foram reutilizados segredo compartilhado, permissões globais obrigatórias, consultas sem autorização ou extração de scripts internos.

## Preparação

1. Use **Node 22+** conforme `package.json` (verificações feitas com Node 24.19.0 já instalado no ambiente).
2. Revise/aplique a migração aditiva `supabase/migrations/20260909115011_mining_library.sql` no ambiente de destino. **Ela não foi aplicada ao banco remoto nesta entrega.** O nome foi gerado pelo CLI instalado; o repositório contém migrações com horário posterior no mesmo dia. Confira a lista pendente antes de aplicar: um ambiente que já aplicou essas migrações posteriores pode exigir inclusão explícita da migração fora de ordem. Não faça reset nem reaplique migrações antigas.
3. Use as configurações existentes: Supabase URL/chave pública, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`; para IA, `OPENAI_API_KEY` e opcionalmente `OPENAI_MODEL`. Nenhuma dessas credenciais vai para a extensão.
4. Build e publicação seguem o processo atual. A única ampliação de CSP foi `media-src 'self' https:` para exibir vídeos capturados diretamente no navegador.

## Instalar e vincular a extensão

### Instalação no Google Chrome
1. Baixe o ZIP oficial do Trackbase (`trackbase-extension.zip`) disponível no painel em **Biblioteca de Ofertas** ou em `/downloads/trackbase-extension.zip`.
2. Extraia o conteúdo do arquivo ZIP em uma pasta dedicada no seu computador.
3. No Chrome, abra `chrome://extensions`.
4. Ative a chave **"Modo do desenvolvedor"** no canto superior direito.
5. Clique em **"Carregar sem compactação"** e selecione a pasta extraída da extensão. Não há etapa de build adicional.
6. Fixe o ícone da extensão Trackbase na barra de ferramentas do navegador para facilitar o acesso.

### Primeiro vínculo com o Workspace
1. Abra o popup da extensão, informe o endereço do Trackbase (padrão `https://trackbase.com.br`; subdomínios HTTPS ou `http://localhost:*` para desenvolvimento local) e clique em **"Iniciar vínculo"**.
2. A extensão solicita a permissão opcional exclusivamente para o domínio configurado e abre a aba do painel em `/painel?tab=mineracao` com o código (desafio PKCE) no fragmento da URL.
3. Faça login com sua conta normal do Trackbase e confirme o workspace ativo no painel.
4. Caso o código não seja preenchido automaticamente, copie o código do popup usando o botão **"Copiar"** e cole no campo **"Código de vínculo"** no painel.
5. Clique em **"Autorizar extensão neste workspace"** (o código temporário dura 5 minutos e só pode ser resgatado uma vez).
6. Volte ao popup da extensão e clique em **"Concluir vínculo"**.
7. O workspace de destino será automaticamente selecionado no popup com status "Conectado e ativo".
8. Para conectar workspaces adicionais, basta repetir o processo selecionando outro workspace no painel.

### Mineração na Biblioteca de Anúncios da Meta
1. Acesse a Biblioteca de Anúncios da Meta (`https://www.facebook.com/ads/library/`).
2. Pesquise por um anunciante, termo ou nicho de interesse.
3. Localize qualquer card de anúncio ativo; a barra de ferramentas do Trackbase é injetada automaticamente no rodapé do card.
4. Clique em **"Salvar no Trackbase"** para enviar a captura imediatamente ao workspace selecionado.
5. Acompanhe o status instantâneo ("Salvo no workspace selecionado" ou "Anúncio já salvo neste workspace").
6. Para ofertas ou páginas incluídas no monitoramento contínuo, utilize **"Registrar verificação"** para gerar um novo snapshot comparativo.

### Organização e Recursos no Trackbase
- **Ofertas salvas:** acesse a lista completa com filtros inteligentes por formato de anúncio, nicho, tags, status e dias ativos estimados.
- **Visualização de criativos:** reproduza vídeos e inspecione imagens capturadas diretamente na interface.
- **Análise estratégica com IA:** desconstrua o anúncio em gancho, promessa, mecanismo único, nível de consciência, prova social e hipóteses de longevidade.
- **Tags e anotações:** adicione tags personalizadas e notas estratégicas para o seu time.
- **Monitoramento contínuo:** configure rastreadores por anúncio ou página anunciante para auditar alterações de criativo ou pausas.
- **Histórico e snapshots:** consulte as diferenças estruturais registradas entre verificações.

### Solução de problemas frequentes
- **Código de autorização expirado:** o código de vinculação expira em 5 minutos. Caso expire antes de autorizar no painel, clique em "Iniciar vínculo" no popup para gerar um novo código.
- **Workspace não autorizado:** certifique-se de que o usuário possui permissão de Proprietário (Owner) ou Administrador (Admin) e que o workspace possui o Plano Básico (`liso`) ou superior. Workspaces no plano Free são bloqueados.
- **Anúncio sem dados suficientes:** a extensão captura estritamente os dados visíveis no DOM da página no instante da captura. Se a Meta não renderizou o anunciante ou o ID, clique em "Ver detalhes do anúncio" e salve a partir da visualização expandida.
- **Botão "Salvar" não aparece:** atualize a página da Meta (`F5`). O observador de mutações injeta os controles conforme os cards são renderizados no feed.
- **Extensão desatualizada:** em `chrome://extensions`, clique no botão de atualizar na extensão Trackbase para recarregar o content script.
- **Autorização revogada:** se o vínculo foi revogado no painel ou o navegador foi fechado, clique em "Esquecer vínculos neste navegador" e refaça a conexão em poucos segundos.
- **Página carregando dinamicamente:** aguarde a rolagem carregar novos blocos; o observador injeta os botões de forma não intrusiva.

O servidor só persiste hashes de desafio/credencial. A extensão armazena verifier e credenciais em `chrome.storage.session`, com acesso `TRUSTED_CONTEXTS`; o content script não lê esse storage. Referência: [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage). O worker valida remetente, página Meta e tipo de mensagem. A troca de domínio elimina vínculos anteriores. Chamadas usam `credentials: omit` e rejeitam redirecionamentos, evitando enviar bearer a outro destino. Não há CORS curinga: requisições do worker usam a permissão de host do Chrome, enquanto mutações por sessão exigem a origem do Trackbase.

O backend revalida usuário existente, vínculo ativo, expiração, workspace e papel de membro em cada requisição delegada. A extensão não pode editar/excluir ofertas, chamar IA, aprovar ou revogar vínculos usando seu bearer. Essas ações exigem a sessão normal.

## Dados e autorização

Tabelas novas:

| Tabela | Finalidade |
| --- | --- |
| `utm_mined_offers` | Anúncio, captura atual, nicho, tags simples, notas e status |
| `utm_mining_monitors` | Oferta ou página escolhida; ativo/pausado, datas e falha |
| `utm_mining_snapshots` | Capturas imutáveis com data do servidor |
| `utm_mining_changes` | Diferenças de campos e referência aos snapshots anterior/atual |
| `utm_mining_runs` | Observações ou falhas de verificação |
| `utm_mining_analyses` | Estado, resultado estruturado, modelo e entrada da análise |
| `utm_extension_grants` | Vínculo individual de usuário/workspace, hashes, expiração e revogação |

Todas têm RLS e escopo de workspace. FKs compostas impedem referenciar ofertas/snapshots/monitoramentos de outro workspace. O vínculo depende também do membro; sua remoção elimina a autorização. A unicidade `(workspace_id,library_id)` evita duplicatas. `utm_mining_capture` serializa operações do mesmo anúncio com lock transacional e grava oferta/snapshot/diferenças/execução atomicamente. Um salvar repetido retorna `duplicate: true` sem sobrescrever a oferta; uma verificação explícita cria novo snapshot. Pausar e remover monitoramento preservam a oferta; remover monitoramento elimina suas execuções associadas, preservando snapshots e diferenças da oferta. Excluir uma oferta requer confirmação na interface e cabeçalho com seu ID, removendo seu histórico por cascata.

Tags usam `text[]` limitado, sem taxonomia ou permissões novas. Dias ativos são uma estimativa no instante da captura, não um contador que assume atividade contínua. Datas desconhecidas, page ID ausente, mídia indisponível e formato desconhecido permanecem explícitos.

## Contrato HTTP

Todas as respostas usam JSON. Identificadores são UUIDs internos ou IDs numéricos de anúncios/páginas. Requisições de captura são limitadas a 64 KiB. Erros principais: 400 payload inválido, 401 sem autenticação/vínculo válido, 403 workspace/origem não permitida, 404 não encontrado, 409 duplicidade de vínculo/análise em andamento/monitoramento pausado, 413 corpo grande, 422 sem texto para IA, 429 limite de tráfego e 503 configuração indisponível.

| Método e rota | Uso e autorização |
| --- | --- |
| `GET /api/mining/extension` | Sessão: workspaces com escrita e vínculos do usuário |
| `POST /api/mining/extension` | Sessão + origem: `{workspace,challenge}` aprova vínculo pendente |
| `PUT /api/mining/extension` | Prova de posse `{verifier}`: resgate único da autorização aprovada |
| `DELETE /api/mining/extension` | Sessão + origem: `{workspace,id}` revoga vínculo do próprio usuário |
| `GET /api/mining/offers?workspace=...` | Sessão: lista paginada de 30; `q,format,status,tag,min_days,max_days,sort,page` |
| `POST /api/mining/offers` | Sessão com escrita ou bearer delegado: `{workspace,capture,snapshot?}` |
| `GET /api/mining/offers/:id?workspace=...` | Sessão: detalhes |
| `PATCH /api/mining/offers/:id?workspace=...` | Sessão com escrita: `niche,tags,notes,status`; `archived` arquiva |
| `DELETE /api/mining/offers/:id?workspace=...` | Sessão com escrita + `x-confirm-delete: <id>` |
| `GET /api/mining/offers/:id/history?workspace=...&page=0` | Snapshots, diferenças, análises e execuções; 30 por coleção |
| `POST /api/mining/offers/:id/analysis?workspace=...` | Sessão com escrita: solicita/reexecuta análise |
| `GET /api/mining/offers/:id/analysis?workspace=...` | Sessão: estado e resultado mais recente |
| `GET /api/mining/monitors?workspace=...` | Sessão ou bearer: alvos monitorados; máximo 1.000 |
| `POST /api/mining/monitors?workspace=...` | Sessão com escrita: `{offer_id,label,status?}` ou `{page_id,label,status?}` |
| `PATCH /api/mining/monitors?workspace=...` | Sessão com escrita: `{id,status}` ativo/pausado |
| `DELETE /api/mining/monitors?workspace=...&id=...` | Sessão com escrita: remove alvo |
| `GET /api/mining/monitors/:id/history?workspace=...&page=0` | Sessão: execuções e anúncios observados de oferta/página |
| `POST /api/mining/monitors/:id/history?workspace=...` | Escrita ou bearer: falha explícita `{reason}` com `capture_failed`, `insufficient_data` ou `api_unavailable` |

Captura exemplo (campos ausentes recebem defaults conservadores):

```json
{
  "workspace": "UUID_DO_WORKSPACE_AUTORIZADO",
  "capture": {
    "library_id": "123456789",
    "advertiser": "Nome visível",
    "copy": "Texto visível do anúncio",
    "activity": "active"
  },
  "snapshot": false
}
```

## IA

A saída validada por Zod contém resumo, ângulo, gancho, promessa, mecanismo, público, consciência, prova, CTA, estrutura, pontos fortes/fracos, hipóteses de longevidade, variações, tags e confiança. Usa o formato JSON Schema da [Responses API](https://developers.openai.com/api/docs/guides/structured-outputs). Cada conclusão usa `basis: observed | hypothesis | unavailable`. O anúncio é dado não confiável, não instrução. Somente texto/metadados mínimos são enviados, sem notas internas nem tokens Meta. Não há navegação em URLs nem análise visual de mídia; o assistente não afirma tê-la visto. Longevidade não é tratada como prova de lucro/escala.

Execução síncrona com timeout de 45 segundos e estado `running/completed/failed` persistido. Solicitações simultâneas são recusadas por índice único. Uma execução interrompida que permaneça `running` por mais de dois minutos é marcada como falha na próxima solicitação; não existe worker de recuperação contínua.

## Monitoramento e limites conhecidos

**Não há monitoramento contínuo ou cron novo habilitado.** As permissões/endpoints Meta existentes não demonstram acesso confiável à Biblioteca de terceiros. A página oficial de referência `https://developers.facebook.com/docs/graph-api/reference/ads_archive/` retornou HTTP 429 durante a auditoria; não foi possível confirmar uma cobertura adicional de API, e nenhuma foi inventada. Isso não afirma que a Meta proíba toda consulta: significa que tal capacidade não foi validada nesta instalação.

O fallback é a observação explícita na extensão. A infraestrutura de dados/estados e as RPCs de captura/falha estão disponíveis para um executor futuro autorizado. `next_check_at` fica nulo; a interface diz **Sem agendamento automático**. Para evoluir, primeiro validar elegibilidade/permissões/cobertura da API oficial e então desenhar o executor. Isso exige nova decisão antes de modificar integração ou infraestrutura. Não instalar scraping, navegação headless ou inferir inatividade a partir de busca incompleta.

- Anúncios novos de página são conhecidos quando o usuário os observa e registra a verificação. Não há descoberta autônoma de toda a página.
- Inatividade só é registrada quando explicitamente visível na captura. Ausência de card, paginação parcial e erros de rede não significam anúncio encerrado.
- Quantidade relacionada só é guardada quando visível; não representa total confiável da página.
- Seletores e parsers em `extension/parser.js` precisam acompanhar mudanças de HTML/idioma. Há suporte conservador para rótulos PT/EN. Conteúdo dobrado/oculto e estado interno/JSON da Meta não são lidos; campos ausentes permanecem vazios. URLs `blob:` são ignoradas.
- Mídia usa URLs temporárias. Não há download, proxy ou cópia em storage; links podem expirar ou exigir contexto da Meta. Reprodução pode falhar, mantendo link externo disponível.
- Limite atual de listagem de monitoramentos: 1.000 por workspace. Históricos e ofertas têm paginação. Não foi alterado nenhum plano/limite comercial.
- Revogação é efetiva nas próximas requisições. Uma requisição já autorizada e em execução pode concluir.

## Segurança revisada

| Tema | Verificação |
| --- | --- |
| Workspace | authorize nas sessões, grant + membro + usuário para bearer, filtros e FKs compostas, RLS executada em PGlite |
| Tokens | Hashes no banco, storage de sessão restrito ao worker/popup, sem segredo fixo, tokens Meta não utilizados |
| CSRF | sameOrigin para mutações por sessão; resgate exige verifier imprevisível |
| XSS | React/textContent; URLs HTTPS validadas; nenhum HTML capturado é executado; teste de texto contendo script |
| SSRF | Backend não busca URLs externas capturadas; mídia carrega diretamente no navegador; sem next/image proxy |
| Duplicidade/corridas | Unicidade no banco, lock e transação, resgate único atômico, índice de análise em andamento |
| Privilégios | Dados derivados e grants não graváveis por authenticated; RPCs revogadas de public/anon/authenticated |
| Logs | Novos endpoints não imprimem payloads, tokens, verifier ou respostas sensíveis; erros de infraestrutura genéricos |
| Meta | Sem scraping backend, sem alteração OAuth existente, parser restrito ao DOM visível |

## Verificações e entrega

Os resultados finais e o inventário completo de arquivos estão em `MINERACAO_VERIFICACAO.md`. Os testes de browser usam dados e respostas controladas: não comprovam login real, política remota aplicada, resposta paga do modelo ou compatibilidade com todo HTML atual da Meta.
