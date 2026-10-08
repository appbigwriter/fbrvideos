# Entrega técnica da tasklist — 7/10/2026

Escopo: TL-01–TL-18 da [tasklist](../tasklist-remanescente-2026-10-06.md), autorizado para implementação autônoma. As frentes internas foram implementadas/integradas e os pontos dependentes de configuração foram provisionados. Isso não encerra os gates audiovisuais humanos ou autoriza consumo pago.

## Resultado

O aplicativo agora tem um caminho integrado do planejamento aprovado até mídia candidata, avaliação, montagem, correção e exportação. O runtime sintético persiste recibos e produz WAV/PNG/MP4 locais; não representa voz, avatar, aparência ou qualidade de fornecedor. A composição real usa os adapters Higgsfield/HeyGen, com configuração explícita de conta, parâmetros, inputs aprovados, estimativa, faturamento e autorização.

| Tarefa | Entrega e evidência |
| --- | --- |
| TL-01 | `ProductionPipeline`: início público, compilação de etapas, dependências, admissão/reserva, avanço idempotente e recuperação com leases/fencing. |
| TL-02 | Adapters normalizados, recibos persistentes e `createRealProviderRuntime`/`createRealPipelineBindings`; testes offline de contratos e composição. |
| TL-03 | Outputs copiados, medidos por `probeLocalMedia`, publicados atomicamente como candidatos owned; áudio mede samples decodificados; proveniência fixa job/configuração/hash. |
| TL-04 | API/tela de candidatos áudio/imagem/clipe; decisão humana explícita, direitos e revisão exatos; rejeição e alternativas limitadas. |
| TL-05 | Linhagem entre candidato v1, avaliação v2 e revisões de cobrança do job; testes positivos e negativos de bytes/ownership/spec/configuração. |
| TL-06 | Bindings de montagem compilados pelo dossiê, renderer automático, timeline e legendas; recibos/mídia sintéticos recuperáveis. |
| TL-07 | Compilação de impacto/custo e execução integrada das correções; regeneração visual preserva áudio; editar fala refaz também imagens/clipes invalidados. |
| TL-08 | Jornada por APIs públicas em PGlite e PostgreSQL nativo, com rejeição/retry, cancelamento preparado, correção visual/narrativa, recriação de API/runtime e quatro arquivos de entrega. QA de navegador com vídeos persistidos. |
| TL-09 | PNG/JPEG/WebP/WAV/MP3/MP4 exercitados; renderer mede os inputs efetivos e recusa MIME/dimensões/duração divergentes. |
| TL-10 | Inbox deduplicado/autenticável, callback só aciona consulta; polling/backoff; recibo salvo antes de `queue.complete` recuperado sem retransmitir, inclusive em HeyGen. |
| TL-11 | Quotes persistidos/exatos/expiráveis e revalidados antes do send; atualização da mesma reserva ou cancelamento preparado + nova tentativa; fatura/reembolso tardios por consulta; aumento explícito do teto com evidência. |
| TL-12 | Aligner por timings observados, layout opcional versionado, quebras SRT/VTT e posição/largura VTT; evidência LUFS/true peak por política explícita. Falha fica registrada e não consome novos renders idênticos automaticamente. |
| TL-13 | Reinício/replay/recibo perdido/consulta autenticada/custos/backup-restauração testados; recuperação reutiliza body e URLs assinadas do journal; heartbeat protege render em andamento. |
| TL-14 | Scripts seguros de operação local, readiness, métricas agregadas persistidas, histórico operacional e runbook de recuperação/rollback. |
| TL-15 | Calibração persistida/versionada, relatório e decisões humanas; uma amostra por produção; origem sintética/desconhecida não valida perfil real. |
| TL-16 | Inventário em streaming, dry-run com hash, rechecagem de referências históricas/backup/recibos sintéticos; executor provisionado exige política, backup verificado e exclusão global de escritores. Descarte continua desativado. |
| TL-17 | Streaming local até 2 GB, ranges current/history, hash integral antes de servir; backup/restore de mídia acima de 100 MB sem buffers integrais. Ingestão/probe/render atuais continuam limitados a 100 MB por input; excedente bloqueia explicitamente. |
| TL-18 | Reauditoria semântica de fala por OAuth/port de inferência, journal e hashes/fontes imutáveis; resultado failed/unknown bloqueia derivados e permite corrigir/reauditar. Sinal de modelo não cria aprovação humana. |

## Verificação

- `npm run verify`: 164 casos, 162 aprovados, dois exclusivos de PostgreSQL nativo omitidos; tipos e build aprovados. Log: `var/verify-tasklist-entrega.log`.
- Após os últimos ajustes da disponibilidade de geração e estabilidade de consultas da UI: três testes públicos/operacionais passaram (`var/verify-tasklist-public-final.log`), tipos, 16 testes web e build passaram novamente.
- Rodada nativa integrada anterior: 28 aprovados (`var/verify-tasklist-native.log`). Após mudanças de fila/backup: 19 aprovados (`var/verify-tasklist-native-final.log`). Jornada completa também passou separadamente no PostgreSQL nativo (`var/verify-tasklist-journey-native.log`). São rodadas com sobreposição, não contagem de casos únicos somada.
- Revisões funcionais, de segurança e de qualidade identificaram e corrigiram: outputs duplicados no dossiê, tentativa após rejeição, fonte/duração desconhecida, queries fora da transação, corpo assinado alterado em recovery, recibo persistido sem reconhecimento pela fila, origem sintética inferida pelo nome, buffers de integridade, retry idêntico de qualidade e recuperação limitada às primeiras produções.
- Navegador em banco temporário: atual 4,4 s e histórico 4 s, ambos carregados sem erro de mídia; comparação de versões; entrega MP4/SRT/VTT/manifesto; viewport 360 px sem overflow (largura útil 345 px); navegação por teclado; console sem erros no recorte. O servidor e a aba de ensaio foram encerrados.

Todos esses ensaios são sintéticos. Não houve geração paga, aceitação editorial real, calibração humana real ou alteração das duas produções existentes.

## Configuração e operação

API e worker devem usar o mesmo modo e AssetStore:

- `FBR_GENERATION_MODE=simulated`: journal de ensaio legado, sem produção de mídia; preservado nos serviços existentes.
- `FBR_GENERATION_MODE=synthetic`: composição local integrada, WAV/PNG/MP4 e custo zero. O operador precisa aprovar planejamento e candidatos explicitamente. Nada inicia apenas por carregar o runtime.
- `FBR_GENERATION_MODE=provisioned`: módulo indicado por `FBR_PROVIDER_BINDINGS_MODULE`, exportando `createProviderRuntime({db,files})`. Pode usar `createRealProviderRuntime(config,context)`; operações sem autorização/configuração permanecem fechadas. Credenciais são server-only.

Cada rota real fornece conta/modelo/capabilities/evidências, gate `authorize`, parâmetros fixados, quote exato, resolução/upload dos inputs aprovados e billing. Para webhooks, configurar decoder que autentique o sinal antes de entregar à inbox. O endpoint de callback só existe com esse decoder; status/custo/output recebidos não são aplicados diretamente.

Qualidade avançada recebe `assembly_quality`: aligner com versão, layout, necessidade de timings observados e política de mix. Nenhum alvo LUFS ou critério humano foi escolhido em nome do responsável. SRT preserva linhas; posicionamento da área reservada é aplicado no VTT, sujeito à apresentação do player. Receitas de animação devem respeitar a duração medida e o limite cotado; excedente exige rever cenas/cotação, sem alterar parâmetros autorizados silenciosamente.

Migrações 011–015 são aditivas. Backup atual usa formato 12 e mantém leitores dos formatos 5–11. Leases de avanço e agendamento de polling são reconstruíveis; recibos, comandos, outputs locais, avaliações, orçamento, evidências e observações persistentes entram no backup. Restore continua exigindo banco vazio e hashes válidos. Ver [operação](operacao-tasklist-2026-10-06.md) e [mídia/streaming](midia-qualidade-streaming-2026-10-06.md).

Backup final do aplicativo: `var/full-backups/2026-10-07T23-43-58-331Z`, metadados `metadata/6c24f933b21cdc69925502840352b0b8456dfeba582cf365f8c54f6269bcff55.json`, zero arquivos de mídia porque as duas produções do aplicativo continuam sem geração. Seus IDs/revisões/status foram conferidos antes/depois e permaneceram v6/v5, `awaiting_decision`. API/worker receberam o código novo; Vite, banco e serviços de outros projetos foram preservados.

## O que permanece externo

EX-01–EX-04: artigo/referências/voz autorizados; acesso e IDs/modelos reais; teto/moeda/autorização de gasto; rubrica e julgamento humano; ambiente/política definitivos. `docs/piloto/entrada-piloto.json` segue `awaiting_inputs`.

A contingência antiga `retomar-backlog-fbrvideos`, destinada a 5/10, foi removida em 7/10 para não disparar instruções vencidas nem duplicar execução.
