# AG-09 — apresentação da entrega

Atualização de 6/10: **INTEGRADO tecnicamente** ao controller existente, com tipos/testes e conferência de entrega em 360 px. Ver `docs/arquitetura/continuacao-sprints-autonomas-2026-10-06.md`. O handoff abaixo registra o escopo original.

Estado: **PRONTO para apresentação isolada**. Pacote C1 do Antigravity, 5/10/2026. Backend/DTO/controller de entrega já existem. Não representa aceite audiovisual ou liberação de fornecedores reais.

Criar exclusivamente `apps/web/src/components/delivery/DeliveryPanel.tsx`, `DeliveryFiles.tsx`, `DeliverySummary.tsx` e `apps/web/src/styles/delivery.css`. Caminhos livres; não alterar controllers, rotas, contratos, fixtures, backend, dependências, testes compartilhados ou componentes existentes.

Ler `packages/contracts/src/review-ui.ts`, `review-fixtures.ts`, `apps/web/src/pages/DeliveryConnected.tsx` e estilos compartilhados. Exportar `DeliveryPanel` com `DeliveryPanelProps` de `@fbr/contracts`. Fixtures via `@fbr/contracts/review-fixtures`: `deliveryViewFixtures.unavailable` e `.preview`.

Apresentar nome, produção/revisão, tipo `unavailable`/`preview`/`approved_delivery`, arquivos/revisões e custos estimados/comprometidos/confirmados. Usar somente `download_url` recebido e disponibilidade `export_action`. Ausência de arquivo resulta em estado vazio sem link. Preview recebe rótulo explícito; não parecer entrega aprovada. `onExport` é callback do controller, sem HTTP próprio. Respeitar `pending`, `error`, `command_error` e `onRetry`.

Não emitir URLs, descobrir storage, aprovar vídeo, gerar manifesto ou calcular custo. Fixture tem URL sintética sem arquivo real; não fazer fetch nem usá-la em produção. CSS restrito ao wrapper `delivery-panel`; foco/teclado, rótulos e 360 px devem ser verificáveis.

Entregar arquivos alterados, verificação de tipos e evidências das variantes. Codex importa CSS, revisa e integra o componente depois do retorno. Não marcar `INTEGRADO` por entrega de apresentação isolada.

Prompt pronto: “Implemente somente AG-09 conforme docs/ux/ag-09-handoff-v0.1.md. Use DeliveryPanelProps e deliveryViewFixtures existentes. Crie apenas os quatro arquivos permitidos, preserve regras/API/controllers e apresente preview, ausência e entrega aprovada conforme DTO. Entregue evidências de estados, teclado e 360 px, arquivos alterados e verificações.”
