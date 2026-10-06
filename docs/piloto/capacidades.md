# Matriz de capacidades — evidência documental, sem integração real

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Consulta: 4 de outubro de 2026. As fontes abaixo são documentação primária do fornecedor. **Nenhuma API foi autenticada, chamada ou integrada neste spike.** `Documentado` descreve a superfície pública; `não testado` descreve a conta e o caso FBR. Recursos podem depender da voz, look, engine e plano. Reconsultar schema/limites antes de implementar adapters.

| Capacidade necessária | Evidência documental/candidato | Teste necessário para FBR | Situação |
|---|---|---|---|
| Voz separada em off | `POST /v3/voices/speech`: vozes Starfish compatíveis; áudio, duração e exemplo de timestamps. [Third Party Speech](https://developers.heygen.com/docs/voices/speech) | Listar voz disponível; testar inglês para Game Style, pronúncias, prosódia, timestamps e arquivo | Documentado; não testado |
| Clone profissional | `POST /v3/models/audio/tts` ou `/stream`, com clone profissional ativo e recurso pago próprio. [HeyGen Voice Speech](https://developers.heygen.com/docs/voices/heygen-voice-speech) | Confirmar tipo/estado do clone e acesso; comparar narração aprovada | Documentado; não testado; não selecionado |
| Áudio aprovado no avatar | `POST /v3/videos`, `type: avatar` ou `image`, uma fonte `audio_url` ou `audio_asset_id`, sem `script`. [Audio to Video](https://developers.heygen.com/audio-to-video) | Confirmar look/imagem, engine e upload; medir offset/lipsync e preservação da identidade | Documentado; não testado |
| Configuração visual de avatar | Engine elegível por look e controles variam por tipo de avatar. [Create Video](https://developers.heygen.com/reference/create-video) | Confirmar campos suportados no caso concreto; testar figurino, fundo, recorte e gesto | Documentado; não testado |
| Acompanhamento sem repetir job | Consulta de vídeo expõe estado e arquivos. [Get Video](https://developers.heygen.com/reference/get-video) | Persistir ID; consultar após timeout; mapear estados/erros e só repetir com destino conhecido | Documentado; não testado |
| Apoio animado alternativo | Candidato `heygen-video-1` em `POST /v3/models/videos`, inclusive imagem→vídeo, com áudio próprio. [HeyGen Video](https://developers.heygen.com/docs/models/heygen-video) | Imagem D aprovada; testar classe simples, estados, continuidade e necessidade de silenciar áudio | Documentado; não testado; fornecedor não escolhido |
| Identidade/referências | Referências de modelo não são garantia de consistência estética. [HeyGen Video](https://developers.heygen.com/docs/models/heygen-video) | Comparar rosto, look, ambiente e objetos em todos os frames relevantes | Não validado; H01/H02 pendentes |
| Geração de imagem/storyboard | Higgsfield candidata; operação/modelo ainda a selecionar no [catálogo](https://open.higgsfield.ai/explore) | Verificar schema/acesso e referências/composição; comparar identidade, ambiente e storyboard | Candidatura aceita; operação e resultado não testados |
| Narração idêntica entre câmera/off | Reutilização da mesma faixa oficial é hipótese de pipeline, com entrada de áudio documentada | Escuta e alinhamento reais; não trocar engine silenciosamente | H03 pendente |
| Montagem/inspeção local | FFmpeg e FFprobe 9.0 disponíveis; `-version` retornou sucesso | Renderizar mídia real, medir, decodificar e revisar | Disponibilidade testada; render real não executado |
| Custos, quota e plano | Dependem da conta e do endpoint; documentação não confirma limite da conta | Consultar plano/saldo autorizado; estimar/reservar; medir gastos por tentativa | Não verificado |

## Restrições concretas para o primeiro ensaio

A documentação de Audio to Video distingue áudio fornecido de roteiro sintetizado; não enviar ambos. O áudio via asset aceita MP3/WAV até 32 MB e a duração documentada por pedido chega a 30 minutos. Isso é limite publicado, não limite aceito pela conta testado. Usar uma amostra curta, dentro do teto aprovado. Links devem estar acessíveis ao fornecedor durante ingestão. [Audio to Video](https://developers.heygen.com/audio-to-video)

O endpoint Third Party Speech é para vozes compatíveis com Starfish; não presumir que qualquer voz visível no Studio funcione nele. A documentação descreve `locale` e pausas condicionadas ao suporte da voz. Timestamps retornados precisam de avaliação, especialmente pausas e nomes próprios. [Third Party Speech](https://developers.heygen.com/docs/voices/speech)

O clone profissional usa outra família de síntese, não uma substituição automática de Starfish. É um recurso pago com estado ativo exigido. Este pacote não cria, compra ou treina clone. [HeyGen Voice Speech](https://developers.heygen.com/docs/voices/heygen-voice-speech)

O candidato alternativo HeyGen de apoio documenta clipes de 5–15 segundos, resoluções 480p/768p e seu próprio som. Esses limites não se aplicam automaticamente à Higgsfield. Não presumir apoio nativo em 1080p nem ajustar duração da narração para acomodar limites. Normalização final precisa registrar escala/recorte e perda perceptível. A animação de imagem de apoio usa um modelo diferente da animação de pessoa com lip sync: nomes parecidos não tornam as rotas intercambiáveis. [HeyGen Video](https://developers.heygen.com/docs/models/heygen-video)

Não selecionar Video Agent para substituir este dossiê sem provar controle de fonte, referências e custos. Não inferir download de áudio separado do avatar: a alternativa do protocolo extrai áudio do vídeo realmente entregue. Não assumir seed como garantia universal de identidade/reprodutibilidade, cancelamento como interrupção de cobrança ou URL retornada como armazenamento durável.

## Registro por capability após o teste

Preservar: provedor/endpoint/modelo, data, conta/plano sem segredo, voz/look/engine, entradas e suas versões, parâmetros enviados e omitidos, job externo, tipo/limites observados, resultado técnico, avaliação humana, artefatos/hash, tentativas, custo e duração. Promover para `testado no recorte` somente com esses registros. Separar retorno HTTP, conclusão do job e aprovação audiovisual.

## Higgsfield — capacidades candidatas para o ensaio

| Capacidade | Evidência primária | Validação FBR pendente |
|---|---|---|
| Apoio por imagem/referências | [Catálogo](https://open.higgsfield.ai/explore) oferece operações de vídeo com referências | Selecionar operação, ler schema e testar imagem aprovada → ação/continuidade; nenhuma garantia de identidade |
| Texto→vídeo | [Seedance 2.0](https://open.higgsfield.ai/models/bytedance/seedance-2.0/text-to-video/api-reference): 4–15 s, resolução/formato, áudio opcional | Alternativa por classe calibrada; esse endpoint não documenta entrada de áudio oficial |
| Job e cancelamento | [Requests](https://docs.higgsfield.ai/docs/concepts/requests.md): estados e cancelamento somente queued | Persistir ID, testar consulta e queued/in_progress; completed não aprova asset |
| Idempotência | [Idempotent requests](https://docs.higgsfield.ai/docs/concepts/idempotency.md): replay do mesmo pedido com mesma chave | Timeout/crash sem nova geração; tentativa deliberada usa nova chave |
| Estimativa/cobrança | [Billing](https://docs.higgsfield.ai/docs/concepts/billing-and-retention.md): estimativa autenticada, failed/nsfw sem cobrança, cancelamento elegível reembolsado | Testar conta/parâmetros, reserva atômica e reconciliação; não inferir preço por aprovado |
| Webhook | [Webhooks](https://docs.higgsfield.ai/docs/how-to/webhooks.md): envelope, repetição e deduplicação | A página não especifica assinatura; confirmar por consulta autenticada antes de aplicar resultado sem autenticidade comprovada |
| Upload | [File uploads](https://docs.higgsfield.ai/docs/concepts/file-uploads.md): URL assinada e headers retornados | PUT sem credenciais da API; usar public_url só após sucesso; validar tipos/limites |
| Retenção | [Billing](https://docs.higgsfield.ai/docs/concepts/billing-and-retention.md): saída acessível por pelo menos sete dias | Copiar/verificar em AssetStore; recuperação de download interrompido |

Todas essas capacidades são documentadas ou candidatas, sem acesso autenticado, mídia real ou custo observado. Preservar catálogo técnico; habilitar repertório recorrente somente após calibração. Não promover audio/avatar por existir som nativo ou referência sonora.
