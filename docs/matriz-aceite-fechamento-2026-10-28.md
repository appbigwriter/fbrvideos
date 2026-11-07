# Matriz de rastreabilidade — fechamento FBRVideos

Data: 28/10/2026. Escopo normativo: [produto v0.1](projeto-base-sistema-v0.1.md), [tasklist de fechamento](tasklist-fechamento-2026-10-28.md). Esta matriz distingue implementação de aceite audiovisual. A baseline `npm run verify` aprovada em 28/10 cobre 164 testes (162 passaram; 2 exigem PostgreSQL nativo). As alterações desta continuação precisam de nova rodada registrada na entrega.

Estados: **T** = implementação técnica com testes locais; **P** = parcial ou divergente; **E** = implementação existente com aceite real externo pendente. “T” não significa qualidade audiovisual validada.

## Requisitos funcionais

| ID | Estado inicial | Código/interface | Evidência automatizada disponível | Fechamento |
| --- | --- | --- | --- | --- |
| RF01 — importar URL revisável | T | `infra/src/article-capture.ts`, `domain/src/configuration.ts`, `ArticlesConnected.tsx` | `infra/test/configuration.test.ts`: extração, proteção SSRF, captura incompleta e recaptura | FC-20, revisão da captura pelo operador |
| RF02 — texto manual | T | `ArticleEditor` em `ArticlesConnected.tsx`, `SaveArticleSchema` | `configuration.test.ts`: artigo persistido/reaberto e revisão | FC-20 |
| RF03 — autoria, personagem e Bible | T | `ConfigurationService`, `UniverseConnected.tsx`, originais por hash | `configuration.test.ts`: original imutável, personagem e voz, associação revisada | Insumo autorizado em FC-09 |
| RF04 — referências/perfis versionados | P | `ConfigurationService`, `ReferenceEditor`, `ProfileEditor` | `configuration.test.ts`, `audiovisual-api.test.ts` | Cadastro existe; baseline não oferece upload/aprovação de mídia de referência. Habilitação de perfil após calibração depende de FC-03/FC-15 |
| RF05 — artigo/perfil sem cena manual | P | `ProductionService`, `CreateProductionPage`, `ProductionPipeline` | `production.test.ts`, `production-integration.test.tsx` | FC-03–FC-08 resolvem aprovações intermediárias obrigatórias na recorrência |
| RF06 — roteiro/direção rastreáveis | E | `planner.ts`, `semantic-planner.ts`, `source-reaudit.ts`, `DossierPanel` | `planner.test.ts`, `semantic-planner.test.ts`, `source-reaudit.test.ts` | Fidelidade real e julgamento em FC-13 |
| RF07 — receitas/repertório | E | catálogo, planejadores e `checkAudiovisualConfiguration` | `catalog.test.ts`, `audiovisual-api.test.ts` | FC-10/FC-15: primeira receita e escopo validados |
| RF08 — voz/avatar/apoio/montagem | E | `runtime-composition.ts`, `real-pipeline-bindings.ts`, `assembly-service.ts` | `real-pipeline-bindings.test.ts`, `production-pipeline.test.ts`, testes clients | FC-11–FC-13: composição da conta e mídia real |
| RF09 — background/recuperação | T/E | worker, fila, journal, leases e `recover` | `generation-queue.test.ts`, `database-recovery.test.ts`, `production-pipeline.test.ts` | FC-08 nativo e FC-14 real |
| RF10 — gastos/tentativas | T/E | `generation-queue.ts`, `budget-workflow.ts`, retry | `generation-queue.test.ts`, `normalized-provider-adapters.test.ts`, `production-pipeline.test.ts` | FC-06/FC-12; orçamento por período de T10 ainda não coberto pela baseline |
| RF11 — correção localizada | T/E | `review-workflow.ts`, `ProductionPipeline`, `ReviewConnected.tsx` | `review-workflow.test.ts`, `production-pipeline.test.ts` | FC-14 |
| RF12 — invalidar derivados/aprovações | T | `domain/src/dependencies.ts`, `review-workflow.ts` | `dependencies.test.ts`, `review-workflow.test.ts`, proveniência | FC-08/FC-14 |
| RF13 — vídeo/legendas aprovados | T/E | `delivery.ts`, delivery store, render, `DeliveryConnected.tsx` | `delivery.test.ts`, `local-renderer.test.ts`, `review-delivery.test.tsx` | FC-13/FC-20 |
| RF14 — inspeção/histórico | T | dossiê, fontes, histórico de renders, comparação | `planning-ui.test.ts`, `review-workflow.test.ts`, testes web | FC-20 com operador |

## Aceites AC01–AC10

| ID | Prova técnica | Prova final pendente |
| --- | --- | --- |
| AC01 — iniciar sem especificar cenas | criação e planejamento automáticos; `production.test.ts` | FC-08 para recorrência simplificada; FC-13 real |
| AC02 — fonte incompleta bloqueia | elegibilidade e schema; `configuration.test.ts`, `production-integration.test.tsx` | FC-20 navegador |
| AC03 — primeira pessoa fiel à fonte | pointers/hash e reauditoria; `semantic-planner.test.ts`, `source-reaudit.test.ts` | FC-13 julgamento editorial |
| AC04 — direção dentro do perfil | catálogo, snapshot e inspeção; `audiovisual-api.test.ts` | FC-13 identidade/referências reais |
| AC05 — retomar sem duplicar | journal/recibos/leases; `generation-queue.test.ts`, `production-pipeline.test.ts` | FC-08 nativo e FC-14 real |
| AC06 — correção visual preserva áudio | grafo/replacements; `dependencies.test.ts`, `production-pipeline.test.ts` | FC-14 comparação real |
| AC07 — fala altera derivados corretos | `editSpeech`, source reaudit e invalidação | FC-14 fala/lip sync/legenda reais |
| AC08 — teto bloqueia novos jobs | reserva atômica, margem e resultado incerto; testes de fila | FC-12 orçamento da conta; não provocar gasto além do teto para provar bloqueio |
| AC09 — nova versão exige aprovação | aprovação fixa render/hash; `review-workflow.test.ts` | FC-14 e conferência dos downloads |
| AC10 — entrega íntegra e legível | renderer/probe, SRT/VTT, manifesto; testes assembly/delivery | FC-13/FC-20 revisão integral humana |

## Telas T01–T10

Rotas reais estão em `apps/web/src/AppRoutes.tsx`; os antigos placeholders de `ShellPages.tsx` não representam a interface conectada.

| Tela | Implementação existente | Lacuna inicial / destino |
| --- | --- | --- |
| T01 Início | `HomeConnected`: produções, estados, pendências e links | Não traz consumo por período/jobs/artigos recentes; completar no fechamento |
| T02 Artigos | `ArticlesConnected`, filtros autor/personagem/status/texto, paginação/importação | Blog/categoria não são entidades na baseline; sincronização RF15 fica fora do MVP |
| T03 Artigo | revisão fixada, edição, recaptura, autoria, criar vídeo | Imagens originais e produções vinculadas não aparecem no detalhe inicial |
| T04 Criar produção | artigo/perfil, modos, overrides e elegibilidade | FC-03–FC-08 para avanço recorrente conforme política |
| T05 Acompanhamento | progresso, jobs, custos, pendências, candidatos e orçamento | FC-07: distinguir liberação operacional, humana e exceção |
| T06 Revisão | player, cenas, apontamentos, fala, impacto/custo e histórico | FC-14/FC-20: prova real e usabilidade |
| T07 Entrega | downloads/preview/manifesto vinculados à versão | FC-13/FC-20 |
| T08 Perfis | CRUD versionado, recipe/capabilities, formatos e orçamento | Habilitação pública precisa de evidência de calibração, sem aceitar status validado no CRUD genérico |
| T09 Universo | Bíblia preservada, interpretação, referências/voz/variações | Upload/preview/aprovação de referência inicialmente ausentes; completar workflow próprio |
| T10 Configurações | operação, catálogo, calibração e dry-run retenção | Configuração efetiva fica no servidor; faltam preferências de fuso e limite por período na baseline. Blogs/associação automática não podem ser apresentados como existentes |

## Requisitos operacionais

| Tema | Código/evidência | Condição de fechamento |
| --- | --- | --- |
| Background e persistência | API/worker separados, PostgreSQL, pg-boss, leases | FC-08/FC-17 |
| Adapters uniformes | `GenerationAdapter`, adapters normalizados e composição | FC-11/FC-12 |
| Estimativa/compromisso/confirmado separados | fila/budget/quotes/billing tardio | FC-06/FC-12; manter desconhecido distinto de zero |
| Segredos e acesso | acesso privado, cookies HttpOnly, journal filtrado | `operational-api.test.ts`, `operations.test.ts`; FC-17/FC-20 no destino |
| Exportação explícita | snapshot do perfil, timeline, render e manifesto | FC-13/FC-19 |
| Português e fuso | interface em português; datas persistidas UTC | Preferência e exibição consistente precisam ser verificadas em FC-20 |
| Falhas acionáveis | IssueSchema, bloqueios, mensagens de UI | FC-07/FC-20 |
| Backup/restore | `full-backup.ts`, hashes e histórico | testes de backup; FC-18 com mídia real |
| Retenção | dry-run e executor protegido existentes | configuração do comprovante/guard depende de FC-18; não habilitar descarte por padrão |
| Runtime/volume | Node 24, ffmpeg/ffprobe, ingestão até 100 MB/input | FC-16–FC-19; limite de streaming não amplia ingestão |

## Interpretação consolidada do escopo

O MVP continua supervisionado durante calibração e exige revisão final humana. Depois de um perfil ser validado para um recorte declarado, as verificações de política podem liberar etapas operacionais sem criar avaliações humanas fictícias. Artigo novo não dispara geração automaticamente; RF17 continua fora do MVP. Aprovações A–F do protocolo antigo são instrumentos do piloto, não uma exigência de formulário por cena em todas as execuções.

Os achados de implementação desta matriz foram encaminhados às frentes responsáveis: política/habilitação de perfil; upload/aprovação de referência; resumo e detalhe do artigo; configuração/limites operacionais. O registro final de entrega deve anexar os testes novos e atualizar estes estados conforme o código efetivamente integrado. Pendências FC-09–FC-15 permanecem externas enquanto não houver mídia real, autorização e julgamento.

## Atualização de implementação — 29/10/2026

O quadro acima é o diagnóstico inicial. O [registro de entrega](arquitetura/entrega-fechamento-2026-10-29.md) é a evidência posterior e descreve os limites do fechamento técnico.

- RF04/T09: upload, preview e aprovação humana por revisão implementados; backup e retenção preservam arquivos históricos.
- RF05/T04/T05: política recorrente versionada, liberação operacional distinta de aprovação humana, alternativas limitadas e revisão voluntária de roteiro implementadas.
- RF10/T10: teto por intervalo da instalação acrescentado ao orçamento por produção, com reservas globais serializadas e rechecagem antes do envio.
- T01/T03: consumo/trabalhos/artigos recentes e imagens/produções vinculadas acrescentados.
- T08: ativação explícita de perfil a partir de decisão persistida de calibração e prova de conteúdo imutável implementada.
- T10: configurações versionadas de blogs/autoria/fuso e diagnóstico local de capabilities entregues. Diagnóstico local não é teste autenticado da conta.
- Aceites reais RF06–RF08/AC03–AC10 permanecem vinculados ao piloto, corpus e responsável humano. Não foi alegada validação de fornecedores nem publicação em produção.