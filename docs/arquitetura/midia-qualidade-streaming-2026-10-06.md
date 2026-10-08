# Mídia local, alinhamento e streaming

Implementação técnica de TL-09, fronteiras de TL-12 e storage de TL-17 em 6 de outubro de 2026.

## Formatos e integridade

`media-probe.test.ts` gera arquivos sintéticos com FFmpeg e mede PNG/JPEG/WebP, WAV/MP3 e MP4. O áudio é contado em samples PCM efetivamente decodificados, incluindo o teste MP3 de quatro segundos; não é deduzido do texto ou da duração-alvo. O renderer aceita JPEG/MP3, verifica hash e mede novamente MIME, dimensões e duração dos bytes copiados. Metadados divergentes, playlists, signatures desconhecidas e arquivos truncados são recusados. O demuxer MOV não pode seguir referências externas.

O limite vigente do probe/renderer bufferizado é 100 MB. O storage tem uma extensão de streaming para até 2 GB por padrão; isso amplia leitura/gravação do storage, não elimina o limite deliberado do decoder ou de todos os consumidores.

## Alinhamento e mixagem

`SubtitleAligner` recebe áudio, texto e língua e devolve timings observados, origem e hash. `AssemblyBindings` admite alinhamentos opcionais; quando fornecidos, exige cobertura das falas, correspondência integral do texto/hash, intervalos ordenados dentro do áudio e layout válido. A segmentação respeita limites de caracteres/linhas e velocidade de leitura. Não há interpolação de tempos por contagem de palavras. Sem evidência do aligner, permanece a legenda por trecho de áudio medido já existente.

Atualização de 7 de outubro: `TimelineSchema.subtitle_layout` é opcional e não adiciona defaults a records antigos. As quebras explícitas por linha agora permanecem na timeline, SRT e VTT. VTT aplica `line` percentual com âncora `end`, `position` central, `size` da largura reservada e `align:center`, conforme [WebVTT §4.4](https://www.w3.org/TR/webvtt1/#webvtt-cue-settings). SRT conserva as quebras; posicionamento percentual é recurso do VTT. Preferências tipográficas do player podem acrescentar wraps, portanto a revisão visual humana continua necessária. Quando apenas layout está configurado, wrapping usa os limites de áudio medidos existentes; texto maior que o máximo de linhas exige alinhamento observado, sem fabricar subdivisões temporais.

`inspectAudioMix` mede LUFS integrado, true peak e loudness range por FFmpeg/EBU R128. A comparação usa política explicitamente fornecida, sem alterar o áudio. Silêncio ou métrica indefinida permanece `unknown`. Os testes demonstram resultado medido, divergência de loudness, pico fora da política e silêncio. Isso não comprova lip sync nem qualidade editorial/audiovisual humana. A integração registra evidência técnica e mantém julgamento humano separado. As legendas são sidecars posicionados em VTT; não são queimadas no vídeo.

Falhas de alinhamento/mixagem registram `assembly_quality_subtitle_alignment_failed` ou `assembly_quality_audio_mix_failed`, com fingerprint da configuração, referência exata do dossiê e evidência imutável, mesmo quando falta o aligner e não há render. A recuperação deve impedir nova tentativa idêntica até mudar configuração ou inputs/dossiê. Não considerar mudança de versão de produção por orçamento como mudança do input audiovisual.

## Storage e ranges

`StreamingAssetStore` é extensão opcional de `AssetStore`. `LocalImmutableAssetStore.openVerified` verifica o arquivo inteiro em chunks de 256 KB e entrega leitura completa ou um range do mesmo handle. Não carrega o arquivo inteiro na memória. `putImmutableStream` verifica tamanho/hash incremental, publica por hardlink sem sobrescrita e remove temporários após falha. `parseMediaRange` suporta range único, aberto e suffix; rejeita ranges impossíveis ou múltiplos. A API deve responder 416 para a rejeição e preservar ownership/autorização antes de abrir o storage.

## Verificação

Comando: `node --import tsx --test packages/infra/test/media-probe.test.ts packages/infra/test/media-range.test.ts packages/infra/test/local-renderer.test.ts packages/infra/test/asset-store.test.ts packages/pipeline/test/subtitle-alignment.test.ts packages/pipeline/test/assembly.test.ts`.

Resultado: 11 testes aprovados, nenhum omitido. `npm run typecheck` passou. Os novos testes não alteram produções existentes, não usam APIs pagas e não registram aceites humanos.

Integração no trabalho principal: exports dos novos módulos, uso de ranges/streaming nas rotas atuais e históricas, policy explícita/evidência na avaliação técnica do render e aligner configurável quando timings reais estiverem disponíveis.
