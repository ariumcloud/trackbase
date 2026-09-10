# Fontes das métricas de Campanhas

- IC Trackbase usa somente eventos checkout recebidos, agrupados por workspace, oferta e sessão. Repetições da mesma sessão não aumentam a contagem. É um clique para checkout, não confirmação de carregamento da página externa.
- Sessões com destinos conflitantes, sem ID ou com ID desconhecido no nível atual aparecem no aviso sem atribuição. O aviso considera período/produto; não implica vínculo com uma conta Meta específica.
- Vendas e receita continuam vindo dos pagamentos aprovados recebidos do gateway, excluindo testes. O número de compras reportado pela Meta não substitui vendas próprias.
- Reconstrução por sessão considera somente eventos anteriores ou iguais ao horário da venda. IDs desconhecidos no nível campanha/conjunto/anúncio entram no resumo sem atribuição.
- Gastos, impressões e cliques de anúncio continuam sendo métricas da Meta. Fórmulas financeiras e câmbio não foram alterados.
- Zero indica nenhum registro atribuído recebido. Não garante ausência de checkout ou venda no mundo real. A mudança não recupera eventos perdidos nem valida a persistência de produção.

Validação: suíte de 83 testes aprovada, incluindo três testes novos de contagem por sessão/oferta, ausência de Meta, filtros e ambiguidade. Nenhuma migration necessária nesta alteração. Validação visual autenticada e reconciliação com transações reais permanecem pendentes.
