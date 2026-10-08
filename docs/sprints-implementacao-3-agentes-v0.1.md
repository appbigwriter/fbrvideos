# FBR Videos — sprints para implementação por três agentes

Entrega técnica em 7/10/2026: [TL-01–TL-18 implementadas/integradas ou provisionadas](arquitetura/entrega-tasklist-2026-10-07.md), com jornada sintética pública até entrega e correção. Gates de fornecedores/qualidade humana continuam separados.

Auditoria e próxima execução em 6/10/2026: [tasklist remanescente](tasklist-remanescente-2026-10-06.md), com 18 tarefas de código e quatro grupos de dependências externas. Orquestração inicial, normalização dos adapters e integração de outputs/correções ainda estão abertas; as fundações entregues devem ser preservadas.

Estado de execução atualizado em 6/10/2026: [continuação autônoma e provisionamento de S2–S6](arquitetura/continuacao-sprints-autonomas-2026-10-06.md). As dependências externas não bloqueiam as frentes internas; aceite integral das sprints continua distinto da entrega técnica.

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Versão 0.1 · 4 de outubro de 2026 · Backlog técnico preliminar, a incorporar ao PRD.

Base: `projeto-base-sistema-v0.1.md` e `especificacao-producao-audiovisual-v0.1.md`.

## 1. Premissas de execução

Estado mais recente: [continuação S4/S5 em 6/10](arquitetura/continuacao-s4-s5-2026-10-06.md). Código de revisão/entrega e publicação atômica de montagem acrescentado; testes de cenários nativos passaram. Validação global/navegador e integração de serviços desta rodada ainda em andamento. S0/S2/S3/S4/S5/S6 conservam os aceites pendentes descritos no registro.

Continuação autônoma em 5/10: [fundação S3 e núcleos S4/S5/S6](arquitetura/s3-fundacao-2026-10-05.md) implementados: pg-boss/fila, orçamento, retomada, acompanhamento, AssetStore/mídia, montagem/preview FFmpeg, invalidação, manifesto e backup/restauração. 98 casos cobertos pela verificação global/nativa; tipos/build aprovados. Gates reais, integração completa de revisão/entrega e aceites humanos seguem pendentes. Agendamento de 20:10 é contingência por créditos.

Estado em 4 de outubro de 2026 após continuação: S0-B01 entregue; UX S0 entregue com QA humana pendente;
AG-01 integrado tecnicamente; S0-C01 preparado sem ensaio real. S1-B01 validado no PostgreSQL 18.4
nativo local, com migração, pg/Pool, concorrência e HTTP real. [S1-C01](arquitetura/s1-c01-entrega-v0.1.md)
tem catálogo, diagnóstico e adapters simulados verificados. AG-02/03/04 recebidos e INTEGRADOS tecnicamente
em S1-A01 com API real; [S2-B01 entregue](arquitetura/s1-a01-s2-b01-entrega-v0.1.md) com snapshots, estados,
dossiês/eventos e comandos transacionais. 46 testes, tipos e build passaram; fluxos reais foram verificados
no navegador com dados sintéticos. QA humana e evidências audiovisuais continuam pendentes;
Atualização em 5 de outubro: S2-C01 possui [GPT-6.1 Sol via OAuth](arquitetura/s2-c01-oauth-v0.1.md)
integrado à criação/retomada e recuperação: roteiro em primeira pessoa, direção semântica,
fontes, auditoria e diário idempotente. Implementação técnica verificada; avaliação humana
em artigos representativos/Bible real e gate S2 continuam pendentes. AG-05/06 PRONTOS
com contratos/fixtures estáveis. Verificação ampliada: 62 testes, tipos/build e suíte de
23 testes de infra no PostgreSQL nativo. Geração de mídia permanece condicionada ao piloto.

O usuário seleciona artigo e perfil; o sistema concebe as cenas e produz o vídeo. Especificações audiovisuais detalhadas são internas. Não construir um editor que obrigue o usuário a dirigir cada plano.

Este documento planeja trabalho simultâneo de três agentes; não inicia agentes nem implementações. Sprints são incrementos com condições de saída, sem duração prometida. A estimativa temporal depende da stack, fornecedores e piloto.

Há sete sprints, de S0 a S6. Cada uma contém três trilhas com trabalho paralelo; dependências internas são declaradas. Um bloqueio de qualidade audiovisual interrompe integrações pagas dependentes, não o desenvolvimento independente de interface ou domínio.

## 2. Agentes, responsabilidade e modelos

| Agente | Responsabilidade principal | Limite de atuação |
|---|---|---|
| A — Experiência | Telas, interação, estados visíveis e testes de jornada | Não redefine contratos ou regras do domínio unilateralmente |
| B — Domínio | Dados, APIs, versões, fila, orçamento e dependências | Não altera interfaces compartilhadas sem revisão do contrato |
| C — Audiovisual | Planejamento, adapters, assets, áudio e renderização | Não declara qualidade visual validada só porque o job concluiu |

Os agentes são frentes de trabalho, não níveis fixos de inteligência. O modelo é escolhido por story. Um agente pode executar stories de níveis diferentes em turnos distintos.

| Nível | Característica | Classe de modelo recomendada | Exemplos de candidatos disponíveis* |
|---|---|---|---|
| C1 — Baixa | Contrato pronto, mudança localizada, comportamento direto | Rápido/econômico | gpt-6-luna |
| C2 — Média | Várias camadas, estados de UI, validações ou CRUD versionado | Generalista forte | gpt-6.1-sol |
| C3 — Alta | Concorrência, dependências, retomada, integração multimodal | Modelo forte com esforço alto | gpt-6.1-sol, esforço high |
| C4 — Crítica | Arquitetura, fidelidade narrativa, qualidade visual e decisões incertas | Modelo de maior capacidade com esforço alto | gpt-6-astra ou gpt-6.1-sol com esforço xhigh |

*São opções de roteamento, não promessa de equivalência nem recomendação baseada em benchmark do projeto. Disponibilidade e orçamento são conferidos na execução. Não reduzir a classe abaixo da indicada antes de demonstrar desempenho nesse tipo de story. Para C1, o ganho econômico depende do custo total com revisão e retrabalho.

### Roteamento por subtarefa

Uma story assume o nível de seu risco principal. Documentação derivada, componentes repetitivos e fixtures podem ser executados em C1 depois que o contrato estiver aprovado. Máquina de estados, orçamento concorrente e políticas narrativas permanecem no nível da story. Uma subtarefa complexa não vira C1 por ter poucas linhas.

### Revisão cruzada

- A revisa a usabilidade dos resultados de B/C.
- B revisa persistência, contratos e invariantes de A/C.
- C revisa adequação audiovisual e integração de A/B.
- C3/C4 exigem revisor com capacidade equivalente ou superior; revisão pode ocorrer em sequência no mesmo slot. Nunca depender de uma revisão C1 para liberar uma mudança crítica.
- Aprovação estética e calibração editorial exigem o responsável humano. Agentes podem organizar evidências, não substituir esse julgamento.

## 3. Organização para trabalho simultâneo

Fronteiras lógicas propostas, a mapear para a stack em S0:

| Área | Proprietário |
|---|---|
| Interface e testes de jornada | A |
| Domínio, persistência e API de aplicação | B |
| Pipeline audiovisual, adapters e render | C |
| Contratos compartilhados | B coordena; A/C revisam antes de mudanças |
| Infraestrutura/configuração raiz | B coordena; demais agentes solicitam alterações |

Usar branches/checkouts isolados ou propriedade explícita de arquivos quando compartilharem diretório. Não editar os mesmos arquivos simultaneamente. Contratos e fixtures são entregues primeiro, permitindo que A trabalhe com mocks e C com adapters simulados. Ao final de cada sprint, executar integração real entre as três frentes; mocks não contam como prova de integração com fornecedores.

Cada story deve produzir: implementação, evidência de aceite, registro de decisões e limitações, arquivos alterados e instruções de verificação. Não atribuir três agentes para modificar a mesma story sem divisão de propriedade.

## 4. Ordem e gates

| Sprint | Incremento | Gate de saída |
|---|---|---|
| S0 | Contratos e prova audiovisual | Arquitetura mínima decidida; viabilidade técnica/visual documentada |
| S1 | Artigos, universo e perfis | Artigo + personagem + perfil persistidos e utilizáveis |
| S2 | Direção automatizada | Dossiê completo derivado de artigo sem definição manual de planos |
| S3 | Geração orquestrada | Assets reais e retomada/orçamento controlados |
| S4 | Montagem e revisão | Vídeo revisável com avatar, apoio e voz consistente |
| S5 | Correção e entrega | Correções locais e versão aprovada exportável |
| S6 | Qualidade e liberação | Jornadas integradas, limites operacionais e rubrica atendidos |

S0 audiovisual requer artigo real, Bible, referências, acesso autorizado aos fornecedores e critérios humanos. Sem esses insumos, realizar contratos e protótipos, mas manter o gate audiovisual pendente. Não converter ausência de evidência em aprovação.

## 5. Sprint S0 — Fundação e redução de risco

### S0-A01 — Protótipo da jornada principal

**Story:** como operador, quero visualizar o percurso do artigo até o vídeo para validar a experiência antes da integração. **Agente:** A. **Complexidade:** C2. **Dependências:** projeto base; alinhamento inicial com S0-B01.

Subtarefas:
1. Desenhar navegação e protótipos de Artigos, Criar produção, Acompanhamento, Revisão e Entrega.
2. Representar sucesso, fonte incompleta, falha, custo esgotado e correção.
3. Preparar fixtures coerentes com os contratos e registrar decisões de UX.

**Aceite:** fluxo inicia com artigo/perfil; nenhuma ficha de cena é obrigatória; estados e próxima ação são claros. **Revisor:** B, com avaliação de produto pelo responsável.

### S0-B01 — Contratos, arquitetura e base de execução

**Story:** como equipe, quero fronteiras e contratos claros para implementar em paralelo. **Agente:** B. **Complexidade:** C4. **Dependências:** documentos base.

Subtarefas:
1. Definir stack, persistência, armazenamento, fila e ambiente de desenvolvimento em decisões arquiteturais registradas.
2. Especificar schemas de Artigo, Perfil, Produção, Dossiê, Plano, Asset, Job, Avaliação e Timeline.
3. Definir IDs, versões, estados, erros, contratos de API/adapters e fixtures.
4. Preparar estrutura mínima, validação de contratos e comando de verificação da base.

**Aceite:** A/C conseguem consumir contratos sem importar implementação interna; schemas distinguem jobs e avaliações; decisões abertas têm responsável e impacto. **Revisor:** C e A para seus contratos.

### S0-C01 — Spike audiovisual e matriz de capacidades

**Story:** como responsável pela produção, quero demonstrar que voz, avatar e cenas de apoio podem formar um vídeo coerente. **Agente:** C. **Complexidade:** C4. **Dependências:** insumos reais e acesso autorizado; pode começar sem stack final.

Subtarefas:
1. Definir com o responsável rubrica, receita, formato e orçamento do experimento.
2. Verificar schemas/acesso de operações candidatas Higgsfield para imagem e apoio; testar identidade visual e uma classe de movimento após aprovar a imagem. Testar voz oficial em off e áudio aprovado no avatar candidato HeyGen separadamente.
3. Montar um trecho representativo com transição entre avatar e apoio.
4. Registrar capacidades por operação, conta e modelo; medir continuidade, retrabalho e custo por cena/vídeo aprovado. Distinguir catálogo disponível de repertório calibrado e capacidade documentada de acesso testado.

**Aceite:** relatório com artefatos reais e avaliação humana; caminho de integração viável identificado ou bloqueio demonstrado. **Revisor:** B para integração; responsável humano para qualidade.

**Paralelismo:** A/B avançam com contratos; C executa experimento isolado. **Gate:** se o caminho audiovisual falhar, revisar perfil/fornecedor antes de S3, sem prometer solução já validada.

## 6. Sprint S1 — Artigos e configuração reutilizável

### S1-A01 — Telas de artigos, universo e perfis

**Story:** como operador, quero configurar referências uma vez e selecionar artigos sem preencher direção de cenas. **Agente:** A. **Complexidade:** C2. **Dependências:** S0-A01/B01.

Subtarefas:
1. Implementar T02/T03 com busca, importação, conteúdo revisável e associação de autoria.
2. Implementar T08/T09 com formulários, previews e versões.
3. Tratar estados vazios, inválidos, carregamento e indisponibilidade.

**Aceite:** usuário importa/corrige artigo, associa personagem e salva perfil; referências pendentes são visíveis. **Revisor:** B. Componentes simples podem ser C1 sob contrato pronto.

### S1-B01 — Ingestão e domínio versionado

**Story:** como sistema, quero preservar fonte e configurações para reproduzir cada produção. **Agente:** B. **Complexidade:** C3. **Dependências:** S0-B01.

Subtarefas:
1. Implementar importação por URL e texto, metadados, trechos e revisão de conteúdo; proteger o fetch contra acesso a endereços internos e redirecionamentos inadequados.
2. Persistir personagem/Bible, ambientes, referências, voz e perfis com versões.
3. Implementar associação autor/personagem, validações e APIs utilizadas por A.
4. Verificar captura incompleta, revisão sem perda do original e referências fixadas.

**Aceite:** conteúdo incompleto bloqueia elegibilidade; atualizar artigo não modifica revisão anterior; URLs inválidas não executam fetch arbitrário. **Revisor:** C.

### S1-C01 — Catálogo e configuração audiovisual

Estado: base técnica entregue e verificada em [registro S1-C01](arquitetura/s1-c01-entrega-v0.1.md).
Repertório e receitas são candidatos; fornecedores reais, evidência de calibração e aceite do gate permanecem pendentes.

**Story:** como sistema, quero saber quais receitas e rotas são permitidas pelo perfil. **Agente:** C. **Complexidade:** C3. **Dependências:** contratos S0-B01 e evidências S0-C01.

Subtarefas:
1. Implementar catálogo inicial de receita/classes de plano e alternativas.
2. Configurar capabilities por modelo/operação: Higgsfield candidata a imagem/animação; voz/avatar separados. Preservar catálogo técnico e escolhas existentes, sinalizando suporte não verificado e limitando somente o repertório recorrente do perfil ao escopo calibrado.
3. Validar requisitos de referências e parâmetros por rota; criar adapters simulados para testes.

**Aceite:** perfil declara repertório permitido e escopo de calibração; capacidade ausente é sinalizada, não ignorada. **Revisor:** B.

**Gate:** seleção artigo/perfil é persistida e validada; não exige plano manual.

## 7. Sprint S2 — Artigo para dossiê automaticamente

### S2-A01 — Criar e inspecionar produção

**Story:** como operador, quero iniciar pelo artigo e acompanhar as decisões geradas quando necessário. **Agente:** A. **Complexidade:** C2. **Dependências:** S1; contratos de S2-B01.

Subtarefas:
1. Implementar T04 com perfil sugerido, orçamento e opções avançadas recolhidas.
2. Implementar T05 inicial com preparação, pendências e inspeção de roteiro/cenas.
3. Implementar resolução de pendências sem obrigar revisão técnica de cada plano.

**Aceite:** inicia com artigo/perfil; informações ausentes são acionáveis; inspeção é opcional. **Revisor:** C.

### S2-B01 — Produção e máquina de estados

Estado: implementado e verificado; ver [entrega S1-A01/S2-B01](arquitetura/s1-a01-s2-b01-entrega-v0.1.md).
Não há planejador automático/worker nem geração nesta entrega; a entrada interna de planejamento foi testada com dossiês sintéticos.

**Story:** como sistema, quero coordenar a preparação com entradas imutáveis e transições válidas. **Agente:** B. **Complexidade:** C3. **Dependências:** S1-B01/C01.

Subtarefas:
1. Criar produção com snapshot das revisões e configurações.
2. Implementar estados, comandos e pré-condições para planejamento.
3. Persistir dossiê, pendências e eventos; disponibilizar acompanhamento.
4. Verificar repetição de comando, transição inválida e alteração da origem.

**Aceite:** mesma revisão permanece identificável; falha de planejamento não parece conclusão; comando repetido não cria trabalho duplicado. **Revisor:** C.

### S2-C01 — Planejador narrativo e audiovisual

**Story:** como operador, quero que o artigo seja transformado em roteiro e cenas coerentes automaticamente. **Agente:** C. **Complexidade:** C4. **Dependências:** S1-C01; schemas S2-B01.

Subtarefas:
1. Extrair argumentos/experiências e produzir roteiro em primeira pessoa com fontes.
2. Selecionar receita, situação narrativa, ambientes e ações permitidos.
3. Gerar planos, composição, continuidade, riscos e alternativas estruturados.
4. Validar schema, referências, alegações sem suporte e campos essenciais; usar tentativas limitadas.
5. Avaliar artigos representativos e adversariais com rubrica humana.

**Aceite:** dossiê completo sem planejamento manual; experiências inventadas e classes não permitidas são bloqueadas/sinalizadas. Não presumir que validação de schema detecta todas as invenções. **Revisor:** B; responsável humano para fidelidade/direção.

**Gate:** AC01–AC04 demonstrados no escopo inicial; plano inválido não vai à geração.

## 8. Sprint S3 — Geração, orçamento e retomada

### S3-A01 — Acompanhamento e pendências operacionais

**Story:** como operador, quero entender progresso e custos sem gerenciar jobs individuais. **Agente:** A. **Complexidade:** C2. **Dependências:** S2-A01; contratos de eventos B.

Subtarefas:
1. Implementar etapas, consumo confirmado/estimado e jobs ativos.
2. Disponibilizar pausar novos jobs, retomar e cancelar com semântica correta.
3. Mostrar falhas, alternativas e limites atingidos.

**Aceite:** pausa não promete interromper fornecedor; ausência de previsão não vira ETA inventado; custos têm origem clara. **Revisor:** B.

### S3-B01 — Orquestrador, idempotência e reserva de custo

**Story:** como sistema, quero executar em background sem duplicar gastos nem ultrapassar a política de orçamento. **Agente:** B. **Complexidade:** C4. **Dependências:** S2-B01; contratos C.

Subtarefas:
1. Implementar fila, persistência de jobs, identificação externa e reconciliação.
2. Implementar chave de execução e Idempotency-Key persistida por intenção/tentativa antes do envio. Repetição ambígua preserva endpoint/corpo/webhook/chave; regeneração deliberada usa nova chave. Cancelamento Higgsfield só é elegível em queued; reconciliar pedidos in_progress.
3. Consultar estimativa Higgsfield com parâmetros da operação e conta; reservar custos de forma atômica antes de jobs concorrentes e reconciliar cobrança/reembolso e moeda. Estimativa indisponível ou margem insegura bloqueia novo gasto.
4. Bloquear novos gastos sem margem segura quando custo é incerto.
5. Testar workers concorrentes, crash após envio, callback repetido/forjado, timeout ambíguo, ownership de consulta/resultados/cancelamento e cancelamento queued/in_progress. Callback sem autenticidade comprovada exige consulta autenticada antes de aplicar resultado.

**Aceite:** orçamento controla compromissos concorrentes; retomada consulta execução existente; valores estimados e confirmados não se confundem. **Revisor:** C em C4.

### S3-C01 — Adapters reais e avaliação dos assets

**Story:** como sistema, quero gerar assets adequados ao plano e registrar resultados corrigíveis. **Agente:** C. **Complexidade:** C4. **Dependências:** gate S0-C01, S2-C01; fila B.

Subtarefas:
1. Integrar imagem e animação candidatas Higgsfield e rotas separadas de voz/avatar validadas no piloto, preservando stack e GenerationAdapter. Não instalar o Studio nem substituir a jornada.
2. Traduzir contratos conforme schema da operação, registrar modelo/referências/parâmetros, executar upload assinado sem credenciais no storage e copiar mídia concluída para AssetStore imutável com hashes/metadados. Não depender da retenção temporária do fornecedor.
3. Implementar ordem imagem validada → animação e áudio validado → avatar conforme rota.
4. Aplicar avaliações, tentativas limitadas e alternativas; sinalizar resultados incertos.
5. Exercitar adapters com fixtures e testes reais autorizados e limitados.

**Aceite:** assets têm proveniência e metadados; capability ausente bloqueia/adapta com registro; job concluído não recebe aprovação humana fictícia. **Revisor:** B; responsável humano para amostras visuais.

**Gate:** AC05/AC08 exercitados e assets reais armazenados. Integração simulada é insuficiente para concluir C01.

## 9. Sprint S4 — Montagem e revisão

### S4-A01 — Player e revisão contextual

**Story:** como operador, quero avaliar o vídeo e apontar problemas por trecho. **Agente:** A. **Complexidade:** C3. **Dependências:** S3; contratos de timeline C/B.

Subtarefas:
1. Implementar T06 com player, cenas, timecodes e transcrição.
2. Criar apontamentos categorizados e comentário livre.
3. Exibir versões, referências e intenção da cena sob demanda.

**Aceite:** apontamento se vincula à versão e ao trecho correto; experiência não exige edição técnica de plano. **Revisor:** C.

### S4-B01 — Assets, timeline e avaliações persistidas

**Story:** como sistema, quero conectar arquivo, versão e avaliação à montagem correta. **Agente:** B. **Complexidade:** C3. **Dependências:** S3-B01/C01.

Subtarefas:
1. Persistir manifesto de assets e timeline versionada.
2. Implementar acesso a previews, integridade dos arquivos e avaliações.
3. Criar estados pronta para revisão/aprovação pendente e contratos de apontamentos.

**Aceite:** vídeo/cena/avaliação apontam à mesma versão; arquivo ausente impede entrega. **Revisor:** C.

### S4-C01 — Render, áudio principal e legendas

**Story:** como operador, quero assistir a uma montagem coerente de avatar, cenas e narração. **Agente:** C. **Complexidade:** C4. **Dependências:** assets S3; contratos S4-B01.

Subtarefas:
1. Construir timeline pelo áudio efetivo, com entradas/saídas e pausas planejadas.
2. Montar avatar e apoio, remover áudio duplicado e aplicar perfil de mixagem.
3. Gerar e alinhar legendas, reservar áreas legíveis e exportar preview.
4. Verificar lip sync, cortes, duração, continuidade vocal e visual em vídeo integral.

**Aceite:** som não duplica; palavras não são cortadas; legendas e cenas acompanham fala; avaliação humana aprova qualidade no recorte testado. **Revisor:** B para reprodução técnica; responsável humano para audiovisual.

**Gate:** vídeo completo pronto para revisão, sem exigir montagem manual externa.

## 10. Sprint S5 — Correção localizada e entrega

### S5-A01 — Correções, comparação e exportação

**Story:** como operador, quero corrigir um trecho e aprovar a versão resultante. **Agente:** A. **Complexidade:** C3. **Dependências:** S4-A01; contratos B/C.

Subtarefas:
1. Exibir proposta de correção, impacto e custo/limite.
2. Comparar versões e permitir editar fala com aviso de dependências.
3. Implementar aprovação vinculada à versão e T07 com downloads.

**Aceite:** usuário entende o que será refeito; versão alterada não mantém aprovação; preview não é apresentado como entrega aprovada. **Revisor:** B.

### S5-B01 — Grafo de dependências e invalidação

**Story:** como sistema, quero refazer apenas elementos afetados sem reutilizar resultados desatualizados. **Agente:** B. **Complexidade:** C4. **Dependências:** S4-B01; comandos C.

Subtarefas:
1. Implementar dependências roteiro/áudio/imagem/avatar/clipe/legenda/timeline.
2. Calcular impacto de alterações e preservar versões anteriores.
3. Invalidar aprovações e agendar correções com limites de custo.
4. Verificar correção só visual, mudança de fala, duração e múltiplas alterações concorrentes.

**Aceite:** AC06/AC07/AC09; alteração visual preserva áudio válido; texto novo invalida derivados necessários. **Revisor:** C em C4.

### S5-C01 — Executor de correções e pacote final

**Story:** como sistema, quero transformar o apontamento em uma correção coerente e uma entrega reproduzível. **Agente:** C. **Complexidade:** C4. **Dependências:** S4-C01; dependências B.

Subtarefas:
1. Classificar origem do erro e propor revisão do plano ou asset responsável.
2. Executar correção e alternativas sem alterar intenção aprovada silenciosamente.
3. Rerenderizar timeline afetada e gerar vídeo, legendas e manifesto.
4. Verificar mídia final e correspondência com assets aprovados.

**Aceite:** correção aborda a causa; fonte é revalidada ao mudar fala; exportação reproduzível no ambiente definido. **Revisor:** B; humano quando a correção altera direção.

**Gate:** AC06–AC10 demonstrados e vídeo aprovado exportável.

## 11. Sprint S6 — Estabilização e liberação do MVP

### S6-A01 — Jornada integral e clareza da operação

**Story:** como operador, quero concluir a produção sem ambiguidade ou falhas de interface. **Agente:** A. **Complexidade:** C2. **Dependências:** S5.

Subtarefas:
1. Verificar jornada principal e pendências em estados reais.
2. Corrigir navegação, foco/teclado, mensagens e previews.
3. Documentar operação e onboarding; preparar checklist de revisão.

**Aceite:** seleção até exportação é navegável; não há ação sem feedback nem exigência escondida de direção manual. **Revisor:** B/C conforme componente.

### S6-B01 — Resiliência e operação de lançamento

**Story:** como operador, quero preservar trabalhos e limites quando serviços falharem. **Agente:** B. **Complexidade:** C4. **Dependências:** S5.

Subtarefas:
1. Exercitar recuperação após reinício, indisponibilidade e falhas concorrentes.
2. Verificar segredos, acesso a mídia, importação URL, backup/restauração e política de retenção definida no PRD.
3. Consolidar logs, métricas, migrações e runbook de implantação/rollback.

**Aceite:** jobs e custos reconciliados após falhas; recuperação de dados demonstrada; requisitos operacionais acordados atendidos. **Revisor:** C em capacidade equivalente.

### S6-C01 — Calibração repetida e critérios de qualidade

**Story:** como responsável editorial, quero evidência de repetibilidade antes de ampliar automação. **Agente:** C. **Complexidade:** C4. **Dependências:** S5; artigos adicionais e rubrica humana.

Subtarefas:
1. Executar artigos de estruturas diferentes dentro da receita/perfil escolhido.
2. Medir aprovação, retrabalho, alternativas, custo e tempo humano.
3. Documentar falhas não detectadas automaticamente e restringir repertório se necessário.
4. Consolidar perfil validado, limitações e backlog de evolução.

**Aceite:** responsável aprova resultados segundo metas definidas antes do ensaio; limites conhecidos ficam explícitos. Pequena amostra não autoriza generalização irrestrita. **Revisor:** B para métricas; responsável para estética/fidelidade.

**Gate final:** critérios AC01–AC10 cobertos; qualidade humana e limites operacionais atendidos. Falha estética impede liberação mesmo com testes técnicos verdes.

## 12. Dependências resumidas

```text
S0 contratos ─→ S1 dados/perfis ─→ S2 planejamento ─→ S3 geração
S0 piloto ─────────────────────────────────────────→ S3 adapters reais
S3 assets ─→ S4 montagem/revisão ─→ S5 correção/entrega ─→ S6 liberação
```

Dentro de cada sprint: contratos curtos primeiro; interface pode usar fixtures; integração depende dos endpoints/jobs reais. A sprint não exige que uma trilha espere o término integral de outra para começar.

## 13. Definition of Ready e Definition of Done

### Ready

Story com contrato disponível; dependências liberadas ou mock explicitamente permitido; entradas de teste; proprietário de arquivos; critérios de aceite; classe de modelo; limites de gastos para testes pagos; nenhuma decisão essencial escondida.

### Done

Implementação integrada; aceite demonstrado; checks pertinentes aprovados; revisão cruzada concluída; versões/erros observáveis; documentação de limitações; nenhuma dependência simulada apresentada como real. Stories críticas exigem testes de cenários de risco, não apenas caminho feliz.

Testes prioritários: fidelidade narrativa, contratos, orçamento concorrente, idempotência, retomada, invalidação e render real. Não criar testes que apenas espelhem componentes triviais ou comparem texto de prompts. Avaliação visual humana é evidência adicional, não substituída por unit tests.

## 14. Envelope para atribuição a um agente

```text
Story: [ID e objetivo]
Agente/frente: [A, B ou C]
Complexidade mínima/modelo: [classe e esforço]
Entradas: [documentos, contratos, fixtures, evidências]
Dependências liberadas: [IDs]
Arquivos/áreas de propriedade: [escopo]
Subtarefas: [lista da story]
Critérios de aceite: [condições verificáveis]
Limites: [gastos, tentativas, alterações proibidas]
Revisor: [outro agente e nível necessário]
Entrega: [alterações, verificação, decisões, pendências]
```

Se o agente precisar alterar contrato compartilhado, interrompe somente a mudança dependente e propõe atualização ao proprietário. Dificuldade inesperada pode elevar a classe do modelo; não reduzir escopo de qualidade para caber no modelo escolhido.

## 15. Consolidação para o PRD

Antes da execução integral, incorporar este backlog ao PRD, fechar decisões de S0 e transformar cada story em item rastreável. Estimar esforço após decomposição na stack escolhida; redividir stories grandes sem remover critérios de aceite. Prioridade é a vertical artigo → vídeo revisável, seguida de correção confiável e liberação.

Não incluem estas sprints: publicação externa, lotes automáticos, qualquer CMS, editor livre, treinamento próprio ou aprovação estética inteiramente automática. Essas evoluções recebem backlog separado após evidência do MVP.
