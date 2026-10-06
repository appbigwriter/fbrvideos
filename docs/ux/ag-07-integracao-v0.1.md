# AG-07 — integração do acompanhamento

5 de outubro de 2026 · **INTEGRADO tecnicamente** · R1 concluída no escopo de integração AG-05/06/07. Gate S3 e aceites editoriais/audiovisuais permanecem pendentes.

## Revisão e conexão

Os quatro arquivos previstos estavam presentes. Foram revisados contra o handoff e conectados em `ProductionsConnected.tsx`. `ProductionPresentation.ts` projeta exclusivamente revisão/nome/estado/etapa, custos, pendências e disponibilidade das ações; não entrega snapshot, Bible, mídia, aprovações ou dados de conta aos componentes.

As flags pause/resume/cancel vêm de `ProductionDetail.actions`. O controller apenas transforma cada flag em enabled/reason: quando desabilitada, informa que o servidor não disponibiliza a ação na revisão atual, sem inventar justificativa operacional específica. Não deriva permissões do status ou do índice da etapa. Comandos conservam ID/versão atuais e `useCommand`, chave de intenção/replay e proteção contra clique duplicado. Falha/conflito mantém os dados exibidos e mostra erro de comando; o operador pode atualizar e receber outra revisão.

O painel diferencia estimativa desconhecida e zero, compromissos e valores confirmados. Teto e margem são apresentados sem calcular autorização/saldo. Planejamento OAuth continua distinguido de valores de mídia. Só a etapa atual é apresentada, sem etapas ficticiamente concluídas, percentual, ETA ou jobs inventados. História e dossiê continuam conectados abaixo do painel. Atualização é manual; não foi adicionado polling.

CSS importado em `main.tsx` e limitado ao wrapper `production-progress-integration`, para proteger AG-05/06 e outras telas. Ajustes de revisão: pendência obrigatória quebra o marcador em linha separada no mobile, textos/motivos usam contraste legível e conteúdos longos não causam overflow. Componentes mantêm callbacks e nenhum fetch/storage/timer próprio.

## Verificações e limites

- `npm run verify`: **76 testes aprovados** (18 contratos, 26 infraestrutura, 23 pipeline, 9 web), tipos e build. Três regressões novas verificam autoridade das flags da API/revisão, ausência de snapshot, null versus zero/custos separados e bloqueio durante comando/conservação dos dados em conflito.
- Build repetido após ajustes finais de CSS. Aviso conhecido de React Router não bloqueou o build.
- Navegador/API reais: produção sintética OAuth `02b827ac-df24-45ba-9429-a36d3b31a65a`, revisão 6, aguardando decisão, etapa roteiro/direção; estimativa indisponível, comprometido/confirmado zero, teto R$ 50 e margem R$ 5. Atualizar consultou a API e manteve revisão 6; retomada ficou desabilitada conforme resposta do servidor.
- 360 px: clientWidth/scrollWidth 345 px, sem overflow; texto de pendência medido em 215 px após ajuste. Viewport restaurado. [Desktop](evidencias/ag-07-integrado.jpg) e [mobile](evidencias/ag-07-mobile.jpg).
- Não foram pausadas/canceladas produções existentes nem criadas execuções OAuth ou mídia para este QA. CAS/replay/pausa/retomada são cobertos pela suíte isolada de infraestrutura, não por cliques mutantes na produção do operador. QA humano completo de acessibilidade permanece pendente.

## Próxima frente

S3-B01: jobs duráveis, intenção/tentativa, reconciliação e reserva atômica de orçamento, com testes de concorrência e falha ambígua. Integração real S3-C01 depende do piloto S0-C01. O outro chat do projeto está idle e registrou falta de URL/texto de artigo real para avaliação editorial. AG-08/09/10 continuam bloqueados até contratos/fixtures e ownership estarem prontos; esta entrega não os libera.
