# Mídia local, alinhamento e streaming

Implementação técnica de TL-09, fronteiras de TL-12 e storage de TL-17 em 6 de outubro de 2026.

## Formatos e integridade

`media-probe.test.ts` gera arquivos sintéticos com FFmpeg e mede PNG/JPEG/WebP, WAV/MP3 e MP4. O áudio é contado em samples PCM efetivamente decodificados, incluindo o teste MP3 de quatro segundos; não é deduzido do texto ou da duração-alvo. O renderer aceita JPEG/MP3, verifica hash e mede novamente MIME, dimensões e duração dos bytes copiados. Metadados divergentes, playlists, signatures desconhecidas e arquivos truncados são recusados. O demuxer MOV não pode seguir referências externas.

O limite vigente do probe/renderer bufferizado é 100 MB. O storage tem uma extensão de streaming para até 2 GB por padrão; isso amplia leitura/gravação do storage, não elimina o limite deliberado do decoder ou de todos os consumidores.

## Alinhamento e mixagem

`SubtitleAligner` recebe áudio, texto e língua e devolve timings observados, origem e hash. `AssemblyBindings` admite alinhamentos opcionais; quando fornecidos, exige cobertura das falas, correspondência integral do texto/hash, intervalos ordenados dentro do áudio e layout válido. A segmentação respeita limites de caracteres/linhas e velocidade de leitura. Não há interpolação de tempos por contagem de palavras. Sem evidência do aligner, permanece a legenda por trecho de áudio medido já existente.

`inspectAudioMix` mede LUFS integrado, true peak e loudness range por FFmpeg/EBU R128. A comparação usa política explicitamente fornecida, sem alterar o áudio. Silêncio ou métrica indefinida permanece `unknown`. Os testes demonstram resultado medido, divergência de loudness, pico fora da política e silêncio. Isso não comprova lip sync nem qualidade editorial/audiovisual humana. A integração deve registrar evidência técnica e manter julgamento humano separado. A área reservada é uma região normalizada validada pelo port; não significa legendas queimadas no vídeo nem aceite visual do perfil.

## Storage e ranges

`StreamingAssetStore` é extensão opcional de `AssetStore`. `LocalImmutableAssetStore.openVerified` verifica o arquivo inteiro em chunks de 256 KB e entrega leitura completa ou um range do mesmo handle. Não carrega o arquivo inteiro na memória. `putImmutableStream` verifica tamanho/hash incremental, publica por hardlink sem sobrescrita e remove temporários após falha. `parseMediaRange` suporta range único, aberto e suffix; rejeita ranges impossíveis ou múltiplos. A API deve responder 416 para a rejeição e preservar ownership/autorização antes de abrir o storage.

## Verificação

Comando: `node --import tsx --test packages/infra/test/media-probe.test.ts packages/infra/test/media-range.test.ts packages/infra/test/local-renderer.test.ts packages/infra/test/asset-store.test.ts packages/pipeline/test/subtitle-alignment.test.ts packages/pipeline/test/assembly.test.ts`.

Resultado: 11 testes aprovados, nenhum omitido. `npm run typecheck` passou. Os novos testes não alteram produções existentes, não usam APIs pagas e não registram aceites humanos.

Integração no trabalho principal: exports dos novos módulos, uso de ranges/streaming nas rotas atuais e históricas, policy explícita/evidência na avaliação técnica do render e aligner configurável quando timings reais estiverem disponíveis.
