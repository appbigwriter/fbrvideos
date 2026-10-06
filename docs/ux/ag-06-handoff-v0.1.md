# AG-06 — inspeção somente leitura do dossiê

Atualização em 5/10/2026: **INTEGRADO tecnicamente**. [Revisão, conexão ao snapshot e evidências](ag-05-06-integracao-v0.1.md). O escopo original abaixo fica como referência histórica; não reexecutar o pacote.

4 de outubro de 2026 · S2-A01 · C1 · **PRONTO para execução pelo Antigravity**.

Tipos via `@fbr/contracts`, em `planning-ui.ts`: `DossierPanelProps`,
`NarrativeBlocksProps`, `ShotDetailsProps`, `DossierPresentationSchema`.
Fixture `dossierPresentationFixture` via `@fbr/contracts/planning-fixtures`.
Contrato contém o artigo na revisão exata do dossiê. Nenhum snapshot com
credenciais ou Bible original é necessário para este pacote.

## Ownership

Criar exclusivamente estes quatro arquivos, ainda livres na liberação:

- `apps/web/src/components/dossier/DossierPanel.tsx`
- `apps/web/src/components/dossier/NarrativeBlocks.tsx`
- `apps/web/src/components/dossier/ShotDetails.tsx`
- `apps/web/src/styles/dossier.css`

Não editar páginas, main, rotas, AG-01/02/03/04/05, contratos/fixtures, API,
dependências ou documentos. Root faz a projeção, carga e integração. AG-05 e
AG-06 podem executar em paralelo porque não compartilham arquivos de escrita.

## Exports e comportamento

`DossierPanel(props: DossierPanelProps)` apresenta notice, estado/revisão do
dossiê, briefing e pendências com próximas ações, seguido de `NarrativeBlocks`.
Loading, erro e retry são recebidos; ausência mostra “Planejamento ainda não
disponível”. Sem h1, percentual, ETA, aprovação ou indicação de prontidão para gerar.

`NarrativeBlocks(props: NarrativeBlocksProps)` apresenta blocos por sequence,
intenção, função visual e falas na ordem recebida. Mostrar modo e categoria da
fala; preservar texto, sem resumo ou reescrita. Cada fonte expande document
id/version, segment_id e trecho literal do artigo **somente se kind=article e
document corresponder exatamente a data.article**. Caso contrário, mostrar
“Fonte não disponível nesta apresentação”; nunca procurar por id em revisão
diferente. Transições sem fonte devem indicar “Transição editorial sem afirmação
factual”. Associar planos pelo block_id, usando IDs estáveis como keys.

`ShotDetails(props: ShotDetailsProps)` expande intenção, classe, rota,
referências com id/version ou ausência, composição, elementos, estados inicial
e final, ação, movimentos, área de legenda, continuidade, dependências,
restrições, riscos, critérios obrigatórios e fallback. `target_seconds` é alvo/
estimativa; `resolved_seconds=null` aparece como “Duração real pendente”.
Se fallback muda intenção, indicar necessidade de revisão, sem executar ação.
Sem mídia fabricada, formulário de direção, prompts novos, edição, aprovações
ou botões que disparem geração. Não interpretar Bible ou completar campos ausentes.

## Aceite e retorno

- Textos/fontes/IDs/revisões fiéis ao input; origem ausente nunca recebe texto de outra revisão.
- Sem fetch, storage, timers, comandos ou cálculo de elegibilidade.
- Details/summary operáveis por teclado; foco/contraste e layout em 360 px.
- CSS próprio usa o tema existente, sem redefinir classes globais.
- `npm run verify` aprovado; entregar arquivos, verificações e limitações.
- Harness temporário não altera páginas/main na entrega.

## Prompt pronto para repasse

> Execute AG-06 no FBR Videos em F:\Projetos\_FBR\FBRVideos. Leia docs/ux/ag-06-handoff-v0.1.md e crie somente os quatro arquivos permitidos. Use DossierPanelProps, NarrativeBlocksProps e ShotDetailsProps de @fbr/contracts e dossierPresentationFixture de @fbr/contracts/planning-fixtures. Exporte os três componentes, apresente roteiro/fontes/planos e detalhes recolhidos somente leitura. Respeite a revisão exata da fonte, mostre pendências e duração real ausente. Não altere páginas, contratos, API ou dependências, não escreva prompts, gere mídia ou implemente edição/aprovações. Entregue arquivos, verificações e limitações para integração pelo root.
