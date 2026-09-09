# Auditoria ponta a ponta para testers externos

Data da auditoria: 2026-09-08

## Veredito

O produto tem uma base técnica ampla, mas ainda não está pronto para um teste comercial ponta a ponta sem uma preparação de ambiente e sem esclarecer algumas promessas. O caminho funcional é: página de vendas → login/cadastro → workspace → oferta → link → integração → webhook → painel. Os maiores riscos estão em cobrança/ativação de plano, primeira configuração e diferenças entre promessa comercial e capacidade real.

## Bloqueadores antes de convidar testers

| ID | Severidade | Área | Achado | Evidência | Ação obrigatória |
|---|---|---|---|---|---|
| E2E-01 | P0 | Ambiente/login | Sem `NEXT_PUBLIC_SUPABASE_URL` e chave pública, `/login` não mostra formulário; mostra apenas aviso de ambiente não conectado. | Teste visual local em `/login`; `AuthForm` renderiza o formulário somente quando `configured()` é verdadeiro. | Configurar e validar Supabase, migrations, `APP_URL`, chave de criptografia, service role e OAuth antes do convite. Criar uma checagem de saúde visível para suporte, não para o cliente. |
| E2E-02 | P0 | Venda/cobrança | Os CTAs pagos vão direto para links do Stripe, mas não há fluxo visível de retorno, criação/vinculação de conta, webhook de assinatura ou atualização automática do plano. | Página de vendas usa URLs `buy.stripe.com`; rotas de webhook existentes são de gateways de vendas, não de billing Stripe. | Implementar Stripe Billing: `checkout.session.completed`, renovação, falha, cancelamento, portal do cliente e mapeamento seguro para `utm_workspaces.plan`. Testar compra real em modo teste. |
| E2E-03 | P0 | Promessa comercial | A página afirma “+35% vendas recuperadas”, “zero bloqueios”, “R$ 4.8M rastreados” e proteção contra bloqueios. São afirmações fortes sem prova, contexto ou ressalva. | Hero, proof strip, FAQ e seção Shield em `src/app/page.tsx`. | Trocar por números auditáveis ou exemplos explicitamente fictícios. Revisar o posicionamento do Shield/Cloaker com jurídico e políticas da Meta antes de vender essa função. |
| E2E-04 | P0 | Suporte | Verificar se o botão de teste VIP aponta para o canal oficial: `wa.me/55499999317620`. | `src/components/locked-feature-card.tsx`. | Um tester deve sempre chegar ao suporte oficial. |
| E2E-05 | P0 | Ambiente/URLs | Vários callbacks usam `process.env.APP_URL` diretamente; quando ausente ou incorreto, recuperação de senha e callbacks Google podem falhar ou redirecionar para host inválido. | `actions.ts`, `auth/callback`, `api/google/callback`, `lib/google-ads.ts`. | Centralizar todos os redirects em `appUrl()` e falhar no startup com mensagem operacional clara se a URL pública não estiver configurada. |

## Auditoria por etapa

### 1. Página de vendas

- A navegação, planos, FAQ e links legais carregam corretamente no teste visual.
- O CTA do Free leva ao login; os pagos saltam para checkout externo sem explicar o que acontece depois da compra.
- O preço exibido no site precisa ser a mesma moeda, periodicidade, impostos e condição exibidos no Stripe.
- A tabela comparativa faz afirmações sobre concorrentes (“R$ 197 a R$ 497”, recursos inexistentes), sem fonte ou data.
- O plano Premium vende Shield/CNAME e proteção contra concorrentes; isso precisa de revisão de política e de um fluxo de configuração demonstrável.
- O mock do dashboard usa dados convincentes, mas não está claramente marcado como ilustração no hero.
- O link “serviços comerciais” está `display:none`; não deve existir referência comercial escondida no código sem decisão de produto.

### 2. Login, cadastro e recuperação

- Login depende de configuração externa e fica sem campos quando o ambiente está incompleto.
- Cadastro exige e-mail, celular, CPF/CNPJ e senha de 10 caracteres. Isso cria fricção alta para experimentar e precisa de explicação de por que o documento é necessário.
- A verificação de CPF/CNPJ usa `listUsers({ perPage: 1000 })`; acima de mil usuários a checagem de duplicidade pode ficar incompleta.
- Recuperação de senha depende de `APP_URL` e de o template/link do Supabase estar configurado.
- O fluxo OAuth troca código por sessão e valida state, mas deve ser testado com conta cancelando consentimento, state expirado, callback repetido e domínio de redirect incorreto.
- Não há teste E2E automatizado de cadastro confirmado por e-mail, login inválido, sessão expirada, logout e recuperação concluída.

### 3. Primeiro acesso e workspace

- O cliente precisa descobrir que primeiro cria workspace, depois oferta, depois integração, tracker e link.
- O checklist tem seis etapas, mas algumas aparecem como concluídas com base em sinais amplos (por exemplo, qualquer atividade de tracker); isso pode dar sensação de pronto sem validar a instalação real.
- Os limites dos planos estão no banco e no código, mas o cliente precisa ver limite atual, consumo e motivo de bloqueio antes de tentar criar.
- Deve existir estado explícito: “Pronto para rodar”, “Falta webhook”, “Falta testar evento” e “Erro de sincronização”.

### 4. Ofertas e links

- A versão auditada já contém criação, edição, exclusão/arquivamento e contexto correto da oferta.
- O modo rápido de Meta reduz a configuração para os parâmetros padrão; testar também URL com query existente, fragmento, macros e destino sem checkout.
- Ao excluir oferta com vendas, o comportamento é arquivar; isso precisa aparecer no texto do botão para não surpreender.
- A edição de link deve preservar oferta arquivada e impedir troca silenciosa para outra oferta.
- O tester deve confirmar que o link final e os parâmetros copiados são iguais ao que chega na página e no checkout.

### 5. Meta Ads

- OAuth valida state, expiração, token e conta selecionada; testar recusa, token expirado, múltiplas contas e Business Manager.
- O escopo atual é leitura (`ads_read`). Portanto, o produto sincroniza e analisa, mas não cria, edita ou duplica campanhas na Meta.
- O cliente precisa ver isso antes de procurar uma ação de “duplicar” ou “pausar” dentro do Trackbase.
- “Sincronizar 30 dias” e cron devem ser testados com conta sem campanhas, moeda USD/EUR, timezone diferente e rate limit.
- A reconexão de conta Meta deve ser testada para não duplicar integrações nem mover credenciais ao workspace errado.

### 6. Gateways e webhooks

- O wizard guiado de credenciais cobre Hotmart, Kiwify e Cakto; Kirvano, Eduzz, Monetizze, Wiapy, Lowfy, Greenn e Stripe aparecem como opções, mas exigem configuração manual diferente.
- A página de vendas diz “7 plataformas” e o código já contém mais provedores; a matriz de suporte precisa ser única e pública.
- O fluxo é em várias etapas: credenciais → busca de produtos → importação → URL do webhook → segredo → primeiro evento. Deve haver botão de teste/diagnóstico do webhook.
- Se a criação da credencial do produto adicional falhar, o fluxo precisa provar que não deixa oferta/integração órfã.
- Testar duplicidade de eventos, reembolso, chargeback, assinatura renovada/cancelada, order bump, upsell, moeda e produto errado.
- Cakto tem validação HMAC; os demais dependem de token/secret. Documentar exatamente o campo e o header esperado por provedor.

### 7. Tracker, landing e checkout

- O tracker é público e usa CORS amplo por necessidade do navegador; a proteção passa por chave, rate limit, validação de payload e origem do checkout.
- Testar script em landing HTTPS, HTTP, subdomínio, SPA, página sem CTA, múltiplos CTAs, checkout externo, bloqueador de script e navegador mobile.
- Confirmar que PageView, CTA, scroll, checkout e UTMs chegam sem duplicidade e que a atribuição é mantida ao sair da landing.
- Testar links malformados, URLs com credenciais, protocolos executáveis e domínios de checkout não autorizados.

### 8. Painel, métricas e ações

- Verificar BRL/USD/EUR sem soma indevida entre moedas, timezone de Brasília e virada do dia.
- Confirmar que receita bruta, taxas, receita líquida, lucro, CPA, ROAS e reembolsos usam a mesma janela de datas.
- Alertas devem distinguir “sem dados” de “problema detectado”, não criar ruído para operação pequena e abrir diretamente a ação corretiva.
- IA recebe contexto filtrado, mas o tester deve confirmar que não expõe e-mail, telefone, tokens, URLs privadas ou payload bruto.
- Exportação deve conter todos os dados prometidos e excluir credenciais; testar usuário viewer versus owner/admin.
- Push/Web Push precisa de teste em iOS instalado na tela inicial, Android, permissão negada, token expirado e múltiplos dispositivos.

### 9. Shield, Radar e diagnóstico

- Shield deve ter uma explicação de uso permitido, domínio, DNS/CNAME, páginas white/gray/black, teste seguro e rollback.
- A experiência atual usa linguagem de cloaking/anti-revisor que pode gerar reprovação de anúncio ou risco de conta; não liberar para clientes sem revisão de conformidade.
- Radar deve distinguir sessão ativa, bot, preview e tráfego real; validar retenção e exclusão de dados.
- Diagnóstico precisa mostrar amostra mínima e hipóteses, não declarar “com certeza” um gargalo com poucos eventos.

### 10. Conta, privacidade e suporte

- Exportação e exclusão da conta existem, mas exclusão precisa ser testada com workspaces, integrações, credenciais, logs, sessões, pixels e dados administrativos.
- A política diz “criptografia de ponta a ponta”; como o servidor precisa descriptografar tokens para chamar APIs, o texto correto é criptografia em repouso/em trânsito sob controle do servidor, salvo se houver um desenho E2E real.
- Termos prometem cancelamento “diretamente pelo painel”, mas não há fluxo de billing/portal identificado na auditoria.
- E-mails de suporte e privacidade devem ser monitorados e o SLA prometido precisa ter responsável.

## Roteiro de teste para cada conhecido

1. Abrir a página em desktop e celular; clicar nos seis itens de navegação, FAQ, termos, privacidade e cada plano.
2. Criar uma conta com e-mail novo; confirmar e-mail; sair; entrar; errar senha; recuperar senha; concluir a nova senha.
3. Criar workspace; cadastrar uma oferta; editar URL/nome; remover uma oferta sem vendas; confirmar arquivamento de uma com histórico.
4. Gerar link Meta e link Google; copiar URL e parâmetros; testar a URL numa landing; corrigir e excluir o link.
5. Conectar Meta; recusar consentimento; reconectar; escolher conta; sincronizar conta sem campanhas e conta com moeda estrangeira.
6. Conectar um gateway guiado; importar produto; cadastrar webhook; enviar evento de teste; validar venda, reembolso e chargeback.
7. Instalar tracker; abrir landing em mobile; gerar PageView, CTA, scroll e checkout; confirmar painel, Radar, alerta e CAPI.
8. Testar exportação, push, IA, diagnóstico, logout e exclusão da conta.

## Critério de liberação

Não liberar para testers externos enquanto E2E-01 a E2E-05 não estiverem resolvidos. Para o primeiro grupo, exigir no mínimo um teste real completo com Meta + um gateway, uma compra de teste, um reembolso de teste, uma conta mobile e uma conta com moeda diferente.

## Evidências consultadas

Teste visual local das rotas `/`, `/login` e `/demo`; componentes de autenticação, dashboard, gateways, integrações Meta/Google, tracker, webhooks, exportação/exclusão, planos, termos e privacidade; suíte automatizada existente (56 testes aprovados na execução desta auditoria).
