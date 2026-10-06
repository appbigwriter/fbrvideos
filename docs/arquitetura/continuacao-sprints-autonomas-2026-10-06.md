# Continuação autônoma das sprints — 6 de outubro de 2026

Diretriz do responsável: implementar todas as frentes que podem ser realizadas no código e provisionar pontos de integração para adicionar APIs posteriormente. Dependências de conta, mídia real, decisões de infraestrutura externa e aceites humanos não bloqueiam o desenvolvimento interno.

Este registro sucede `continuacao-s4-s5-2026-10-06.md`. Código provisionado não significa fornecedor conectado, mídia validada ou sprint com aceite humano integral.

## Implementação entregue

### S2 — revisão do planejamento

Declarações explícitas de conferência das fontes e da direção, vinculadas ao dossiê exato, são persistidas com avaliações/aprovações humanas e comando idempotente. As caixas começam desmarcadas. A ação não inicia geração nem declara qualidade de mídia inexistente. Edição de fala funciona antes da geração e após o render, conserva fontes, confere seus vínculos e invalida aprovações e derivados necessários. A edição antes da mídia retorna à revisão do planejamento.

O runtime dispõe de `PostgresReviewWorkflow.beginGeneration` como entrada interna, com planejamento aprovado exato e pendências resolvidas. Não existe endpoint público para fingir liberação de conexão ou resultado de mídia.

### S3 — fila, recuperação e integração posterior

- Admissão de adapters reais é uma política server-side explícita, separada da política do worker; padrão permanece fechado.
- `ProviderRuntime`, carregado por `FBR_PROVIDER_BINDINGS_MODULE`, compõe adapters, admissão, preparação de correções e avanço após resultados. A API e o worker utilizam a mesma fronteira. Sem módulo, continuam a operação local e a simulação existentes.
- `HttpGenerationAdapter` valida capacidades, origem HTTPS, corpo, limite de resposta e timeout. `PostgresHttpTransmissionJournal` fixa conta, endpoint e corpo antes do envio; alteração da intenção impede replay.
- Recuperação de recibo perdido exige capability de idempotência, método `recover` e evidência própria. Adapters sem essa capacidade conservam o resultado incerto e a reserva, sem reenviar.
- `HiggsfieldClient` prepara estimativa autenticada, submit, status, cancelamento consultado e upload assinado. Estimativa USD é arredondada conservadoramente em centavos; não é cobrança nem câmbio para BRL.
- `HeygenClient` prepara voz e avatar com áudio oficial, preserva escolhas salvas quando não há override e não repete envio ambíguo automaticamente. O subconjunto vocal documentado foi acrescentado ao catálogo, preservando seus candidatos e IDs.
- `ProviderMediaTransfer` separa credencial do fornecedor de storage assinado, valida origens/DNS, limita bytes, mede mídia por port injetado e guarda arquivo imutável pelo hash.
- Cobrança reconciliada acima do saldo seguro gera impedimento persistido. Jobs ativos/incertos bloqueiam montagem, aprovação e exportação mesmo se o valor reservado for zero.

Clientes REST e testes de contrato não substituem `GenerationAdapter` normalizado da conta. O módulo de composição ainda deve fixar IDs/modelos, resolver inputs aprovados, normalizar estados e faturamento e publicar outputs avaliados. Esses pontos estão provisionados e permanecem desativados até configuração externa verificável.

### S4 — montagem e revisão

Montagem publica MP4, timeline e legendas SRT/VTT atomicamente. As legendas derivam do texto/timecodes medidos e possuem avaliação determinística de serialização, sem aceite editorial fabricado. Render aceita música aprovada com ganho explícito e limitador, além de cortes e fades simples sem mudar a duração da fala. Áudio de clipes permanece silenciado.

Áudio de dossiê anterior só é reutilizado quando a revisão original persistida conserva conteúdo, fontes, perfil, personagem e metadados exatos. A mesma verificação é aplicada pelo montador e pelo renderer.

AG-08 e AG-09 encontrados no workspace foram integrados aos controllers existentes e seus estilos importados. Apontamentos continuam vinculados a produção/render/hash/cena/timecode exatos.

### S5 — correção e entrega

Comparação mostra renders históricos por revisão, com ownership/integridade e identificação de versão anterior. Aprovação se aplica somente ao render atual.

Planos de correção persistem raiz, operações, estimativa e hash. Autorização vincula limite e plano exato. Execução invalida derivados e reserva todas as operações na mesma transação; rollback impede plano parcialmente publicado. Cancelamento antes da execução mantém histórico. Resultados só são publicados se pertencem às operações do plano, têm hashes/configuração corretos, custos reconciliados e avaliação da revisão exata. A nova montagem conclui a execução técnica; o apontamento continua aberto até decisão própria na nova revisão.

Edição de fala após render cria proposta de regeneração e conserva o vídeo histórico. Publicação de replacements e nova montagem têm entradas internas provisionadas para os adapters futuros. Não existe inserção pública de outputs/aceites fictícios.

Entrega lista MP4, SRT, VTT e manifesto da revisão aprovada. Arquivo faltante/corrompido impede pacote final. Backup contempla planos de correção e intenções HTTP.

### S6 — operação e resiliência

- Pausa/retomada cobrem produção, correção e revisão, restaurando a fase anterior pelo histórico, sem reiniciar planejamento por engano.
- Atualização de acompanhamento/revisão conserva dados e player durante consultas em background.
- Início mostra produções reais. Configurações apresenta operação, execuções e catálogo com acesso pendente identificado.
- Instalação privada tem chave server-only, sessão HttpOnly/SameSite, expiração, revogação, limite de tentativas e hosts/origens explícitos. Acesso remoto exige configuração e proxy HTTPS; nenhum serviço foi publicado externamente.
- Telemetria agrega rotas/status/tempo, sem corpos, parâmetros de geração ou credenciais.
- Backup completo copia todas as revisões de mídia referenciadas antes de publicar metadados. Restore verifica hashes e exige banco vazio. Metadados usam formato 10, preservando leitura dos formatos 5–9.
- Retenção é um plano configurável que conserva referências, histórico e período de graça. Nenhum arquivo foi apagado; política final de operação continua decisão externa.
- Relatório de calibração mede amostra, revisão/aceite, correções, alternativas, custos e tempo humano. Ausência de dado permanece desconhecida; relatório não valida perfil automaticamente.

## Verificação

`npm run verify` passou: 122 casos, 120 aprovados e dois testes exclusivos de PostgreSQL nativo omitidos na suíte padrão; tipos e build aprovados. Log: `var/verify-sprints-autonomas.log`.

A rodada nativa passou com 25 casos, incluindo transporte pg-boss, conexão interrompida, correção completa e geração/entrega bloqueadas por journal pendente. Log: `var/verify-sprints-native.log`. Migrações 009/010 são aditivas e foram aplicadas no banco do aplicativo.

Cenários incluem MP4 sintético real com FFmpeg, música/fade, correção visual completa com áudio preservado, edição após entrega, revisão editorial, jobs de custo zero, orçamento excedido, recibo perdido, intents HTTP imutáveis, autenticação, backup/restauração e transferência sem credenciais para storage. Fixtures não representam piloto, gasto autorizado ou aceite humano real.

Conferência de navegador: revisão/entrega/Configurações, navegação por teclado, estados indisponíveis e viewport 360 px sem overflow horizontal. Nenhum erro de console observado nesse recorte. A produção utilizada permanece sem mídia real; não foram declarados aceites para ela. Conferência visual com vídeo real, lip sync e corpus editorial continua externa.

## Pendências que dependem de ação externa

| Sprint | Dependência restante |
| --- | --- |
| S0 | Artigo real, referência visual, voz/look autorizados, acesso e teto do piloto. |
| S1 | Revisão humana da jornada e configurações reais. |
| S2 | Corpus real e aceite editorial do roteiro/direção. |
| S3 | Credenciais/IDs/modelos da conta, bindings normalizados e estimativa/cobrança verificadas; qualidade de mídia. |
| S4 | Mídia real, sincronismo labial, continuidade, legibilidade e avaliação integral. |
| S5 | Ensaio de correção com outputs reais e aceite da nova direção quando necessário. |
| S6 | Ambiente final/proxy/domínio/storage, política de retenção e calibração humana repetida. |

Os gates acima não são usados como bloqueio global para código. Qualquer trabalho específico de configuração de fornecedor deve usar as fronteiras entregues, preservar evidências e passar novamente por verificação antes de habilitar execução real.

## Fontes técnicas reconsultadas

Higgsfield: [pedidos](https://docs.higgsfield.ai/docs/concepts/requests.md), [idempotência](https://docs.higgsfield.ai/docs/concepts/idempotency.md), [upload](https://docs.higgsfield.ai/docs/concepts/file-uploads.md), [estimativa/cobrança](https://docs.higgsfield.ai/docs/concepts/billing-and-retention.md). As páginas Markdown foram lidas por HTTP público após incompatibilidade do leitor web com seu tipo de conteúdo.

HeyGen: [áudio para avatar](https://developers.heygen.com/audio-to-video), [geração de fala](https://developers.heygen.com/reference/generate-speech), [consulta de vídeo](https://developers.heygen.com/reference/get-video). Consulta pública em 6/10/2026, sem credenciais nem geração paga.
