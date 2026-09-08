# Auditoria de experiência — Trackbase

## Objetivo do produto para o usuário

Uma pessoa de tráfego deve conseguir sair de uma oferta recém-cadastrada para uma URL pronta para colar no Meta Ads, com rastreamento validado, sem conhecer parâmetros UTM, macros ou integrações técnicas.

## Diagnóstico executivo

Hoje o produto oferece bastante poder, mas entrega esse poder como configuração manual. O usuário é levado a cadastrar detalhes e tomar decisões que o sistema já conhece. O resultado é uma aplicação que parece completa para quem a construiu e pesada para quem só quer anunciar e acompanhar a venda.

O maior risco não é visual: operações passam a acumular links e ofertas incorretos porque itens criados não podem ser corrigidos ou removidos no fluxo normal.

## Problemas priorizados

| Prioridade | Problema | Evidência observada | Impacto no usuário | Recomendação |
|---|---|---|---|---|
| P0 | Oferta não pode ser editada ou excluída | O card exibe somente “Criar link”; há criação (`saveOffer`), mas nenhuma ação normal de atualização/exclusão da oferta. | Errou URL, checkout, taxa, nome ou plataforma? Precisa conviver com dado errado ou criar duplicata. | Menu `⋯` no card: Editar, Arquivar e Excluir. Excluir deve informar links/integracões afetados e pedir confirmação. |
| P0 | Link não pode ser editado ou excluído | A lista tem Copiar, Copiar parâmetros, Duplicar e Ativar/Desativar; o backend só expõe criação e toggle. | Um typo, macro errada ou URL trocada cria lixo permanente e risco de tráfego para destino errado. | Adicionar Editar, Duplicar e Excluir; usar o mesmo formulário com valores preenchidos. |
| P0 | Criar UTM pede trabalho técnico desnecessário | A tela pede nome, oferta, URL e nove campos UTM, além de campo customizado. Só cinco parâmetros Meta têm valor inicial. | O usuário não sabe o que preencher e pode destruir as macros que tornam o rastreio automático. | Criar um caminho padrão “Gerar link para Meta”: escolher oferta + nome opcional e gerar com macros seguras. Deixar os campos em “Personalizar (avançado)”. |
| P0 | O botão “Criar link” dentro de uma oferta perde o contexto da oferta | O clique abre o modal genérico; o formulário inicia sempre em `offers[0]`. | Em operação com várias ofertas, pode criar o link da oferta A dentro do card da B. | Passar o `offerId` do card ao modal e pré-selecioná-lo; mostrar o nome da oferta no título. |
| P0 | Antes de salvar, a prévia mostra apenas parâmetros, não a URL final | A caixa “PRÉVIA DOS PARÂMETROS” copia a query string, não a URL de destino completa. | Não há confirmação simples de “é esta URL que vou colar no anúncio”. | Exibir URL final completa e botão principal “Copiar URL para Meta”. |
| P1 | Cadastro inicial de oferta mistura o essencial com finanças e estrutura avançada | Um único modal pede tipo de produto, vínculo de funil, checkout, plataforma e três custos/taxas. | A primeira configuração parece uma declaração fiscal, não um início de campanha. | Etapa inicial: nome + URL da página + checkout/plataforma. “Configurar custos e funil” depois, opcionalmente. |
| P1 | O produto promete ações que não executa | “Duplicar campanhas” apenas mostra um alerta; “Atualizado há 1 minuto” é texto fixo. | Quebra confiança justamente onde a pessoa decide investir dinheiro. | Remover/ocultar a ação até existir ou abrir o fluxo real no Meta; trocar texto fixo pela data real de sincronização. |
| P1 | Não existe um final claro de “pronto para rodar” | Há checklist, script, gateways, UTMs e múltiplas abas, mas não uma confirmação final com passos de colagem no Meta Ads. | A pessoa não sabe se pode lançar ou qual é a próxima ação. | Tela de sucesso: 1) copiar URL, 2) colar em “Parâmetros da URL” do anúncio Meta, 3) testar link, 4) status “Pronto para rodar”. |
| P1 | Navegação expõe complexidade cedo demais | Nove áreas laterais e diversos termos técnicos aparecem antes do primeiro resultado. | Aumenta carga mental e transmite que o produto exige operação especializada. | Priorizar “Começar”, “Links”, “Resultados” e colocar diagnóstico, radar, IA e configurações em “Mais”. |
| P2 | Script e webhook são fornecidos sem orientação contextual suficiente | O card apresenta código e botão de copiar, mas não explica em qual ferramenta/tela ele deve ser instalado nem valida a instalação. | Usuário copia, mas pode parar antes da parte que faz o rastreamento funcionar. | Instruções por plataforma, estado de validação e ajuda humana/contextual em cada passo. |
| P2 | A URL do link pode divergir da URL cadastrada na oferta sem alerta | O formulário permite trocar a URL da página livremente. | Pode atribuir dados de uma oferta a uma página diferente por acidente. | Manter URL da oferta bloqueada no fluxo rápido; permitir substituição só em opções avançadas, com aviso. |

## Fluxo recomendado: “Meta em 60 segundos”

1. O usuário clica **Nova campanha Meta** na página da oferta.
2. Escolhe a oferta (pré-selecionada quando veio do card) e dá um nome simples ao link, por exemplo “CBO setembro”.
3. O Trackbase aplica automaticamente `meta`, `paid_social` e as macros de campanha, conjunto e anúncio.
4. Uma tela final mostra a URL completa, com **Copiar para Meta Ads** como ação dominante e um teste do link.
5. Campos como país, placement, creative e variação ficam recolhidos em **Personalizar rastreamento**.

## Sequência de implementação recomendada

1. Corrigir o ciclo de vida de ofertas e links: editar, excluir/arquivar e confirmação de impacto.
2. Criar o modo rápido de Meta e alterar o modal de UTM para “essencial primeiro, avançado opcional”.
3. Preservar a oferta escolhida ao criar link e mostrar/copiar a URL final.
4. Remover promessas não funcionais e mostrar status reais de sincronização.
5. Simplificar a primeira navegação e criar o estado final “Pronto para rodar”.

## Evidência técnica consultada

- `src/components/dashboard.tsx`: cards de oferta, ações da lista de links e modal de criação.
- `src/components/forms.tsx`: campos do cadastro de oferta.
- `src/lib/utm.ts`: defaults Meta disponíveis no código.
- `src/app/actions.ts`: operações disponíveis para oferta e link.
- `src/components/campaigns-view.tsx`: ação de duplicar campanhas e texto de atualização.

## Verificação

O lint termina sem erro (um aviso de variável não usada) e a suíte automatizada passou: 39 testes. Isto confirma que os achados acima são principalmente de produto/experiência e lacunas de funcionalidade, não falhas detectadas pelos testes atuais.
