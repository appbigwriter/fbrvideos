# Operação local — 5 de outubro de 2026

Atualização de 6/10: [entregas e provisionamento das sprints](continuacao-sprints-autonomas-2026-10-06.md). As descrições históricas abaixo sobre autenticação e modo exclusivo de simulação foram ampliadas conforme as opções deste adendo.

API em 127.0.0.1:3001, web em 127.0.0.1:5173 e PostgreSQL nativo em 127.0.0.1:55432. A configuração existente do planejador OAuth é preservada. Acesso remoto/autenticação de implantação, retenção definitiva e geração de fornecedores reais ainda não foram liberados.

`npm run db:migrate` aplica configuração, snapshots, inferência, fila e mídia. `npm run dev:api` e `npm run dev:web` iniciam os serviços. `npm run dev:worker` exige `FBR_GENERATION_MODE=simulated`; o dispatcher transporta IDs a cada cinco segundos. `npm run verify` confere tipos, contratos/domínio, infra, pipeline, web e build.

## Adendo de operação — 6/10

As migrações chegam à 010; os backups de metadados usam formato 10 e aceitam formatos 5–9. `npm run db:backup:full` cria um diretório em `var/full-backups` com metadados e mídia verificada. `FBR_BACKUP_ROOT` pode definir outro destino, fora de `FBR_ASSET_ROOT`. O snapshot real criado em 6/10 contém zero arquivos de mídia, pois as produções do aplicativo ainda não têm outputs de fornecedor; os testes exercitam cópia/restauração de mídia sintética.

`captureFullBackup` e `restoreFullBackup` recebem AssetStores. Restore verifica hash do arquivo de metadados, seu hash interno e cada arquivo antes de restaurar um banco vazio e migrado. Não substitui banco existente. Guardar a chave/hash retornados pelo comando junto do diretório e manter uma cópia em armazenamento independente conforme a política final.

`GET /api/operations` e a página Configurações mostram estado agregado e tempos por rota. Eles não expõem corpos, segredos ou parâmetros de geração. Retenção permanece um plano gerado por `planRetention`: referências históricas e arquivos em período de graça são conservados; o helper não executa exclusões.

Para uma instalação privada, `FBR_OPERATOR_ACCESS_TOKEN` tem no mínimo 32 caracteres e fica somente no servidor. Login cria cookie HttpOnly/SameSite, com expiração e logout revogável. Para bind remoto, definir também `FBR_ALLOWED_HOSTS` e `FBR_ALLOWED_ORIGINS`, separados por vírgulas, e usar proxy HTTPS; cookies remotos são Secure. A configuração de produção não foi ativada neste workspace. Este modo tem um principal operador por instalação, não gestão multiusuário/tenant.

`FBR_PROVIDER_BINDINGS_MODULE` aponta para módulo local do workspace que exporta `createProviderRuntime({db,files})`. A fábrica retorna `adapters`, `admission`, `admitReal` e, quando necessários, `prepareCorrection`/`advance`. Não executar geração na inicialização. `admission` consulta evidências/configuração já fixadas; estimativas e chamadas de rede ocorrem antes da transação de reserva. `admitReal` distingue novos envios de reconciliação de pedidos existentes na mesma conta.

A fábrica pode devolver `files: AssetStore` para provisionar object storage futuro. API, render/worker e backup completo devem compartilhar esse store; o filesystem existente permanece o padrão. O loader confere o caminho real do módulo dentro do workspace, incluindo symlinks.

API e worker compartilham esse módulo. `FBR_GENERATION_MODE=provisioned` exige módulo presente e políticas válidas; `simulated` conserva os adapters de teste. IDs reais não podem usar prefixo `sim_`. A fábrica conecta os clientes REST e normalizadores da conta ao `GenerationAdapter`; preserva o snapshot e não substitui modelo/voz/engine silenciosamente.

Usar `PostgresHttpTransmissionJournal` para fixar transmissão. Recuperação idempotente só é habilitada com evidência e corpo/endpoint/conta preservados. HeyGen permanece sem replay automático de envio ambíguo. Higgsfield exige suporte documentado e a mesma intenção; estimativa de USD não pode virar BRL sem conversão/evidência explícita.

`PostgresReviewWorkflow.estimateCorrection`, `publishCorrectionAssets` e `beginGeneration` são entradas internas do runtime. A API expõe declarações de revisão, autorização do limite e execução do plano exato, não inserção arbitrária de outputs ou liberação fictícia de capacidade. `LocalAssemblyService` recebe bindings preparados pelo pipeline e publica apenas quando arquivos, avaliações, jobs e custos estão válidos.

Para testar pg-boss nativo em banco separado:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://fbr:fbr_local_only@127.0.0.1:55432/fbr_s1_test'
node --import tsx --test packages/infra/test/generation-queue.test.ts
```

Essa credencial é exclusivamente do cluster local de desenvolvimento. A suíte cria entidades sintéticas; não apaga os registros editoriais do aplicativo.

FFmpeg/ffprobe são necessários para o renderer. O teste usa mídia sintética e é omitido se os executáveis faltarem. Execução é sem shell; credenciais/URLs de fornecedor não entram nos argumentos. Render inicial suporta H.264/AAC, uma voz principal, imagens/clips e cortes; outras receitas precisam de implementação/calibração.

Após reinício, o dispatcher encontra intenções sem despacho. A lease cerca o worker; envio ambíguo sem ID não recebe novo submit. Conferir custos/estado antes de nova tentativa. Pausa impede novos envios e mantém consulta de trabalhos ativos. Cancelar libera trabalhos não enviados; cancelamento externo depende de consulta queued e confirmação de cobrança/reembolso.

Conexões ociosas do pool recebem tratamento de erro sanitizado (`postgres_idle_connection_lost`). O driver remove a conexão interrompida; consultas posteriores podem reconectar quando o banco voltar. Isso mantém API/worker vivos, mas não reinicia o processo do PostgreSQL automaticamente. Teste de recuperação nativa: `packages/infra/test/database-recovery.test.ts` com `TEST_DATABASE_URL` definido.

`npm run db:backup` cria JSON em `var/backups/`, com SHA-256 e snapshot consistente de revisões, comandos, intenções, custos, mídia e avaliações. O arquivo é privado e contém conteúdo editorial. `.env` e credenciais do processo não são incluídos. pg-boss é reconstruível a partir do journal e não integra esse snapshot.

Copiar também o diretório configurado do AssetStore, preservando chaves/hashes. `includes_asset_bytes:false` registra que o JSON não contém arquivos. Restore só de metadados não permite entregar mídia ausente.

`restoreMetadataBackup` aceita backup íntegro somente em banco vazio com migrações aplicadas. Hash incorreto, registros existentes ou violação de constraints abortam sem substituir dados. Validar em destino isolado antes de trocar ambiente. O teste restaura snapshots/fila do PostgreSQL nativo em banco isolado e verifica replay/imutabilidade. Conexão e retenção precisam ser mantidas separadamente.

Migrações 004/005 são aditivas. Para rollback de código, preservar dados e interromper o serviço correspondente. Não remover intenções/custos para resolver falha de worker. Restore do banco do aplicativo, publicação e retenção permanecem decisões do ambiente final.

Próxima liberação depende dos insumos em `docs/piloto/insumos.md`, avaliação editorial/audiovisual e conexão das rotas/estimativas da conta. UI de revisão/correção/entrega, métricas e integração de providers continuam na fila. Estado atual: [registro de continuação](s3-fundacao-2026-10-05.md).
