# S0-B01 — arquitetura e contratos v0.1

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Data: 4 de outubro de 2026. Responsável: frente B. Base: os quatro documentos de produto, especificação, sprints e fila Sol/Antigravity em `docs/`. Esta entrega é a fundação técnica S0; a viabilidade audiovisual real depende de S0-C01.

## Decisões registradas

| Decisão | Escolha e motivo | Estado / impacto |
|---|---|---|
| ADR-001 — stack | Preservar o scaffold encontrado: Node 24.11.1, TypeScript estrito, React + Vite, Fastify e Zod. Workspaces npm. Contratos e domínio independentes das apps. | Implementado na base; versões resolvidas ficam no package-lock. Nenhuma escolha de Next/Supabase é inferida do blog de origem. |
| ADR-002 — persistência | PostgreSQL para registros, versões, eventos, custos e outbox. Registros editoriais append-only; referências `(id, version)` fixadas. Alterações operacionais também deixam eventos. | Decidido para S1/S3; banco/migrações/repositórios reais ainda não implementados. B responde pela implementação. |
| ADR-003 — fila | pg-boss no mesmo PostgreSQL, com worker separado da API. Reserva de custo e criação do comando/outbox na mesma transação; reconciliação de job externo antes de repetição. | Decidido para S3-B01; não há worker executável, reserva concorrente ou fila real nesta entrega. Versão/capacidades da biblioteca serão verificadas ao integrar. |
| ADR-004 — arquivos | Filesystem privado no desenvolvimento, atrás de AssetStore. Chaves imutáveis e hashes; banco guarda metadados. Porta permite object store privado na implantação. | Porta implementada; backend não implementado. URLs temporárias de download pertencem à API; credenciais/paths de disco não vão à UI. |
| ADR-005 — execução de fornecedor | GenerationAdapter com operação audio/image/avatar/animation/render, separada de rota visual. Capabilities declaram suportes e evidências. Timeout mantém unknown; nunca pressupor cancelamento externo. | Fronteira implementada; SDKs/provedores reais dependem do piloto. Sem integrações pagas ou credenciais. |
| ADR-006 — revisão | Conclusão de Job não equivale a Evaluation.approved. Sinais de modelos não aprovam. Revisão final humana exige declaração integral e render exato. Aprovação intermediária A–F pertence ao piloto/calibração, não é formulário cotidiano obrigatório. | Schemas e guards implementados; persistência, invalidação automática e auditoria vêm nas stories seguintes. |
| ADR-007 — C1 | Antigravity recebe apresentação com rotas, DTOs e callbacks definidos; não decide domínio nem instala dependências. | AG-01 depende da revisão do desenho A e disponibilidade da base; B não implementou shell/telas C1. |

## Fronteiras e propriedade

| Diretório | Proprietário / conteúdo |
|---|---|
| apps/web | A coordena comportamento; Antigravity implementa partes C1 delimitadas. |
| apps/api, apps/worker, packages/domain, packages/infra | B: casos de uso, API, versões, orçamento e execução. |
| packages/contracts | B coordena; A revisa projeção/rotas; C revisa adequação audiovisual. Import público `@fbr/contracts`, fixtures `@fbr/contracts/fixtures`. |
| packages/pipeline | C: planejamento, adapters, catálogo e montagem. |
| configuração raiz | B coordena com root; mudança compartilhada requer aviso. |
| docs/ux, docs/piloto, docs/arquitetura | A, C e B respectivamente; documentos originais preservados. |

O scaffold `apps/*`, os README de fronteiras, package.json, tsconfig.json, `.env.example` e `.gitignore` já existiam quando B iniciou. B acrescentou schemas, portas, projeções, fixtures, guards, testes e estas decisões. Nenhum bootstrap preexistente é apresentado como tela implementada ou integração real.

## Convenções do contrato

- `CONTRACT_VERSION = 0.1.0`; objetos de fronteira são estritos. Campos de payload usam snake_case.
- `id` opaco estável (sem significado sequencial), `version` inteiro positivo. Referências sempre carregam ambos. Criação UTC ISO, autor e histórico de mudanças obrigatórios nas entidades versionadas.
- Custos em unidades menores inteiras (`*_minor`), moeda ISO de três letras. `confirmed_minor` é gasto já reconciliado; `committed_minor` é reserva ainda não confirmada. Ao confirmar, a reserva correspondente sai do comprometido para evitar dupla contagem. Estimativa ausente usa null; margem + confirmados + compromissos + limite superior do novo job devem caber no teto.
- Orçamento acima do teto pode existir em histórico após reconciliação; isso impede novos jobs, sem esconder custo real. BudgetPreflight é apenas guarda local, não reserva concorrente.
- ProductionState é público; JobState e EvaluationState são internos independentes. Não há percentual ou ETA fictício no DTO.
- Fontes de falas carregam documento/revisão/trecho. Referência presente prova rastreabilidade estrutural; não prova que uma alegação seja verdadeira nem que uma experiência seja sustentada pelo trecho. Avaliação editorial/humana continua necessária.
- Parâmetros essenciais ausentes podem existir em rascunhos; elegibilidade bloqueia execução. Perfil não validado permite só calibração, com configuração essencial completa.
- Assets imutáveis carregam metadados, origem, referências, configuração, execução, permissão e avaliações. Status aprovado sem direito de uso/evidência de avaliação não passa. InspectDossier confere a avaliação do alvo exato.
- Execution key registra hash das entradas versionadas/configuração; tentativa identifica regeneração intencional. O hash é campo de contrato, não um scheduler nem garantia de unicidade persistente já implementada.
- `current_render` é Asset de tipo render. FinalApproval/produção/entrega apontam à versão exata. Preview continua identificado; a ação `export` da UI é entrega aprovada, e preview usa ação de visualização separada.
- Credenciais não pertencem aos contratos. Objetos JSON `parameters`/`sent_parameters` são permitidos só na fronteira interna; adapters precisam filtrar segredos antes de registrar. Validação estrita de DTOs não é um redactor universal.

## API de aplicação — contrato antes de endpoints

| Operação planejada | Entrada / resultado | Story |
|---|---|---|
| Criar produção | CreateProductionRequest: command_id, revisão artigo/perfil, nome, modo e overrides opcionais; devolve ProductionView. Não pede planos. | S2-B01 |
| Ler artigo/perfil/produção | ID e revisão explícita ou projeção atual; retorno validado por schemas compartilhados. | S1-B01 / S2-B01 |
| Pausar/retomar/cancelar | ProductionCommand com command_id e revisão esperada; comandos não prometem interromper fornecedor já iniciado. | S3-B01 |
| Aprovar versão final | ProductionCommand approve_final com render fixado e reviewed_in_full; domínio verifica avaliação humana e ausência de pendências. | S4/S5 |
| Executar adapter | AdapterRequest + capabilities; accepted com Job ou blocked com Error; query/cancel podem responder capability_missing. | S1-C01 / S3-C01 |

As rotas HTTP de aplicação ainda não estão implementadas; o scaffold só possui `/health`. Erros usam código, mensagem, retryable, correlation_id e issues com causa/impacto/próxima ação. Futuramente: erro de forma 400, ausência 404, versão/transição 409, elegibilidade/orçamento 422; não incluir exceção interna ou segredo na resposta. command_id terá deduplicação persistente e revisão esperada terá compare-and-swap. O contrato representa estas entradas; S0 não finge implementá-las.

## Decisões abertas

| Pendência | Responsável | Efeito |
|---|---|---|
| Artigo real, voz/referências, rubrica, receita, formato e limites do piloto | Humano com C | Character Bible recebido em docs/fontes/04-game-style-tara-lindqvist.md. Sem avaliação/evidência audiovisual real, S0-C01 e integrações pagas S3 permanecem pendentes. |
| Hospedagem, object store, retenção, backup e restauração | B + operador | Define política de mídia, capacidade e runbook; porta evita acoplamento. |
| Autenticação e proteção operacional do deployment | B + operador | Bootstrap local não pode ser liberado publicamente como app seguro. |
| Perfil técnico final e capacidades de cada fornecedor | C | Fixtures não escolhem resolução/duração/fornecedor de produção. |
| Projeções T04 adicionais e comandos detalhados de apontamento/correção/autorização de custo | A/B/C nas stories S2/S4/S5 | Não bloqueia o shell AG-01; não delegar lógica inexistente como C1. |
| Implementar invalidação, guarda de geração por rota e transações de orçamento | B/C em S3/S5 | Preflight e schemas não autorizam jobs pagos nem garantem resiliência concorrente. |

## Verificação e limitações

`npm run verify` verifica tipos, cenários de contrato e build do bootstrap web; não é teste de fornecedores, render ou qualidade visual. A suíte cobre fontes/revisões inválidas, elegibilidade, classes proibidas, avaliação obrigatória, orçamento/compromissos, timeout, trim, assets desatualizados, aprovação/render e distinção preview/entrega.

Neste Windows, o wrapper npm do PATH apontava para instalação ausente. Usar o npm distribuído com Node: `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run verify`. O runner tsx falhou no sandbox restrito com `uv_os_get_passwd returned ENOMEM` antes de executar qualquer teste; `test:contracts` passou fora do sandbox após aprovação. Não alterar o framework para esconder a limitação. O código e dependências continuam locais.

Todas as fixtures são sintéticas; hashes/URIs/arquivos e aprovações de demonstração não são evidência operacional. Não há mídia real, banco, fila, scraping, SDK de geração, render de vídeo, publicação ou integração paga nesta base. Ausência de insumos de piloto não impede contratos/UX, mas mantém o gate audiovisual pendente.

## ADR-008 — Higgsfield como candidata ao pipeline

Decisão aceita pelo responsável: utilizar o caminho de aplicação existente; preservar ADR-001–007 e contrato 0.1.0. Higgsfield é candidata às operações image/animation atrás de GenerationAdapter. HeyGen segue candidato a avatar e voz compatível, com áudio oficial separado. Não há adapter real nesta entrega.

S3 deverá persistir intenção/tentativa e idempotência antes do envio, request_id após aceitação, ownership, parâmetros e custos; reservar orçamento atomicamente e reconciliar resultados/reembolsos. Webhooks sem autenticidade documentada são sinais para consulta autenticada. Cancelamento só queued; resultados são copiados para AssetStore. Capabilities específicas são entregues por C conforme evidência; banco/fila/storage seguem pendentes. Ver decisão de integração vinculada acima.

## Evolução S1-B01

ADR-002 foi concretizada em migração e adapter PostgreSQL para configuração/revisões/Bibles/comandos. Estado histórico S0 acima continua identificado como base; implementação e limites atuais estão em [S1-B01](s1-b01-entrega-v0.1.md). O servidor de destino ainda precisa ser validado; testes usam PGlite PostgreSQL embarcado. Bibles textuais ficam no PostgreSQL; AssetStore de mídia, pg-boss e geração pertencem a S3. Contrato 0.1.0 foi estendido por novos exports, sem modificar os exports consumidos em AG-01.
