# FBRVideos — tasklist de fechamento

Data: 28/10/2026. Estado inicial: entrega técnica local verificada; produto sem aceite audiovisual real. Base: [análise atual](analise-conclusao-e-sobreposicao-flowrouter-2026-10-28.md), [produto](projeto-base-sistema-v0.1.md), [entrega técnica](arquitetura/entrega-tasklist-2026-10-07.md) e [backlog anterior](tasklist-remanescente-2026-10-06.md).

Esta é a lista consolidada das pendências identificadas para fechamento. Não representa uma auditoria exaustiva de cada requisito: FC-01 fecha essa rastreabilidade. Os itens TL-01–TL-18 já entregues não são reabertos em bloco. Novos defeitos devem ser registrados com cenário e evidência.

## Estado após implementação — 29/10/2026

Evidências e limites no [registro de entrega](arquitetura/entrega-fechamento-2026-10-29.md). Checkboxes internos assinalados indicam o recorte técnico verificado, não aceite audiovisual real.

| Itens | Estado |
| --- | --- |
| FC-01–FC-08 | Implementação e verificação técnica local concluídas; provas de qualidade real seguem FC-13–FC-15 |
| FC-09–FC-15 | Ferramentas e composição provisionadas; insumos, configuração de contas/rotas e ensaios/aceites reais pendentes |
| FC-16 | Pacotes local/contêiner disponíveis; destino e metas definitivos pendentes |
| FC-17 | Pacote construído e instalação/jornada sintética ensaiadas em ambiente isolado; instalação definitiva depende de FC-16 |
| FC-18 | Backup/restore, proteção de históricos e dry-run verificados; política/agendamento definitivos pendentes; descarte desativado |
| FC-19 | Limites técnicos e jornada sintética verificados; volume e desempenho reais no destino pendentes |
| FC-20 | Tipos/build/testes e inspeção de navegador realizados; aceite/liberação de produto e QA integral final pendentes |
| FRV-01–FRV-03 | Não aplicáveis à versão atual: FlowRouter decidido como integração futura opcional |
| MEL-01 | Não ativado: aviso de bundle documentado; não houve bloqueio de build ou lentidão comprovada no recorte |

`npm run verify`: 174 testes, 172 aprovados e 2 omitidos; rodada PostgreSQL nativa separada: 22 aprovados, zero omissões. As contagens se sobrepõem.

## Regras de acompanhamento

- `[ ]` significa pendente; marcar `[x]` somente após satisfazer o aceite e vincular evidências.
- P0: bloqueia o comportamento principal ou seu aceite. P1: necessário ao fechamento operacional no destino. P2: melhoria que não bloqueia o primeiro aceite nos limites declarados.
- Tipos: **implementação**, **configuração**, **validação**, **decisão/documentação**. Uma tarefa externa pendente não significa ausência de código.
- Geração paga depende do teto e autorização de gasto; esta tasklist não os concede.
- Não registrar segredos, cookies ou tokens nas evidências.
- Itens condicionais só passam a obrigatórios quando a condição for adotada. Registrar “não aplicável” e justificativa, em vez de simular conclusão.

## 1. Confirmar escopo e cobertura

### FC-01 — Fechar a matriz de requisitos e aceites

- [x] **P0 · Validação/documentação.** Mapear RF01–RF14 e AC01–AC10 do produto para código, interface, testes e evidências atuais.
- [x] Conferir também T01–T10 e requisitos operacionais: fontes, autoria/Bible, referências, configurações, limites, idioma/fuso, revisão e entrega.
- [x] Classificar cada requisito como implementado e verificado, parcial, sem evidência ou ausente; abrir tarefas específicas para lacunas comprovadas.
- [x] Identificar divergências entre a jornada simplificada, o MVP supervisionado e os documentos antigos; consolidar a interpretação em um registro de decisão.

**Aceite:** todos os requisitos do MVP possuem vínculo verificável ou pendência identificada; não usar cobertura sintética como prova de qualidade real. RF15–RF18 ficam fora do fechamento inicial.

### FC-02 — Formalizar a fronteira com FlowRouter

- [x] **P1 · Decisão/documentação.** Registrar FBRVideos como responsável por roteiro, identidade, perfil, orçamento global, avaliação, montagem e aprovação final.
- [x] Registrar FlowRouter como executor especializado opcional do Google Flow, responsável por sessões, capacidade, contas e tarefas remotas.
- [x] Decidir se a integração será feita nesta versão ou ficará para evolução; manter fornecedores atuais utilizáveis independentemente dela.

**Dependências:** FC-01. **Aceite:** responsabilidades e decisão versionadas; nenhuma segunda implementação de sessões Google ou troca de contas dentro do FBRVideos sem justificativa de escopo.

## 2. Completar a jornada recorrente

### FC-03 — Modelar a política de execução e avaliação

- [x] **P0 · Implementação.** Distinguir calibração supervisionada e produção recorrente com perfil validado nos contratos e nas regras do domínio.
- [x] Fixar no snapshot a versão da política, o escopo validado, critérios obrigatórios e condições que exigem intervenção.
- [x] Separar revisão humana, verificações determinísticas, sinais de modelo e liberação operacional; não representar uma decisão automática como aprovação humana.
- [x] Preservar exigência de revisão final humana e invalidar liberações afetadas por alteração de fonte, perfil, direção ou mídia.

**Dependências:** FC-01. **Aceite:** perfil sem validação não habilita recorrência; política fora do escopo abre pendência; versões antigas permanecem interpretáveis e restauráveis.

### FC-04 — Remover a parada obrigatória de planejamento no caso recorrente elegível

- [x] **P0 · Implementação.** Adaptar `beginGeneration` e a composição do planejamento para a política de FC-03.
- [x] Permitir avançar automaticamente após as verificações previstas para perfil validado; preservar revisão de roteiro quando solicitada pelo operador.
- [x] Bloquear fontes insuficientes, direção incompatível, configuração incompleta e orçamento sem margem, com causa e ação visíveis.
- [x] Manter recuperação e comandos idempotentes; replanejamento não pode autorizar silenciosamente novo gasto ou outra direção.

**Dependências:** FC-03. **Aceite:** artigo/perfil elegíveis iniciam a produção sem exigir aprovações humanas editoriais e de direção em toda execução; calibração e exceções mantêm suas revisões.

### FC-05 — Implementar liberação operacional de candidatos por política

- [x] **P0 · Implementação.** Acrescentar o caminho de avaliação previsto em FC-03 à ingestão de áudio, imagem e clipe.
- [x] Adaptar dependências e montagem para consumirem mídia operacionalmente liberada pela política adequada, com evidências e revisão exata.
- [x] Manter avaliações humanas disponíveis na calibração e nos casos de exceção.
- [x] Persistir critérios, resultado, proveniência, direitos de uso e motivo de bloqueio; ausência de evidência obrigatória permanece pendência.
- [x] Garantir que recuperação, cobrança tardia e republicação não percam nem fabriquem avaliações.

**Dependências:** FC-03. **Aceite:** candidato elegível libera somente seus derivados, sem aprovação humana obrigatória por asset na recorrência; candidato reprovado, desatualizado ou sem evidência não avança. A política precisa ser calibrada antes da habilitação real, em FC-15.

### FC-06 — Automatizar alternativas limitadas e recuperação das exceções

- [x] **P0 · Implementação.** Conectar falhas/reprovações classificadas como recuperáveis à política de alternativas e ao mecanismo de retry já existente.
- [x] Reconciliar envio incerto antes de considerar nova tentativa; preservar limite por job, teto, reservas e custos desconhecidos.
- [x] Abrir decisão humana quando a alternativa alterar direção, exceder o repertório ou esgotar limites.
- [x] Persistir motivo e contadores para que reinício não reinicie o orçamento de tentativas.

**Dependências:** FC-04 e FC-05. **Aceite:** falha recuperável chega a alternativa dentro da política; replay não duplica envio/reserva; falha persistente gera pendência acionável, sem loop ilimitado.

### FC-07 — Adequar interface e estados públicos à jornada simplificada

- [x] **P0 · Implementação.** Atualizar produção, acompanhamento e candidatos para refletir FC-03–FC-06.
- [x] Mostrar inspeção de dossiê e evidências sem transformar todos os detalhes técnicos em formulários obrigatórios.
- [x] Diferenciar “verificado automaticamente”, “revisado por pessoa”, “aguardando decisão” e “pronto para revisão final”.
- [x] Oferecer ações de resolução somente quando elegíveis e manter acesso ao modo de calibração.

**Dependências:** FC-04–FC-06. **Aceite:** operador percorre artigo → perfil → gerar → acompanhar → assistir/corrigir → aprovar → exportar; decisões intermediárias aparecem quando previstas ou necessárias, com motivo compreensível.

### FC-08 — Verificar a nova jornada integrada e sua persistência

- [x] **P0 · Validação automatizada e de navegador.** Exercitar calibração e recorrência por APIs públicas e interface.
- [x] Cobrir perfil inválido, exceção editorial, reprovação, alternativa, teto atingido, pausa/cancelamento e alteração de inputs.
- [x] Reiniciar entre planejamento, avaliação, geração e montagem; verificar ausência de duplicações e preservação de decisões.
- [x] Incluir novos estados/políticas no backup/restore e ensaiar compatibilidade com dados existentes.
- [x] Executar `npm run verify` e os cenários relevantes em PostgreSQL nativo com `TEST_DATABASE_URL` apontando para banco isolado.

**Dependências:** FC-03–FC-07. **Aceite:** jornada sintética reproduzível com arquivos exportáveis, sem intervenção obrigatória fora da política; evidências distinguem ensaio de aceite audiovisual real.

## 3. Configurar e comprovar a produção real

### FC-09 — Preparar os insumos reais do piloto

- [ ] **P0 · Configuração externa; corresponde a EX-01.** Selecionar artigo completo, autoria/Bible, referências visuais autorizadas e voz/look disponíveis.
- [ ] Definir responsável pela revisão e registrar permissões de uso.
- [ ] Atualizar a ficha `docs/piloto/entrada-piloto.json` com referências verificáveis, sem incluir credenciais.

**Aceite:** preflight deixa de apontar falta de insumos; nenhuma fixture é apresentada como entrada real.

### FC-10 — Fixar a primeira receita e os critérios audiovisuais

- [ ] **P0 · Decisão/configuração; parte de EX-03.** Escolher receita, formato de entrega, classes de planos e alternativas iniciais.
- [ ] Fixar limites de duração, layout/legibilidade de legendas, política de mix e requisitos de timings/alinhamento.
- [ ] Consolidar rubrica de fidelidade, identidade, aparência, pronúncia, sincronismo e continuidade com exemplos e responsável pelo julgamento.

**Dependências:** FC-09. **Aceite:** critérios mensuráveis ou rubricados e versionados; defaults técnicos não são tratados como aceite humano.

### FC-11 — Entregar a configuração concreta dos fornecedores reais

- [ ] **P0 · Configuração e implementação de composição quando necessária; corresponde a EX-02.** Selecionar contas, modelos, operações e IDs efetivamente disponíveis para imagem, animação, voz e avatar.
- [ ] Criar/configurar módulo carregável de runtime usando os adapters e factories existentes; API e worker devem compartilhar modo e AssetStore.
- [ ] Concretizar parâmetros, estimativa/quote, autorização, resolução/upload dos inputs e consulta de cobrança; configurar callbacks autenticados somente se utilizados.
- [ ] Registrar moeda, teto e autorização de gasto; validar acesso separadamente de qualidade.
- [ ] Expor impedimento claro para capacidade/configuração indisponível, sem fallback silencioso para simulação.

**Dependências:** FC-09 e FC-10. **Aceite:** composição real reproduzível no ambiente escolhido; credenciais apenas no servidor; cada operação corresponde a capacidade comprovada e orçamento autorizado.

### FC-12 — Executar ensaios reais por rota e corrigir incompatibilidades

- [ ] **P0 · Validação; implementar correções somente conforme falhas observadas.** Comprovar geração, consulta, ingestão e custos de áudio, imagem, animação e avatar utilizados pela receita.
- [ ] Conferir schemas, formatos, duração medida, entrada de áudio oficial e compatibilidade de referências.
- [ ] Verificar recuperação por consulta, resultados incertos e tratamento de URL expirada/erro de download sem reenvio indevido.
- [ ] Registrar IDs, parâmetros efetivos, hashes, evidências e limitações; não provocar consumo adicional desnecessário para testar falhas.

**Dependências:** FC-11. **Aceite:** cada rota habilitada possui resultado real íntegro e rastreável; rota não demonstrada fica desabilitada ou com limitação explícita.

### FC-13 — Concluir o piloto audiovisual integral

- [ ] **P0 · Validação; parte de EX-03.** Produzir vídeo real do artigo até exportação, incluindo voz/avatar e cenas de apoio da receita selecionada.
- [ ] Avaliar roteiro/fontes, identidade, voz, lip sync, continuidade, transições, legendas, mix e reprodução dos arquivos finais.
- [ ] Registrar avaliações com timecodes, custo estimado/confirmado, tempo e retrabalho.
- [ ] Corrigir defeitos encontrados e repetir apenas os trechos afetados.

**Dependências:** FC-10–FC-12. **Aceite:** responsável aprova a versão e seus arquivos exatos; relatório do piloto deixa explícito o que foi aprovado e o que permanece fora do repertório.

### FC-14 — Comprovar correção e retomada com mídia real

- [ ] **P0 · Validação.** Demonstrar correção visual preservando áudio válido e correção de fala revalidando áudio, sincronismo, legendas e montagem afetados.
- [ ] Demonstrar retomada de execução autorizada sem duplicar resultados concluídos.
- [ ] Confirmar invalidação da aprovação final após mudança e vínculo dos downloads à versão aprovada.

**Dependências:** FC-13. **Aceite:** histórico, arquivos e custos comprovam regeneração localizada e aprovação renovada; testes sintéticos anteriores permanecem como evidência complementar.

### FC-15 — Calibrar e habilitar o primeiro perfil recorrente

- [ ] **P0 · Validação/configuração.** Executar corpus de artigos reais variados dentro do recorte inicial e registrar observações no serviço de calibração existente.
- [ ] Comparar liberações automáticas de FC-05 com julgamento humano e ajustar critérios/repertório quando necessário.
- [ ] Definir metas e amostragem antes de decidir habilitação; medir aprovação, retrabalho, custo e tempo com denominadores reais.
- [ ] Registrar decisão humana sobre a versão exata do perfil e o escopo permitido.

**Dependências:** FC-08 e FC-13–FC-14. **Aceite:** perfil habilitado por evidência real suficiente segundo metas declaradas; resultados sintéticos ou custo desconhecido não viram validação fictícia.

## 4. Fechar operação e distribuição

### FC-16 — Definir destino e contrato operacional da versão

- [ ] **P1 · Decisão/configuração; corresponde a EX-04.** Escolher execução local ou hospedada, acesso, armazenamento, proxy/domínio quando aplicáveis e disponibilidade esperada.
- [ ] Fixar volume/duração esperados, capacidade de disco, limites de mídia, metas de recuperação e responsáveis por operação.
- [ ] Documentar como o planejador OAuth e suas dependências funcionarão no destino, ou selecionar outra rota já suportada com suas limitações.

**Aceite:** configuração de destino verificável, sem assumir que o ambiente de desenvolvimento será a instalação definitiva.

### FC-17 — Completar e verificar o pacote de implantação escolhido

- [x] **P1 · Implementação/configuração.** Provisionar API, worker, frontend compilado, PostgreSQL, volumes persistentes, configuração e migrações no destino.
- [x] Se usar o Dockerfile atual, instalar/provisionar FFmpeg e FFprobe: a imagem atual instala somente `ca-certificates` e não entrega essas ferramentas.
- [x] Se usar contêiner, definir serviço do worker e entrega do frontend; o compose atual provisiona somente PostgreSQL.
- [x] Documentar/provisionar dependências do planejador e configurar hosts/origens/acesso exigidos pela API quando exposta além de loopback.
- [x] Verificar partida, readiness, parada, atualização e rollback no destino sem alterar serviços de outros projetos.

**Dependências:** FC-11 e FC-16. **Aceite:** instalação limpa abre o aplicativo e completa uma jornada de ensaio com render; arquivos e estado sobrevivem à reinicialização. Aproveitar launcher/runbooks existentes quando o destino for local.

### FC-18 — Conectar política definitiva de backup e retenção

- [ ] **P1 · Configuração e composição; parte de EX-04.** Definir agenda/destino de backup, retenção e procedimento de restauração.
- [ ] Ensaiar restore isolado de banco e mídia real, verificando integridade, histórico, recibos e decisões.
- [ ] Se descarte automático fizer parte da operação escolhida, conectar comprovante de backup verificado e guard de exclusão global ao executor existente; hoje a API compõe a retenção com backup `verified:false` e oferece dry-run.
- [ ] Antes de habilitar exclusão, conferir inventário, revalidação de referências, histórico e concorrência; se permanecer desativada, documentar crescimento e rotina manual.

**Dependências:** FC-16–FC-17. **Aceite:** recuperação demonstrada; política escolhida executável e documentada; órfãos não são excluídos só porque aparecem em um plano antigo.

### FC-19 — Validar limites de mídia e desempenho no destino

- [ ] **P1 · Validação.** Exercitar dimensões/durações da receita e arquivos próximos do limite operacional, incluindo preview, seek, histórico e exportação.
- [ ] Medir tempo de fila/render, uso de memória/disco e tamanho das entradas; comparar com metas de FC-16.
- [ ] Se 100 MB por input forem suficientes, manter bloqueio explícito e documentar o limite; se insuficientes, abrir e implementar ampliação de ingestão/probe/render com limites e testes de recursos.

**Dependências:** FC-10 e FC-17. **Aceite:** mídia do formato declarado funciona no volume previsto, sem confundir suporte de streaming de arquivos maiores com suporte de ingestão/render.

### FC-20 — Executar aceite final e publicar instruções da versão

- [ ] **P1 · Validação/documentação.** Revalidar a matriz FC-01, `npm run verify`, testes necessários no PostgreSQL nativo e jornada no navegador, incluindo viewport estreito/teclado.
- [ ] Conferir acesso privado, configuração efetiva, isolamento de segredos, arquivos e recuperação no destino.
- [ ] Atualizar instalação, primeiro uso, calibração/recorrência, exceções, custos, correção, backup e limites conhecidos; conciliar os runbooks com os modos atuais.
- [ ] Registrar versão do código, configuração não secreta, evidências de aceite e defeitos ainda abertos.
- [ ] Obter decisão de liberação do responsável pelo produto.

**Dependências:** FC-01, FC-08, FC-13–FC-19; FC-02 com decisão registrada. **Aceite:** nenhum bloqueio P0 aberto; pendências condicionais explicitamente resolvidas ou fora da versão; operador consegue produzir, revisar, exportar e recuperar seguindo as instruções.

## 5. Integração opcional com FlowRouter

Estes itens não bloqueiam o fechamento do FBRVideos com os fornecedores atuais. Tornam-se obrigatórios somente se FC-02 incluir Google Flow nesta versão. Implementações internas do FlowRouter pertencem ao backlog daquele projeto.

### FRV-01 — Comprovar prontidão do executor externo

- [ ] **Condicional · Validação externa.** Reavaliar o FlowRouter após estabilização: build, API, worker, autenticação, geração/coleta real, reconciliação e continuidade entre contas.
- [ ] Registrar capacidades e limites efetivamente comprovados; não tomar os testes do simulador como prova da rota real.

**Aceite:** executor consegue entregar arquivos reais e evidências, com contrato estável. A falha de build observada em 28/10 é um recorte, não uma obrigação presumidamente ainda aberta no outro projeto.

### FRV-02 — Especificar e implementar o adapter FBRVideos → FlowRouter

- [ ] **Condicional · Implementação.** Versionar mapeamento de produção/plano para projeto/tarefa/tentativa, idempotência, capabilities, parâmetros e estados.
- [ ] Implementar cliente autenticado para envio, consulta/reconciliação, coleta e pausa/cancelamento conforme suporte real.
- [ ] Preservar hashes, revisão dos inputs, proveniência e separação entre capacidade da assinatura e custo monetário observado.
- [ ] Definir um único responsável pelo reenvio ao Google Flow e bloquear políticas concorrentes de retry.
- [ ] Ingerir outputs pelos serviços existentes do FBRVideos e manter avaliação/montagem nele.

**Dependências:** FC-02 e FRV-01. **Aceite:** adapter substitui somente operações suportadas, sem duplicar o orquestrador editorial, sessões ou bancos.

### FRV-03 — Verificar o contrato integrado

- [ ] **Condicional · Validação.** Cobrir reconexão, restart de ambos os processos, envio incerto, troca de conta, dependência não portável, falha de download e cancelamento.
- [ ] Demonstrar ausência de tarefas/custos duplicados e continuidade até candidato, montagem e entrega no FBRVideos.

**Dependências:** FRV-02. **Aceite:** jornada real rastreável; indisponibilidade do FlowRouter produz impedimento explícito, sem reenvio pago silencioso por outro fornecedor.

## 6. Melhoria posterior e escopo excluído

- [ ] **MEL-01 · P2 · Implementação, se necessário após medição.** Reduzir o bundle web com carregamento sob demanda se FC-19/FC-20 identificarem impacto perceptível; o aviso acima de 500 kB não impediu o build atual.

Não incluir como pendências obrigatórias desta versão: sincronização por CMS/feed (RF15), lotes (RF16), geração automática a cada artigo (RF17), publicação em redes (RF18), editor de vídeo completo, colaboração avançada, fusão com FlowRouter ou aumento arbitrário do limite de mídia.

## Ordem sugerida

1. FC-01–FC-03: fechar escopo, fronteira e política.
2. FC-04–FC-08: implementar e verificar recorrência; FC-09–FC-11 podem avançar em paralelo quando os insumos estiverem disponíveis.
3. FC-12–FC-15: comprovar produção real, qualidade e calibração.
4. FC-16–FC-19: preparar e ensaiar operação no destino escolhido.
5. FC-20: consolidar aceite e liberar a versão.
6. FRV-01–FRV-03 somente conforme FC-02; MEL-01 conforme medição.

## Registro de conclusão por tarefa

Ao fechar um item, anexar: data; versão/commit; código/configuração alterados; comando ou cenário; resultado; evidência; limitações; responsável pela decisão humana quando aplicável. Uma validação que falhe gera defeito vinculado e mantém o aceite correspondente aberto.

Baseline de 28/10: `npm run verify` passou com 164 testes, 162 aprovados e 2 omitidos por exigirem PostgreSQL nativo; tipos e build passaram. Criar esta tasklist não executa nem conclui os itens acima.
