# AG-07 — acompanhamento e consumo

Atualização em 5/10/2026: **INTEGRADO tecnicamente**. [Revisão, API e evidências](ag-07-integracao-v0.1.md). O handoff abaixo permanece histórico; não reexecutar o pacote.

5 de outubro de 2026 · S3-A01 · C1 · **PRONTO para apresentação isolada**.

Esta liberação antecipa a interface de S3, usando contratos existentes. Não libera geração real, fecha gates ou substitui a integração de AG-05/06. Base identificada pelos arquivos abaixo; o workspace não possui checkout Git para fixar um commit.

## Entradas e ownership

Leia `packages/contracts/src/presentation.ts`, `schemas.ts`, `fixtures.ts`, este handoff e `apps/web/src/styles/shell.css`. Tipos existentes via `@fbr/contracts`: `ProductionView`, `CostSummary`, `productionStateLabels`. Fixtures via `@fbr/contracts/fixtures`: `productionViewFixtures`. As fixtures são simulações, inclusive revisão, aprovação e valores; não representam mídia real ou capacidades já disponíveis.

Criar exclusivamente:

- `apps/web/src/components/progress/ProductionProgressPanel.tsx`
- `apps/web/src/components/progress/ProductionStatus.tsx`
- `apps/web/src/components/progress/ProductionConsumption.tsx`
- `apps/web/src/styles/production-progress.css`

Não modificar arquivos existentes. Páginas/controllers, contratos, fixtures, API, domínio, pipeline, testes compartilhados, dependências e documentos ficam com os chats Codex. Não alterar AG-01–06. Root importa o CSS e integra os componentes após o retorno.

## Contrato concreto de componentes

Exporte os componentes nomeados e estes tipos no arquivo indicado. São props de apresentação derivados dos tipos existentes; não criar outro contrato de domínio ou alterar o barrel de contracts.

```ts
// ProductionProgressPanel.tsx
import type { ProductionView } from '@fbr/contracts';
export type ProgressPresentation = Pick<ProductionView,
  'ref' | 'name' | 'status' | 'stage' | 'costs' | 'pending_issues'> & {
  actions: Pick<ProductionView['actions'], 'pause' | 'resume' | 'cancel'>;
  notice: string;
};
export interface ProductionProgressPanelProps {
  data: ProgressPresentation | null;
  loading: boolean;
  error: string | null;
  pending: boolean;
  command_error: string | null;
  onRetry(): void;
  onRefresh(): void;
  onPause(): void;
  onResume(): void;
  onCancel(): void;
}
// ProductionStatus.tsx
import type { ProductionView } from '@fbr/contracts';
export interface ProductionStatusProps {
  data: Pick<ProductionView, 'ref' | 'name' | 'status' | 'stage' | 'pending_issues'>;
}
// ProductionConsumption.tsx
import type { CostSummary } from '@fbr/contracts';
export interface ProductionConsumptionProps { costs: CostSummary; }
```

## Comportamento e textos

`ProductionProgressPanel`: loading com status acessível; erro de carga com retry; data ausente com “Acompanhamento ainda não disponível”. Erro de comando aparece separado, mantendo dados atuais. Renderizar notice literalmente. Com data, compor os outros dois componentes e botões “Pausar”, “Retomar”, “Cancelar” e “Atualizar acompanhamento”. Tipo button em todos. Com pending, desabilitar todos os comandos e atualizar; retry apenas no erro de carga. Disponibilidade recebida também desabilita a ação e exibe seu reason. Callback sem argumentos, uma chamada por clique; a revisão está no controller. Não inferir ações pelo status nem emitir comandos durante renderização.

`ProductionStatus`: nome, revisão `ref.version`, rótulo de status de `productionStateLabels` e **apenas etapa atual**. Mapa de rótulos: preparation=Preparação; script_direction=Roteiro e direção; generation=Geração; assembly=Montagem; review=Revisão; delivery=Entrega. Não marcar etapas anteriores concluídas com base na posição do enum. Listar todas as pending_issues, message, next_action e marcador de obrigatória conforme required, sem inventar resolução ou aprovação. Usar combinação code/índice para issues repetidas. Sem h1 próprio.

`ProductionConsumption`: labels “Estimativa de mídia”, “Comprometido com mídia”, “Confirmado de mídia”, “Teto de mídia” e “Margem de segurança”. Valores em unidades menores divididos por 100, com moeda recebida, usando Intl.NumberFormat pt-BR. estimated_minor=null vira “Estimativa indisponível”; zero é zero, nunca ausência. Não somar confirmado e comprometido, calcular saldo/autorização, afirmar cobrança final, obter cotas ou estimar tokens. Texto obrigatório: “Planejamento por OAuth utiliza a cota da conta. Os valores de mídia não medem essa utilização.”

Texto obrigatório junto aos comandos: “Pausar e cancelar não garantem interromper uma execução já enviada ao fornecedor. A disponibilidade das ações é definida pelo servidor.” Isso é uma explicação geral, não confirmação de fornecedor conectado. Sem barra de percentual, ETA, lista de jobs inventada, token de acesso, link de login, preço fixo, aprovação, geração ou download. Sem fetch, timers, polling, storage ou regra de orçamento. Expansões locais de UI são permitidas.

## Cenários de verificação

Use os campos selecionados de `productionViewFixtures` para montar data no harness temporário, sempre com notice “SIMULAÇÃO DE APRESENTAÇÃO — sem execução de fornecedores”. Não renderizar current_render, current_approval, correction ou export; estão fora do contrato.

1. preparing: estado/etapa, estimativa null e comando recebido habilitado.
2. source_incomplete: pendência e próxima ação literal.
3. failure: motivo recebido de retomada indisponível; zero mantém valor.
4. budget_exhausted: confirmado e comprometido distintos, sem saldo calculado.
5. review e approved_delivery: somente status/etapa, sem mídia, aprovação ou download.
6. No harness, derivar pausada de preparing mudando status para paused, com ações explícitas; não inferi-las. Exercitar pending, command_error, erro/loading/ausência, motivos e callbacks.

O harness não integra a entrega nem altera páginas ou arquivos compartilhados. CSS com prefixo `production-progress-`, tema existente, sem redefinir classes globais. Sem importação do CSS pelo componente: root faz no ponto de entrada.

## Aceite e retorno

- Quatro arquivos permitidos, exports e props exatos; nenhuma alteração fora do ownership.
- Dados, revisões, motivos e custos fiéis ao input; estimativa desconhecida distinta de zero.
- Controles por teclado, foco visível, disabled real e motivo legível; layout em 360 px e desktop sem overflow horizontal.
- `npm run verify`; relatar horário e possíveis mudanças concorrentes. Não confundir falha externa ao pacote com aprovação nem alterar arquivo alheio para corrigir a suíte.
- Entregar lista de arquivos, verificação e evidências do harness, limitações. Root revisa e integra; conclusão externa não equivale a S3 concluída.

## Prompt pronto para repasse

> Execute apenas AG-07 no FBR Videos em F:\Projetos\_FBR\FBRVideos. Leia docs/ux/ag-07-handoff-v0.1.md e siga integralmente seus contratos, quatro arquivos permitidos e critérios. Use os tipos existentes de @fbr/contracts e productionViewFixtures de @fbr/contracts/fixtures para um harness temporário. Implemente apresentação de estado/etapa atual, pendências, consumo de mídia e callbacks de pausar/retomar/cancelar/atualizar. Diferencie estimativa indisponível, zero, comprometido, confirmado e cota OAuth. Não altere arquivos existentes, contratos, fixtures, páginas, API, pipeline ou dependências. Não implemente polling, jobs, orçamento, geração ou aprovações. Entregue arquivos, evidências de acessibilidade/responsividade, resultado de verify e limitações para revisão e integração pelo root.
