# Entrega de implementação e verificação — 29/10/2026

Escopo: [tasklist de fechamento](../tasklist-fechamento-2026-10-28.md). Implementação local concluída nas frentes técnicas descritas abaixo. O aceite audiovisual real e as decisões finais de operação permanecem pendentes; não houve chamada de geração paga, consulta de saldo externo ou aceite humano em nome do responsável.

## Comportamento entregue

### Recorrência, avaliação e recuperação

- Perfil admite `execution_policy` opcional e versionada: operações/classes permitidas, verificações obrigatórias, evidências de calibração e limite de alternativas automáticas.
- Política e prova de calibração são fixadas no snapshot; ausência da política preserva o comportamento supervisionado das revisões anteriores.
- `recurringExecutionPolicy` e `operationalPlanningEligible` conferem o escopo; uma produção recorrente elegível pode iniciar pela recuperação do runtime, sem criar aprovações humanas editoriais fictícias.
- A opção “Quero revisar roteiro e direção antes de gerar mídia” preserva a revisão voluntária antes de qualquer mídia. Fonte incompleta, achados semânticos obrigatórios, perfil inválido e escopo incompatível continuam impedimentos.
- Cada binding pode fornecer um `CandidateAssessor` server-side, identificado e versionado. Todos os critérios exigidos precisam ter resultado e evidência; critério ausente, duplicado, não aplicável, resultado incerto ou direito de uso desconhecido não libera a mídia.
- O resultado persiste como `Evaluation.method=operational_policy`, com referência da política, alvo exato e proveniência. `Asset.status=approved` representa liberação para dependências, distinguida na interface da revisão humana. Não se cria `Approval` humano automaticamente.
- Sem avaliador configurado, a mídia permanece candidata e pede intervenção. O probe de arquivo não foi usado como substituto de julgamento visual/semântico.
- Reprovação operacional recuperável ou falha terminal explicitamente retryable pode solicitar alternativa, dentro do limite da política e do orçamento/tentativas do perfil. Cancelamento manual e resultado incerto não autorizam reenvio automático.
- Comando estável por falha, leases, CAS e journal conservam os contadores após reinício. As rotas existentes continuam responsáveis pelas correções e pela aprovação final humana da versão exata.
- Dossiê fica recolhido por padrão na recorrência. Estado do candidato distingue liberação por política, revisão humana e pendência; o operador continua podendo inspecionar os detalhes.

### Calibração e habilitação de perfil

- Nova rota `POST /api/calibration/activations` habilita explicitamente uma nova revisão do perfil a partir de decisão humana persistida e vigente.
- A ativação exige a revisão calibrating exata, hash atual do relatório, metas atingidas com amostras reais e evidências compatíveis com a política. Cada combinação de classe de artigo/formato do escopo precisa atender às metas.
- A prova fixa revisão/hash de origem, decisão e relatório; o servidor valida que o conteúdo do perfil não foi alterado.
- CRUD genérico não aceita injetar `calibration_validation` nem promover status para validated. Alterações exigem nova calibração; suspensão atual também bloqueia tentativas de criar novas produções usando revisões históricas do perfil.
- O painel de calibração separa registrar decisão de habilitar a revisão. Os testes de ativação usam registros de fixture em banco temporário; não habilitaram qualquer perfil real.

### Referências e arquivos históricos

- Novas rotas de upload, preview e aprovação de mídia de referência. Limite: 20 MB por arquivo e 20 arquivos por referência; PNG/JPEG/WebP/WAV/MP3/MP4 são verificados por assinatura, probe e hash.
- Upload usa bytes, sem aceitar caminho de disco ou URL fornecido pelo cliente. Referência vocal exige áudio; edição de metadados não pode converter imagens anexadas em referência vocal.
- Arquivos ficam imutáveis por hash; anexar ou editar cria revisão pendente. Aprovação exige pessoa identificada, motivo, revisão integral e confirmação de direitos, com mídia íntegra.
- Preview confere pertencimento à revisão solicitada. A API privada e a proteção de origem também cobrem as novas rotas.
- Backup completo copia arquivos de todas as revisões históricas de referências; retenção inclui essas referências e bloqueia publicação/configuração concorrente na rechecagem. A interface de Universo apresenta os controles de arquivos e revisão.

### Configurações, orçamento e interface

- Configurações de instalação versionadas, com CAS/idempotência: português da interface, fuso IANA, blogs/URLs e vínculos explícitos entre autor e versão confirmada de personagem. O idioma de cada vídeo permanece no perfil.
- Orçamento opcional da instalação por intervalo e moeda, além do orçamento individual de cada produção. Datas com offset são normalizadas para UTC.
- Lock global de admissão serializa reservas entre produções; claim de trabalho preparado revalida o teto vigente antes do envio. Reconciliação de trabalhos já enviados permanece permitida.
- A atribuição do gasto usa o instante de admissão local; reservas ainda abertas de outros períodos continuam contando de forma conservadora. Não há conversão implícita entre moedas. Evidências legadas sem instante confiável e cobranças sem cobertura suficiente bloqueiam novos gastos.
- O limite não é controle de cobrança do fornecedor: faturas tardias continuam persistidas e podem revelar consumo acima do teto. Alterar configuração não cancela transmissão já iniciada nem compra feita anteriormente.
- `/api/consumption` apresenta confirmado, reservado e desconhecido, separados por moeda. Início mostra consumo, trabalhos e artigos recentes; detalhe do artigo mostra imagens identificadas com permissão e produções vinculadas.
- Histórico de produção e período de consumo apresentam horários no fuso configurado. As associações de blogs não habilitam sincronização automática; a confirmação de autoria continua na captura.
- Diagnóstico local de fornecedores informa capabilities configuradas e explicita que isso não comprova conexão autenticada ou qualidade. O ensaio real continua necessário.

## Implantação e compatibilidade

- `Dockerfile`: runtime Node 24 com FFmpeg/FFprobe, usuário sem privilégios e target separado de frontend compilado.
- `compose.production.yaml`: PostgreSQL, migração, API, worker, frontend nginx com TLS e tarefa de backup em perfil de manutenção. `compose.yaml` de desenvolvimento foi preservado.
- Segredos, certificados, `.env`, dados e sessões locais são excluídos do contexto de build. O exemplo `deploy/production.env.example` é configuração ilustrativa; não habilita uma conta real.
- `tools/deployment-preflight.mjs` verifica parâmetros e presença de certificados; sem configuração real retorna pendências, como esperado.
- `tools/restore-backup.ts` exige destinos isolados/vazios, valida manifesto/hashes e não inicia serviços. Retenção destrutiva permanece desativada enquanto não houver política definitiva, comprovante de backup verificado e exclusão global de escritores.
- Migração aditiva **016** acrescenta configurações de instalação e instantes de admissão. Backup atual: **fbr-metadata-13**, com leitura dos formatos 5–12 preservada. O código antigo não deve ser presumido compatível com um backup 13.
- Não foi aplicada migração nem atualização aos bancos/serviços reais já ativos. O pacote foi instalado e exercitado em recursos temporários isolados.

## Verificações e evidências

| Verificação | Resultado |
| --- | --- |
| `npm run verify` | Tipos, build e 174 testes: **172 aprovados, 2 omitidos** por exigirem PostgreSQL nativo |
| PostgreSQL 18 isolado: fila, pg-boss, perda de conexão, recuperação e jornada pública | **22 aprovados, zero omissões**; os dois casos nativos omitidos na suíte local estão nessa rodada |
| Jornada pública dentro da imagem Linux, sem rede externa | **1 aprovado**: geração sintética, avaliação, render, correção visual/fala, reinício e exportação |
| Novos testes de recorrência/ativação | **4 aprovados**: evidências incompletas, alternativa única, runtime recriado, backup/restore, consentimento final, prova imutável e suspensão |
| Upload/revisão de referência | Teste integrado aprovado, incluindo arquivo verdadeiro sintético, MIME inválido, ownership, revisão, backup/restore e retenção histórica |
| Teto global | Reservas concorrentes entre produções e revalidação do teto antes do envio aprovadas |
| Ferramentas do piloto | **3 aprovados**; criação sem sobrescrita, hashes e vínculos, ausência de evidências e proteção de caminhos |
| Contêineres | Imagens runtime/web construídas; migração, readiness com FFmpeg/FFprobe, autenticação, configurações, worker e frontend TLS aprovados |
| Navegador em banco temporário | Início, configurações com gravação de nova revisão, seleção de referência vocal e controles de upload inspecionados; aba e servidor temporários encerrados |

As rodadas se sobrepõem: não somar as contagens como testes únicos. A sessão opcional `FBR_BROWSER_FIXTURE=1` foi encerrada manualmente após a inspeção; seu cancelamento pelo harness não foi contado como aprovação automatizada. A jornada sem esse modo passou nas suítes normal, nativa e no contêiner.

Logs locais desta execução:

- `%TEMP%/fbrvideos-closure-final.log` — suíte final.
- `%TEMP%/fbrvideos-recurring-tests.log` — última rodada focal da recorrência pública/ativação.
- `%TEMP%/fbrvideos-closure-container-journey.log` — jornada integral no Linux.
- `%TEMP%/fbrvideos-closure-smoke.log` e `%TEMP%/fbr-closure-smoke-3mFl8n/` — builds e suíte nativa.
- [Captura da interface de referências](../ux/evidencias/fechamento-2026-10-29/universo-referencias.png).

Os contêineres/rede do smoke tinham identificador/label próprios, removidos após conferir sua identidade. Serviços de outros projetos foram preservados. A chave TLS temporária do ensaio foi removida; não foi instalado certificado no sistema.

Revisão final de integração, compatibilidade, fontes de autorização e resultados executada pelo agente principal. As frentes auxiliares produziram código/documentação parcial, mas foram interrompidas por limite da conta; não houve aprovação independente de três revisores e isso não é alegado nesta entrega.

## O que continua pendente

1. **FC-09–FC-10:** artigo, voz/look/referências e direitos reais; receita, rubrica e parâmetros audiovisuais aceitos pelo responsável.
2. **FC-11–FC-12:** contas/modelos/IDs disponíveis, módulo de composição efetivamente configurado para essas contas, estimativas/cobrança/uploads e avaliador com evidências reais; moeda, teto e autorização específica de gasto; ensaios autenticados por rota.
3. **FC-13–FC-15:** vídeo real integral, correções/retomada reais, corpus, calibração da política e habilitação humana do perfil. O runtime sintético padrão não recebe um avaliador que finja validar qualidade real.
4. **FC-16/FC-18/FC-19:** destino definitivo, metas e volume reais, política de backup/retenção final e ensaio de recuperação/capacidade no destino. Há pacote local/contêiner e rotinas verificadas; não há implantação definitiva aprovada.
5. **FC-20:** aceite de produto e liberação pelo responsável, incluindo revisão de usabilidade e mídia real. Não foi repetida uma rodada completa em viewport estreito nesta continuação.

FlowRouter permanece integração opcional futura, conforme [decisão de fronteira](fronteira-flowrouter-v0.1.md). Nenhum arquivo daquele projeto foi alterado. FRV-01–FRV-03 e MEL-01 não são requisitos ativados desta entrega; o aviso de bundle acima de 500 kB permanece documentado e o build passa.

Essas pendências não são marcadas como concluídas por existir um simulador, um hook ou um campo de configuração. A implementação técnica não substitui insumos, autorização de gasto ou decisão humana.
