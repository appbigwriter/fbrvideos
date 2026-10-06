# AG-05 — resumo e opções da criação de produção

Atualização em 5/10/2026: **INTEGRADO tecnicamente**. [Revisão, conexão à API e evidências](ag-05-06-integracao-v0.1.md). O escopo original abaixo fica como referência histórica; não reexecutar o pacote.

4 de outubro de 2026 · S2-A01 · C1 · **PRONTO para execução pelo Antigravity**.

Contratos publicados em `packages/contracts/src/planning-ui.ts`, via `@fbr/contracts`:
`ProductionSummaryProps`, `ProductionOptionsProps`, `ProductionSummarySchema`.
Fixtures via `@fbr/contracts/planning-fixtures`: `productionSummaryFixture` e
`blockedProductionSummaryFixture`. São sintéticas; não representam estimativa real ou perfil calibrado.

## Ownership

Criar exclusivamente estes quatro arquivos, ainda livres na liberação:

- `apps/web/src/components/productions/ProductionSummary.tsx`
- `apps/web/src/components/productions/ProductionOptions.tsx`
- `apps/web/src/components/productions/ProductionSetupPanel.tsx`
- `apps/web/src/styles/production-setup.css`

Não editar páginas, rotas, main, componentes AG-01/02/03/04, contratos, fixtures,
API, dependências ou documentos. Root mantém o formulário, comandos, validação,
carregamento, conversão de valores e conexão à API. Não implementar o planejador.

## Exports e comportamento

`ProductionSummary(props: ProductionSummaryProps)` exibe artigo e revisão,
perfil e revisão ou ausência, modo, `budget_label`, `estimate_label`, bloqueios
e suas próximas ações. Labels já vêm formatados: não somar custos, converter
moeda nem inferir elegibilidade. Implementar loading, erro com onRetry e ausência
de dados sem anunciar produção concluída. `can_submit` apenas recebido; não
renderizar botão de geração ou aprovação.

`ProductionOptions(props: ProductionOptionsProps)` usa os campos AG-04:
nome, perfil com opções exatamente recebidas e modo calibração/recorrente.
Uma seção `details` inicialmente fechada contém duração-alvo textual e itens
a evitar (textarea). Preservar entrada vazia/parcial, emitir callbacks de texto
sem conversão. Modo emite apenas o enum tipado. Não inventar defaults, filtrar
perfis, dividir itens a evitar, adicionar recorte/ambiente livres ou opção de
pular revisão. `pending` desabilita todos os campos; erro recebido usa role alert.

`ProductionSetupPanel(props: {summary: ProductionSummaryProps; options: ProductionOptionsProps})`
compõe os dois exports. Não criar `<form>` aninhado, submit, API ou estado de domínio.
Não criar h1; o cabeçalho pertence à página. A criação fixa entradas e dispara
planejamento semântico via ponte OAuth local quando configurada; usa cota da
conta, ainda não produz mídia nem autoriza gasto de geração. Não anunciar gratuidade.

## Aceite e retorno

- Dados, versões, bloqueios e callbacks são fiéis aos inputs.
- Componentes controlados; sem fetch, storage, timers, navegação ou regras de domínio.
- Foco visível, labels associados, teclado, loading/error/vazio/pending e 360 px sem truncamento.
- CSS próprio usa variáveis existentes, sem redefinir estilos globais.
- `npm run verify` aprovado; relatar arquivos alterados, verificações e limitações.
- Harness temporário só para conferência; não alterar páginas na entrega.

## Prompt pronto para repasse

> Execute AG-05 no FBR Videos em F:\Projetos\_FBR\FBRVideos. Leia docs/ux/ag-05-handoff-v0.1.md e crie somente os quatro arquivos permitidos. Use ProductionSummaryProps e ProductionOptionsProps de @fbr/contracts, fixtures de @fbr/contracts/planning-fixtures e campos AG-04. Exporte ProductionSummary, ProductionOptions e ProductionSetupPanel conforme o handoff. Preserve valores e callbacks, mostre versões/bloqueios e opções recolhidas. Não altere páginas, contratos, API ou dependências, não calcule custos/elegibilidade e não implemente geração. Entregue arquivos, verificações e limitações para revisão e integração pelo root.
