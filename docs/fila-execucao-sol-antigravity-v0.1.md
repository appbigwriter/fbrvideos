# Fila de execução — GPT-Sol-6.1 e Antigravity

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Versão 0.1 · 4 de outubro de 2026.

Base: `sprints-implementacao-3-agentes-v0.1.md`. Convenção solicitada pelo usuário: C1 no Antigravity com Gemini 3.7; C2–C4 aqui com GPT-Sol-6.1. Os nomes representam a preferência de execução; disponibilidade é conferida em cada ambiente.

## 1. Regra de atribuição

As 21 stories originais são C2, C3 ou C4. Nenhuma story inteira do backlog original está liberada como C1. Os pacotes AG abaixo são subtarefas extraídas dessas stories. Não são entregas adicionais nem substituem sua integração e aceite.

GPT-Sol-6.1 mantém contratos, regras, arquitetura, geração, persistência, integrações e revisão. Antigravity implementa partes delimitadas, principalmente apresentação, a partir de contratos e exemplos já definidos.

Pacote AG nasce `BLOQUEADO`. Só pode ser marcado `PRONTO` após suas entradas estarem entregues e revisadas. Modelos de maior capacidade precisam de critérios de aceite igualmente explícitos; o nome do modelo não garante qualidade.

## 2. Identificação

- `Sx-A/B/Cnn`: story original, executada aqui.
- `AG-nn`: subtarefa C1 delegável ao Antigravity.
- Estado: `BLOQUEADO → PRONTO → EM_EXECUCAO → EM_REVISAO → INTEGRADO`.
- Concluído pelo Antigravity não equivale a integrado. A revisão e a verificação na aplicação ocorrem aqui.

## 3. Fila principal

| Ordem | Execução aqui | Antigravity após liberação | Gate |
|---|---|---|---|
| 0 | S0-B01: arquitetura/contratos; S0-A01: UX; S0-C01: piloto | AG-01 após contrato visual/estrutura | Contratos estabelecidos; piloto documentado |
| 1 | S1-B01 e S1-C01; integração de S1-A01 | AG-02, AG-03, AG-04 | Artigo e perfil utilizáveis |
| 2 | S2-B01 e S2-C01; integração de S2-A01 | AG-05, AG-06 | Dossiê automático válido |
| 3 | S3-B01 e S3-C01; integração de S3-A01 | AG-07 | Assets reais, limites e retomada |
| 4 | S4-B01 e S4-C01; integração de S4-A01 | AG-08 | Vídeo completo revisável |
| 5 | S5-B01 e S5-C01; integração de S5-A01 | AG-09 | Correção e entrega aprovadas |
| 6 | S6-A01/B01/C01 | AG-10 | Critérios de liberação atendidos |

Em cada linha, o trabalho aqui começa pelas interfaces de domínio necessárias. Não aguardar a implementação inteira para liberar um componente visual com contrato estável. S0-C01 pode executar em paralelo à fundação. Sua aprovação é indispensável antes de consolidar as integrações reais de S3.

## 4. Pacotes C1 para Antigravity

### AG-01 — Estrutura visual e navegação

**Origem:** S0-A01. **Pré-requisitos:** stack, rotas, componentes visuais básicos e desenho aprovados aqui.

**Tarefas:** implementar layout, menu, cabeçalhos e páginas vazias; navegação conforme mapa fornecido; estados vazios com textos aprovados.

**Aceite:** rotas abrem; menu corresponde ao projeto; componentes seguem desenho. **Limites:** sem autenticação, arquitetura de rotas nova, chamadas externas ou definição de regras.

### AG-02 — Lista e apresentação de artigos

**Origem:** S1-A01. **Pré-requisitos:** DTO de artigo, fixture, componentes e callbacks aprovados.

**Tarefas:** renderizar lista/cartões; campos de busca/filtro; estado vazio/carregamento/erro; eventos de abrir e criar vídeo.

**Aceite:** fixtures são apresentadas corretamente; callbacks recebem IDs corretos; nenhuma inferência de elegibilidade. **Limites:** não implementar scraping, associação de autoria, busca de servidor nem persistência.

### AG-03 — Apresentação do universo

**Origem:** S1-A01. **Pré-requisitos:** view models de personagem, ambiente, voz e referência.

**Tarefas:** abas, cartões, miniaturas, detalhes somente leitura e indicação de versão/status.

**Aceite:** referências e versões são fiéis ao input; dados ausentes têm fallback visual. **Limites:** não interpretar Bible, aprovar referências nem alterar versionamento.

### AG-04 — Campos de formulário reutilizáveis

**Origem:** S1-A01. **Pré-requisitos:** especificação de campos, erros e callbacks já definidos.

**Tarefas:** componentes de texto, seleção, ajuda, mensagens de validação e disposição visual para perfis.

**Aceite:** erros recebidos são exibidos; valores/eventos seguem contrato. **Limites:** sem regras de validação novas, salvamento, upload real ou defaults editoriais inventados.

### AG-05 — Resumo de criação da produção

**Origem:** S2-A01. **Pré-requisitos:** view model de artigo/perfil/orçamento e ações definidas aqui.

**Tarefas:** resumo visual, seletor de perfil e seção recolhida de opções; renderização dos impedimentos recebidos.

**Aceite:** usuário vê artigo, perfil e limite; nenhuma ficha de plano obrigatória. **Limites:** não calcular preço, elegibilidade nem comandos de geração.

### AG-06 — Inspeção somente leitura do dossiê

**Origem:** S2-A01. **Pré-requisitos:** DTO de blocos, fontes, planos e referências.

**Tarefas:** painéis de roteiro, cenas e fontes; expansão de detalhes e indicação de pendências recebidas.

**Aceite:** fontes e cenas mantêm seus IDs; inspeção não altera o dossiê. **Limites:** não escrever prompts, decidir continuidade ou implementar aprovações.

### AG-07 — Apresentação de progresso e consumo

**Origem:** S3-A01. **Pré-requisitos:** enum de estados, regras de rótulos e resumo de custos.

**Tarefas:** cards de etapa, badges, painel de consumo e mensagens de pendência; botões com callbacks fornecidos.

**Aceite:** distingue estimado/confirmado; não cria percentual ou ETA; comandos ficam desabilitados conforme input. **Limites:** sem polling próprio, transições, reserva de orçamento ou semântica de cancelamento.

### AG-08 — Lista visual de cenas e apontamentos

**Origem:** S4-A01. **Pré-requisitos:** player/timecodes coordenados aqui; DTOs de cena/apontamento.

**Tarefas:** miniaturas, seleção visual e formulário de categoria/comentário; callbacks tipados.

**Aceite:** seleção e comentário referenciam IDs corretos; apresentação segue desenho. **Limites:** não sincronizar player, calcular timecodes, persistir avaliações nem decidir correções.

### AG-09 — Apresentação da entrega

**Origem:** S5-A01. **Pré-requisitos:** DTO de versão/arquivos e política de download implementada aqui.

**Tarefas:** cartões de vídeo/legendas/manifesto, resumo de aprovação/custo e ações de download fornecidas.

**Aceite:** versão e estado são explícitos; botões usam URLs/callbacks do contrato. **Limites:** não emitir URLs assinadas, aprovar vídeo nem disponibilizar asset sem permissão.

### AG-10 — Acabamento localizado e documentação derivada

**Origem:** S6-A01. **Pré-requisitos:** lista objetiva de problemas e fluxo integrado estável.

**Tarefas:** corrigir espaçamento, labels, foco/teclado em componentes indicados; montar documentação de uso a partir do fluxo aprovado.

**Aceite:** cada item possui evidência de correção; documentação não inventa capacidades. **Limites:** alterações de arquitetura, estado, regras ou comportamento audiovisual retornam à fila aqui.

## 5. Fila de início recomendada

1. Executar **S0-B01 aqui**: escolher stack e fechar contratos mínimos, estrutura e ownership.
2. Executar **S0-A01 aqui**: definir desenho e contratos visuais; liberar AG-01.
3. Executar **S0-C01 aqui** assim que artigo/Bible/acessos/rubrica estiverem disponíveis.
4. Antigravity executa **AG-01** enquanto aqui começam S1-B01/S1-C01.
5. Liberar AG-02/03/04 conforme contratos individuais ficarem prontos; integrar em S1-A01.
6. Avançar linha a linha da tabela, sem enviar todos os pacotes C1 simultaneamente antes das entradas.

Com somente um worker no Antigravity, usar ordem numérica entre pacotes PRONTOS. Com múltiplos workers, paralelizar apenas pacotes com arquivos distintos e entradas concluídas. Nenhum agente deve editar os mesmos arquivos enquanto ocorre a integração aqui.

## 6. Forma de entrega externa

Preferir branch/checkout isolado. Cada pacote traz base de código identificada e lista de arquivos permitidos. Se trabalhar no mesmo diretório, reservar os arquivos explicitamente e pausar edições concorrentes neles.

Antigravity entrega resumo, diff/commit quando aplicável, verificação executada e limitações. Mudanças em dependências, schemas, configuração raiz ou arquivos fora do escopo precisam voltar para decisão aqui. Não incluir credenciais em prompts ou artifacts.

## 7. Prompt de atribuição

```text
Implemente apenas [AG-nn] no projeto FBR Videos.
Base: docs/fila-execucao-sol-antigravity-v0.1.md.
Contrato e versão: [referência concreta].
Desenho/fixtures: [arquivos].
Arquivos permitidos: [lista].
Callbacks e interfaces: [referência].
Critérios de aceite: [critérios do pacote].
Não implemente regras de domínio, integrações ou arquitetura não especificadas.
Se faltar uma entrada essencial, relate a pendência; não invente o contrato.
Entregue arquivos alterados, evidências de verificação e limitações.
```

Não enviar esse template com placeholders pendentes: o contrato concreto deve acompanhar o pedido.

## 8. Controle da fila

**Estado posterior à continuação de 5/10/2026:** [AG-07 INTEGRADO tecnicamente](ux/ag-07-integracao-v0.1.md), juntando-se a AG-01–06. 76 testes, tipos/build e verificação de navegador aprovados. R1 de integração concluída; próximo trabalho aqui é S3-B01. AG-08/09/10 continuam BLOQUEADOS. Este estado substitui os retratos anteriores de AG-07 PRONTO; geração real e gates permanecem condicionados ao piloto/avaliação.

**Integração posterior em 5/10/2026:** [AG-05/06 INTEGRADOS tecnicamente](ux/ag-05-06-integracao-v0.1.md) nas páginas reais; 73 testes, tipos/build e verificação de navegador aprovados. Este registro substitui as pendências de revisão/integração nos retratos anteriores. AG-07 continua PRONTO para apresentação isolada; AG-08/09/10 BLOQUEADOS. A rodada S1 de outro chat terminou com 69 testes antes desta integração. Aceites editoriais/audiovisuais permanecem pendentes.

**Atualização de liberação em 5/10/2026, após consulta aos outros chats:** [AG-07](ux/ag-07-handoff-v0.1.md) **PRONTO para apresentação isolada**, com tipos/fixtures existentes e quatro novos arquivos exclusivos. Este registro substitui o bloqueio de AG-07 nas notas anteriores abaixo. AG-08/09/10 permanecem BLOQUEADOS. AG-05/06: arquivos presentes, revisão/integração pendentes. Detalhes de execução concorrente, ownership e próximas ondas: [planejamento de repasse](planejamento-antigravity-2026-10-05.md). A rodada ativa S1 de outro chat permanece responsável por ingestão/configuração/catálogo e seus checks finais. A liberação visual não conclui S3 nem autoriza geração real.

Registro sugerido por item: ID, origem, classe, executor/modelo, estado, dependências, contrato/base, arquivos permitidos, evidências e revisor. Na versão inicial, todos os AG estavam BLOQUEADOS. Estado vigente: AG-01/02/03/04 INTEGRADOS tecnicamente, após retorno do responsável, conexão com API e verificação no navegador. Os dez arquivos AG-02/03/04 foram preservados. QA humana ainda pendente. [AG-05](ux/ag-05-handoff-v0.1.md) e [AG-06](ux/ag-06-handoff-v0.1.md) PRONTOS para apresentação com ownership separado. AG-07–AG-10 continuam bloqueados. S0-C01 segue parcial. Este documento não inicia execução externa.

Alterar o nível quando surgir complexidade não prevista. A revisão aqui valida integração e aceite antes de marcar INTEGRADO. A conclusão do pacote contribui para a story original, mas não a conclui automaticamente.

## 9. Atualização da fila e integração Higgsfield

Situação vigente em 5 de outubro: S0-B01 e fundação UX entregues; AG-01/02/03/04 INTEGRADOS tecnicamente; S0-C01 preparado sem piloto real. S1-B01/S1-C01/S1-A01/S2-B01 entregues tecnicamente. [S2-C01 via OAuth](arquitetura/s2-c01-oauth-v0.1.md) implementado: GPT-6.1 Sol, roteiro em primeira pessoa, direção semântica, fontes, auditoria, diário idempotente e recuperação. Ensaio sintético real passou; fidelidade editorial em corpus real e gate S2 continuam pendentes. AG-05/06 com handoffs/contratos prontos; arquivos apareceram no workspace, aguardando confirmação do responsável e revisão para integração. Aqui seguem integração dos retornos e preparação da avaliação humana. AG-07–AG-10 bloqueados.

Priorizar em S0-C01 os candidatos Higgsfield para imagem/apoio e HeyGen para avatar/voz compatível, sem seleção final automática. S1-C01 registra catálogo e repertório; S3-B01/C01 implementam idempotência, estimativa/reserva, ownership, uploads, reconciliação e armazenamento; S4/S5 validam montagem e correção. Integrações continuam aqui, fora dos pacotes C1. AG-01 preserva React/Vite e não recebe Studio, SDK, conexão de chave ou catálogo operacional nesta revisão.
