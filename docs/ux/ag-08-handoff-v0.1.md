# AG-08 — cenas e formulário de apontamento

Atualização de 6/10: **INTEGRADO tecnicamente** aos controllers existentes, com tipos/testes e conferência de revisão em 360 px. Ver `docs/arquitetura/continuacao-sprints-autonomas-2026-10-06.md`. O handoff abaixo registra o escopo original.

Estado: **PRONTO para apresentação isolada**. Pacote C1 do Antigravity, 5/10/2026. Controllers/API/player já existem. Este documento fecha a pendência de contrato; não afirma conclusão da implementação externa nem aceite audiovisual.

## Entradas e arquivos permitidos

Ler `packages/contracts/src/review-ui.ts`, `review-fixtures.ts`, `apps/web/src/pages/ReviewConnected.tsx`, os estilos compartilhados em `apps/web/src/styles` e este handoff.

Criar exclusivamente:

- `apps/web/src/components/review/SceneReviewPanel.tsx`
- `apps/web/src/components/review/SceneReviewList.tsx`
- `apps/web/src/components/review/SceneCommentForm.tsx`
- `apps/web/src/styles/scene-review.css`

Os caminhos foram conferidos livres. Não editar controllers, rotas, contratos, fixtures, API, domínio, testes compartilhados, dependências ou arquivos AG-01–07. Codex importa o CSS e integra o retorno após revisão.

## Contrato e comportamento

`SceneReviewPanel` exporta componente nomeado com `SceneReviewPanelProps` de `@fbr/contracts`. A lista e o formulário podem ter props derivadas desse contrato. Fixtures via `@fbr/contracts/review-fixtures`: `reviewViewFixtures.unavailable` e `.review`.

Props controladas: `data`, `loading`, `error`, `pending`, `command_error`, `selected_shot`, `current_seconds`, `category`, `comment`, `can_submit`, `submit_reason`; callbacks `onRetry`, `onSelectShot`, `onCategoryChange`, `onCommentChange`, `onSubmit`.

Apresentar título, transcrição e intervalo recebido de cada cena; selecionar dispara callback com ID/versão exatos. Exibir timecode atual recebido, categoria e comentário controlados. Categorias são `ReviewCategorySchema`; usar os rótulos existentes no controller. Respeitar disponibilidade e pending sem recalcular regras. Não definir timecodes a partir de duração alvo, montar player, buscar mídia ou executar HTTP.

Loading, erro com retry, ausência de prévia, vazio e erro de comando precisam de apresentação clara. Distinguir apontamentos abertos/dispensados/corrigidos se apresentados, usando somente o status recebido. Formulários de resolução e aprovação integral continuam no controller Codex. O pacote não cria aprovações, estimativas de custo ou plano de correção.

As fixtures são integralmente sintéticas; seus URLs não têm mídia real. Não anunciar reprodução ou aprovação audiovisual a partir delas. Não usar a fixture em produção nem fazer fetch de seus URLs para conferir a apresentação.

## Aceite e entrega

Usável por teclado; rótulos associados; seleção perceptível; estados preservados em 360 px; comentários/revisões sem truncamento destrutivo; CSS restrito a um wrapper `scene-review-panel`. Nenhum polling, estado de domínio ou credencial. Verificação: `npm run typecheck`, evidências de renderização com fixtures e lista de arquivos alterados. Não instalar dependências. O pacote só recebe `INTEGRADO` após revisão e conexão nas páginas reais pelo Codex.

Prompt pronto: “Implemente somente AG-08 conforme docs/ux/ag-08-handoff-v0.1.md. Use SceneReviewPanelProps e reviewViewFixtures existentes. Crie apenas os quatro arquivos permitidos. Preserve controllers/API/player/regras. Entregue evidências de estados, teclado e 360 px, arquivos alterados e verificações.”
