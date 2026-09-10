# Validação de links de webhook

## Evidência e correção

O painel passava APP_URL ou http://localhost:3000 aos componentes. Três fluxos interpolavam esse valor diretamente, permitindo links públicos inacessíveis ou com barras/caminhos inconsistentes. A função gatewayWebhookUrl agora centraliza a construção, valida provedor/UUID, normaliza a origem HTTPS e usa https://trackbase.com.br quando a configuração é ausente, inválida ou local.

Credencial salva não comprova entrega: o rótulo que afirmava WEBHOOK ATIVO foi substituído por CREDENCIAL SALVA. Cada produto adicionado cria outra integração e outro endereço; a interface agora explica essa regra.

## Isolamento observado no código

O endpoint busca a integração pelo UUID e pelo provedor do caminho. O workspace vem da integração persistida, não do payload do gateway. O cadastro consulta permissões com requireFeature; credenciais reutilizadas são consultadas no workspace. Isso não substitui testes de integração reais com cada gateway.

## Limites

- A causa histórica da troca do link Hotmart não foi confirmada. É necessário comparar URL antiga/nova e logs de entrega, sem compartilhar tokens.
- Não foram alteradas credenciais, autenticação, IDs existentes, banco ou configurações dos gateways.
- Não foi testada uma entrega real de cada gateway. Os testes novos cobrem geração da URL para os dez provedores, entradas inválidas e separação dos IDs; não comprovam assinatura, recebimento nem persistência end-to-end.
- Adicionar produto exige novo cadastro de webhook. Tokens de API e segredos de webhook são configurações distintas. Uma integração com token salvo pode continuar sem receber eventos.
- Instalações em domínios próprios devem configurar APP_URL HTTPS corretamente; o fallback é o domínio oficial Trackbase.
- Conferir URL cadastrada no gateway, retorno da entrega, log processado da Trackbase e transação persistida. Um HTTP 200 isolado não comprova atribuição nem envio CAPI.

Não houve commit, push ou deploy desta correção.
