# FBRVideos — tasklist remanescente

Auditoria de 6 de outubro de 2026. Base: código atual de `apps/`, `packages/`, sprints S0–S6 e registros de execução. Esta lista orienta o próximo trabalho e substitui a classificação de pendências do registro anterior; não declara implementação dos itens abaixo.

## Diagnóstico

Há fundações implementadas e verificadas, mas ainda não existe uma jornada integrada de geração inicial até vídeo exportável pelos serviços públicos do aplicativo. Fila, clientes REST, persistência de mídia e montagem são componentes distintos que ainda precisam de composição concreta.

Credenciais externas bloqueiam geração paga e validação da conta/qualidade. Não bloqueiam a implementação de orquestração, adapters normalizados, ingestão de outputs, avaliação de assets, recuperação ou ensaios locais com mídia sintética. Essas tarefas são internas e estão abertas.

| Sprint | Estado técnico observado | O que falta para fechar |
| --- | --- | --- |
| S0 | Contratos, arquitetura, protótipos e catálogo disponíveis | Piloto audiovisual com insumos reais e avaliação humana |
| S1 | CRUD versionado e telas integradas ao banco | QA humana da jornada; configurações reais conforme piloto |
| S2 | Planejador, dossiês, fontes e aprovação de planejamento implementados | Conectar planejamento aprovado ao início efetivo da geração; validar fidelidade em corpus real |
| S3 | Fila, orçamento, leases, journal, transporte e clientes REST implementados | Orquestrador concreto, adapters normalizados, outputs persistidos/avaliados e recuperação integral |
| S4 | Renderer FFmpeg, montagem transacional, legendas e revisão implementados | Acionamento automático da montagem, avaliação dos inputs, alinhamento/qualidade e jornada com preview |
| S5 | Grafo, invalidação, planos persistidos, comandos de correção e entrega implementados | Compilar/executar correções pela jornada, resolver linhagem de outputs e demonstrar reexecução integrada |
| S6 | Acesso privado, telemetria agregada, backup/restore e funções de retenção/calibração disponíveis | Jornada integral, recuperação dos novos fluxos, operação de lançamento e calibração persistida/repetida |

Não há evidência suficiente para declarar S3–S6 integralmente concluídas. S0–S2 conservam seus gates humanos pendentes.

## Entregas a preservar

- [x] Domínio versionado, snapshots e contratos compartilhados.
- [x] Planejamento narrativo via OAuth, auditoria de fontes e comandos idempotentes.
- [x] Fila PostgreSQL/pg-boss, reserva atômica de orçamento, leases e tratamento conservador de resultados incertos.
- [x] Journal HTTP imutável, clientes Higgsfield/HeyGen e transferência restrita de mídia.
- [x] AssetStore local por hash, montagem/render FFmpeg, timeline e serialização de legendas.
- [x] Apontamentos contextuais, histórico, edição de fala, invalidação, aprovação final e manifesto.
- [x] Integração técnica AG-08/AG-09, acesso privado, backup/restauração e agregados operacionais.

Os marcadores acima indicam entrega técnica dos componentes, não aceite audiovisual nem integração completa entre todos eles.

## P0 — completar o caminho funcional sem APIs externas

Todos os itens desta seção estão **abertos e implementáveis localmente**. Não habilitar gasto real como consequência de ensaios sintéticos.

### TL-01 — Orquestrador persistente da geração inicial

- [ ] Implementar serviço que compile dossiê aprovado em intenções de áudio, imagem, animação e avatar, conforme capabilities/receita.
- [ ] Conectar a ação pública de início à aprovação, elegibilidade, orçamento e `beginGeneration`, com feedback de pendências.
- [ ] Persistir progresso e dependências: imagem avaliada antes de animação; áudio avaliado antes de avatar; inputs aprovados antes de montagem.
- [ ] Retomar avanço após reinício, com concorrência controlada e comandos idempotentes.

**Sprint:** S2-B01, S3-B01/C01. **Dependências:** fundações existentes; integração final com TL-02–TL-06. **Aceite:** planejamento aprovado inicia trabalho pelo aplicativo; repetição/reinício não duplica intenções ou reservas; pausa impede novos envios; capability ausente produz pendência explícita.

### TL-02 — Adapters normalizados e composição concreta de runtime

- [ ] Implementar bindings de `GenerationAdapter` para os clientes Higgsfield e HeyGen, configuráveis por conta/modelo/operação.
- [ ] Normalizar recibos, estados, status URLs, cancelamento, custos conhecidos/desconhecidos e outputs, preservando proveniência.
- [ ] Entregar módulo concreto `createProviderRuntime` que componha fila, arquivos, admissão e avanço; configuração incompleta mantém rotas reais fechadas.
- [ ] Exercitar respostas de sucesso, erro, resultado incerto e faturamento tardio por transporte mockado.

**Sprint:** S3-C01. **Dependências:** clientes/journal existentes. **Aceite:** módulos concretos carregam e passam contratos sem credenciais; não fabricam custo, estado final ou aceite. Validação ao vivo fica em EX-02.

### TL-03 — Ingestão persistente de outputs iniciais

- [ ] Resolver referências de inputs aprovados e uploads necessários sem expor segredos ao storage.
- [ ] Copiar outputs para armazenamento imutável, ligar `probeLocalMedia` à ingestão e registrar hash, bytes, duração/dimensões medidas, job e configuração.
- [ ] Publicar candidatos no dossiê atual com ownership e controle de versão; separar conclusão do job de avaliação da mídia.
- [ ] Recuperar downloads/publicações interrompidos sem perder outputs nem duplicar revisões.

**Sprint:** S3-C01, S4-B01. **Dependências:** TL-02; transferência/MediaStore existentes. **Aceite:** output concluído aparece como candidato íntegro e rastreável; URL expirada, hash incorreto ou mídia inválida gera impedimento; nenhuma aprovação humana automática.

### TL-04 — Avaliação e preview dos assets candidatos

- [ ] Criar API e interface para ouvir áudio e examinar imagem/clipe candidato, com aprovação/rejeição vinculada à revisão exata.
- [ ] Separar verificações determinísticas, sinal de modelo e julgamento humano; registrar direitos/referências e motivos de rejeição.
- [ ] Propagar avaliação para dossiê e dependências do orquestrador, com tentativas/alternativas limitadas.

**Sprint:** S3-A01/C01, S4-B01. **Dependências:** TL-03 e TL-05. **Aceite:** rejeitado não alimenta avatar/animação/montagem; candidato aprovado libera só suas dependências; edição posterior invalida o necessário. A jornada não exige direção manual de cada plano.

### TL-05 — Linhagem de mídia entre geração, avaliação e cobrança

- [ ] Definir e implementar vínculo imutável entre output original, revisões de avaliação e revisões posteriores do mesmo job.
- [ ] Revisar `publishCorrectionAssets`: hoje exige referências exatas ao job atual e aos outputs dele; isso precisa ser exercitado quando candidato v1 vira aprovado v2 ou a cobrança muda a revisão do job.
- [ ] Preservar validação de hash/configuração/ownership; aceitar apenas descendência comprovada, nunca igualdade de ID isolada.

**Sprint:** S3-C01, S4-B01, S5-B01/C01. **Dependências:** contratos existentes. **Aceite:** testes candidato → aprovação → publicação e cobrança tardia passam; asset de outro job/produção ou bytes alterados são recusados. Trata-se de risco de integração a confirmar e corrigir, não de falha observada em produção real.

### TL-06 — Montagem automática e mídia sintética utilizável

- [ ] Entregar adapter local de ensaio que produza arquivos reais sintéticos; o simulador atual registra jobs, mas não gera a mídia necessária à jornada.
- [ ] Compilar `AssemblyBindings` de áudio/clipes/música/transições a partir do dossiê e recipe, e chamar `LocalAssemblyService` pelo fluxo persistente.
- [ ] Recuperar publicação/montagem após reinício, inclusive quando os jobs já terminaram e não haverá novo callback de sucesso.

**Sprint:** S4-C01, S6-B01. **Dependências:** TL-01, TL-03–TL-05. **Aceite:** inputs aprovados produzem MP4/timeline/SRT/VTT e estado de revisão sem montagem manual externa; reinício não gera duas publicações; ensaio não altera produções existentes.

### TL-07 — Compilador e executor integrado de correções

- [ ] Implementar `prepareCorrection` concreto: classificar origem, calcular impacto, compilar operações e estimativa do plano.
- [ ] Conectar autorização → execução → ingestão/avaliação → replacements → nova montagem; preencher o hook `advance` com implementação recuperável.
- [ ] Tratar correção visual, edição de fala, rejeição, alternativas e concorrência, sem alterar intenção aprovada silenciosamente.

**Sprint:** S5-A01/B01/C01. **Dependências:** TL-01–TL-06. **Aceite:** apontamento no aplicativo chega a novo preview; correção visual preserva áudio válido; mudança de fala refaz derivados; plano desatualizado não executa; apontamento exige decisão própria na nova revisão.

### TL-08 — Jornada integrada local do artigo à entrega

- [ ] Exercitar APIs e interface públicas: artigo/perfil → planejamento → geração sintética → avaliação → montagem → apontamento/correção → aprovação final → downloads/manifesto.
- [ ] Executar em banco/arquivos de ensaio isolados, sem semear produção já pronta para revisão para contornar etapas.
- [ ] Conferir bytes/hashes e versão aprovada, erros acionáveis e navegação por teclado/mobile com preview real.

**Sprint:** S6-A01; valida S2–S5. **Dependências:** TL-01–TL-07. **Aceite:** operador conclui a jornada sem chamadas internas manuais; testes documentam reinício, rejeição e custo pendente; resultados são explicitamente sintéticos, sem aceite editorial real.

## P1 — robustez e fechamento operacional

| ID / checklist | Sprint | Dependências | Resultado e prova de conclusão |
| --- | --- | --- | --- |
| TL-09 — [ ] Validar formatos e duração medida | S3-C01/S4-C01 | Código de probe/render atual; conectar em TL-03 | Exercitar PNG/JPEG/WebP, WAV/MP3/MP4 e entradas inválidas; duração vocal por samples decodificados; render JPEG/MP3; registrar resultados. As últimas mudanças de probe/extensões ainda não têm evidência global completa. |
| TL-10 — [ ] Consolidar callbacks e reconciliação periódica | S3-B01/S6-B01 | TL-02/TL-03 | Inbox persistente/deduplicação se a rota usar webhook; consultar fornecedor antes de confiar em callback; polling recupera eventos perdidos, autenticação falha e indisponibilidade sem novo gasto. |
| TL-11 — [ ] Completar orçamento de ponta a ponta | S3-A01/B01 | TL-01/TL-02 | Estimativa vinculada aos parâmetros, validade/cobrança/reembolso e resolução explícita de estouro; mostrar pendência no app. Moedas incompatíveis bloqueiam sem evidência de conversão; testes de cobrança tardia e concorrência. |
| TL-12 — [ ] Alinhar legendas e verificar mixagem | S4-C01 | TL-03/TL-06 | Port para timings/alinhamento, segmentação legível e áreas reservadas conforme perfil; verificar loudness/picos e ausência de fala cortada/áudio duplicado. Legendas atuais por trechos medidos não demonstram sincronismo por palavra nem lip sync. Qualidade humana segue EX-03. |
| TL-13 — [ ] Concluir recuperação da jornada | S6-B01 | TL-01–TL-07 | Reiniciar após envio, download, avaliação, publicação e render; recuperar jobs/avanço/custos sem duplicar effects; outage/retry/cancelamento concorrente; restore de ensaio com mídia gerada pelo novo fluxo. |
| TL-14 — [ ] Consolidar operação e lançamento local | S6-A01/B01 | TL-08/TL-13 | Scripts/runbook de início, parada, diagnóstico e retomada; readiness dos componentes, logs/contadores úteis, migração e rollback ensaiados; onboarding conforme jornada real. Instalação externa segue EX-04. |
| TL-15 — [ ] Persistir calibração e suas evidências | S6-C01 | TL-08; função de relatório existente | Coletar observações versionadas de aprovação/retrabalho/alternativas/custo/tempo; API/tela de relatório por escopo; ausência permanece desconhecida. Validação de perfil exige evidência e decisão humana, não só relatório calculado. |
| TL-16 — [ ] Operacionalizar retenção com segurança | S6-B01 | AssetStore/backup existentes | Inventário e dry-run verificável; execução configurável que revalida referências/histórico antes de remover órfãos; testes de concorrência e restore. Política/descarte reais somente após EX-04; a função atual só calcula o plano. |

## P2 — ajustes após a jornada integrada

- [ ] **TL-17 — Escala de acesso à mídia (S4-B01/S6-B01):** definir limite operacional, acrescentar ranges em vídeos históricos e streaming de leitura/transferência quando necessário. Hoje há buffers e limite de 100 MB. Aceite: seek histórico e arquivos dentro do limite escolhido funcionam sem carga integral desnecessária; port de storage externo pode ser implementado localmente. Provisionar limite maior não exige contratar storage.
- [ ] **TL-18 — Reauditoria após editar fala (S2-C01/S5-C01):** integrar rechecagem semântica de fonte/direção, além da integridade de ponteiros e declaração humana já existentes. Aceite: fala incompatível gera pendência e perde aprovação; registro mantém fonte, revisão e resultado da auditoria. Depende de TL-07; avaliação editorial segue EX-03.

P2 não condiciona a primeira demonstração sintética quando o limite local e a revisão humana explícita forem suficientes; registrar essas restrições no ensaio.

## Dependências externas — sem bloquear os itens internos

| ID / status | Insumo ou ação | Libera |
| --- | --- | --- |
| EX-01 — [ ] Aguardando insumos | Artigo real, referências visuais autorizadas, voz/look e responsável pela revisão. O arquivo de entrada do piloto contém Bible, mas artigo/referências/amostra de voz continuam ausentes. | Piloto S0 e corpus editorial S2 |
| EX-02 — [ ] Aguardando acesso e orçamento | Credenciais/IDs/rotas/modelos acessíveis na conta; moeda, teto e autorização de gasto; confirmação dos schemas/custos específicos. | Validação ao vivo dos adapters e assets reais S3; não sua implementação local |
| EX-03 — [ ] Aguardando resultados e julgamento | Receita/rubrica confirmadas, revisão integral de fidelidade, voz, aparência, lip sync, continuidade e legibilidade; artigos variados e calibração repetida. Defaults atuais são propostas técnicas. | Gates humanos S0/S2/S4/S5/S6 e perfil validado |
| EX-04 — [ ] Decisões de operação pendentes | Ambiente definitivo, domínio/proxy/storage quando aplicáveis; política de retenção e metas operacionais. | Implantação externa e ativação da política final; não runbook/provisionamento/testes locais |

Nenhum desses itens autoriza usar fixtures como aceite ou como autorização de custo. Quando houver ajustes em repositórios externos, separar sua execução; a integração e configuração provisionáveis neste repositório permanecem dentro do escopo.

## Ordem de execução e encerramento

1. TL-05 e TL-09 fecham invariantes/formatos; TL-02 entrega composição e normalização.
2. TL-01 e TL-03 conectam planejamento/intenção/resultados; TL-04 libera dependências avaliadas; TL-06 monta.
3. TL-07 completa correções; TL-08 demonstra a jornada pública inteira.
4. TL-10–TL-16 fecham robustez/operação/calibração provisionada; TL-17/TL-18 tratam ajustes conforme ensaio.
5. EX-01–EX-04 são registrados separadamente. Executar gates reais apenas quando seus insumos estiverem disponíveis.

Marcar tarefa concluída somente com implementação integrada, comando/cenário de verificação, resultado e limitações registrados. Concluir os itens internos não conclui automaticamente os gates audiovisuais das sprints. Não há estimativa de prazo baseada nesta auditoria.

## Evidências e limites da auditoria

- [Sprints e aceites originais](sprints-implementacao-3-agentes-v0.1.md), [registro de entregas](arquitetura/continuacao-sprints-autonomas-2026-10-06.md) e [entrada real do piloto](piloto/entrada-piloto.json).
- `packages/infra/src/provider-runtime.ts`: loader espera fábrica; não há módulo concreto da fábrica no código auditado. `prepareCorrection`/`advance` são hooks opcionais.
- `packages/infra/src/review-workflow.ts`: `beginGeneration` e `publishCorrectionAssets` existem como entradas internas; não demonstram o encadeamento completo.
- `apps/api/src/app.ts` e `apps/worker/src/server.ts`: aprovação não inicia o pipeline completo; avanço depende do runtime e dos resultados do worker, sem recuperação integral da montagem demonstrada.
- `packages/infra/src/media-probe.ts`: implementação recente sem consumidor de ingestão no código auditado. `packages/domain/src/retention.ts` e `calibration.ts`: funções de plano/relatório, sem operação completa persistida.
- Verificação anterior registrada: `npm run verify`, 122 casos (120 aprovados, 2 exclusivos de PostgreSQL nativo omitidos); rodada nativa, 25 aprovados. Esses resultados cobrem componentes/cenários, não provam a jornada pública inicial completa. Alterações posteriores de probe/extensões exigem TL-09 e nova verificação ao integrar.
- Navegador foi conferido com telas/estados indisponíveis e viewport estreito; falta QA integral com mídia pela jornada. Esta atualização é documental: não executou novas gerações, gastos, aprovações ou alterações nas produções existentes.
