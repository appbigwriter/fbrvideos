# Protocolo supervisionado S0-C01

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Estado: pronto para preenchimento e execução após G0. Nenhuma etapa paga foi executada. Perfil, receita e formato continuam candidatos até decisão humana. Este protocolo define trabalho de C; não modifica contratos compartilhados de B.

## 1. Preparação e registro

1. Informar os mínimos externos da ficha e executar `preflight.ps1`. A equipe resolve o restante do checklist conforme receita; referências extras e amostra vocal não são universais. Consultar a conta autorizada e confirmar voz, look/engine, escopos, limites e custo aplicável antes dos jobs. Guardar somente resultado e IDs; segredos permanecem no ambiente protegido.
2. Criar uma pasta de ensaio por `pilot_id`/tentativa no armazenamento permitido. Preservar originais e SHA-256, artigo com trechos identificados, Bible/referências fixados, ficha, dossiê, assets, registros de execução, timeline e avaliações. URLs assinadas são temporárias e não entram no relatório público.
3. Registrar teto total, reservas por etapa, máximo de tentativas por etapa e total, estimativa com incerteza, duração e custo por operação. Antes de cada job, reconciliar gastos confirmados e compromissos em andamento. Sem margem segura ou custo conhecido, abrir pendência. No timeout, consultar o job existente; não gerar de novo sem saber seu destino.
4. Aprovar receita, duração, relação de aspecto, resolução, fps, mixagem, legendas e tolerâncias. Começar com conteúdo explicativo/opinativo apenas se compatível com o artigo. Relato em primeira pessoa precisa de experiência explicitamente sustentada. Uma receita conservadora é candidata, não repertório já validado.

Defaults técnicos candidatos de C, revisáveis ao conhecer artigo/canal: 60 s, 16:9, montagem 1920×1080/30 fps, áudio 48 kHz/estéreo, -16 LUFS e teto -1 dBTP; tolerâncias iniciais de lip sync 120 ms e legendas 150 ms; até duas tentativas por etapa e doze no total, sempre subordinadas ao teto autorizado. São propostas para discutir na calibração, não limites da API nem padrão validado. Apoio de menor resolução precisa de decisão de escala/qualidade. O usuário pode escolher artigo/perfil sem preencher esses detalhes.

## 2. Direção e roteiro: revisões A–C

- **A — briefing:** extrair tese, fatos, recomendações e experiências; confirmar associação autora/personagem; escolher recorte e registrar omissões.
- **B — roteiro:** identificar cada fala e sua classe; ligar fatos/experiências aos trechos da fonte; marcar opiniões/transições. Remover ou reformular qualquer alegação não sustentada antes do áudio.
- **C — direção:** produzir automaticamente proposta de seis a oito planos, com uma ação principal por plano, referências versionadas, estado inicial/final, enquadramento, continuidade, áreas de legenda e alternativa. O humano revisa a proposta na calibração. Os tempos são provisórios até obter áudio real.

Cobertura mínima dos seis planos, ajustável ao conteúdo:

| Plano | Função | Rota candidata | O que exercita |
|---|---|---|---|
| P01 | Abrir argumento | Avatar em câmera | Rosto, figurino, pronúncia e lip sync |
| P02 | Contextualizar argumento | Apoio estático com voz em off | Saída do avatar mantendo identidade vocal |
| P03 | Ilustrar um ponto | Apoio animado com voz em off | Uma classe de movimento simples; estado inicial/final |
| P04 | Desenvolver/contrapor | Avatar em câmera | Retorno ao avatar; eixo, luz, ritmo e voz |
| P05 | Sustentar conclusão | Apoio estático ou animado | Fidelidade fala/imagem e continuidade |
| P06 | Encerrar | Avatar em câmera | Retorno final, corte e conclusão sem nova alegação |

Os planos são funções, não conteúdo fictício a substituir artigo/Bible. A classe de movimento pode ser ambiente com câmera fixa ou gesto simples, conforme referências. Manipulação, deslocamento ou reflexos ficam fora do recorte inicial salvo experimento declarado. O terceiro caminho, apoio estático, não substitui o teste de apoio animado exigido pelo spike.

## 3. Ensaio vocal e caminho HeyGen

**Hipótese preferencial:** o mesmo áudio oficial deve servir à timeline e ao avatar. Após confirmar a voz e o endpoint compatível da matriz, sintetizar segmentos semânticos ou um bloco contínuo cobrindo câmera → off → câmera. Incluir nomes/pronúncias do artigo e pausas planejadas. Aprovar texto completo, identidade, idioma, interpretação e qualidade antes do clipe. Guardar arquivo original, duração e alinhamento disponível; não confiar em timestamps sem comparação auditiva.

Para cada trecho em câmera, fornecer ao HeyGen o segmento exato do áudio aprovado pela rota documentada `audio_url` ou `audio_asset_id`. Selecionar somente look/engine confirmado na conta. Estes endpoints são candidatos documentados, ainda sem adapter integrado. URLs devem continuar acessíveis durante ingestão; upload por asset permite testar outra via sem publicar o arquivo em URL própria. Registrar a representação de áudio enviada e seu vínculo ao hash local.

Baixar o resultado para armazenamento permitido; conferir silêncio inicial, duração, offset entre faixa devolvida e fonte, corte final, lipsync e mudanças de ritmo. O fato de enviar o mesmo arquivo não prova alinhamento exato do vídeo. Ao montar, usar a faixa oficial uma única vez e silenciar o áudio embutido dos clipes, após alinhar a imagem à fala. Se o áudio oficial for segmentado, preservar pausas e respirações; não cortar fonemas.

**Alternativa condicionada:** gerar fala pelo avatar e obter o áudio do vídeo real como fonte oficial. Extrair e reutilizar trechos dessa mesma faixa em off, sem assumir exportação vocal separada. Essa via exige primeiro gerar o trecho com todos os segmentos necessários ou demonstrar que o catálogo/engine também fornece TTS equivalente. Comparar tomadas em câmera/off para timbre, sotaque, prosódia e nível. Uma voz com mesmo nome/ID pode ter diferenças entre engines. Sem continuidade satisfatória, revisar voz/fornecedor/perfil; não declarar H03 validada.

## 4. Imagens, apoio e movimento: revisões D/E

1. Produzir/selecionar composição para P02/P03/P05 conforme universo; aprovar imagem **D** antes de animação derivada. Se fornecedor de imagem ainda não definido, manter etapa pendente; usar referência própria aprovada é alternativa explícita, não teste de geração de imagem.
2. Executar uma classe de movimento em P03 com duração orientada pela fala efetiva. Registrar endpoint/modelo, entrada aprovada, prompt efetivamente enviado, parâmetros e elementos não suportados. Avaliar início/meio/fim e movimento integral **E**; comparar deformações, objetos fixos, câmera e estado final.
3. Se a animação falhar, distinguir direção inviável de falha técnica. Uma nova tentativa exige limite disponível e hipótese de correção. Aplicar alternativa visual somente após revisão de sua função narrativa. Substituir por imagem com movimento de montagem preserva um vídeo conservador, mas mantém a classe de animação reprovada ou não validada no relatório.
4. Usar Higgsfield como candidata inicial de imagem/animação, verificando a operação e a conta; HeyGen de apoio permanece alternativa documentada. Se qualquer clipe incluir áudio próprio, tratar sua trilha gerada como candidata. Silenciá-la por padrão nesta avaliação vocal; som ambiente adicional só entra após decisão de mixagem. Não permitir segunda fala concorrente.

## 5. Montagem e revisão integral F

1. Medir cada faixa e clipe com FFprobe. Resolver entradas/saídas e offsets na timeline; segmentar por pausas semânticas. Se clipe não cobrir a fala, ajustar plano ou gerar trecho autorizado; não acelerar voz automaticamente.
2. Normalizar dimensão/fps com decisão registrada; registrar recorte/escala necessários e limitações do apoio. O resultado normalizado não comprova resolução nativa. Montar avatar → apoio → avatar primeiro para detectar descontinuidade antes de ampliar o vídeo.
3. Gerar SRT/VTT com texto aprovado e alinhamento verificado. Checar nomes, pausas, quebras, sobreposições e áreas reservadas. O arquivo de legenda do fornecedor é candidato, não aprovação da legenda final após cortes.
4. Aplicar mixagem aprovada: uma voz principal, sem duplicação; níveis/true peak segundo perfil; trilha/ambiente somente se legíveis e permitidos. Checar medição e escuta em condições de reprodução definidas.
5. Renderizar preview real e assistir integralmente com a rubrica, também conferindo as transições adjacentes. Aprovar somente a versão/hash assistidos. Alterações exigem revisão dos derivados afetados.

Comandos locais de inspeção, após definir `$mediaFile` como caminho de arquivo de ensaio existente:

```powershell
ffprobe -v error -show_format -show_streams -of json $mediaFile
ffmpeg -v error -i $mediaFile -f null NUL
Get-FileHash -LiteralPath $mediaFile -Algorithm SHA256
```

Esses comandos verificam metadados, decodificação e integridade identificável. Não medem fidelidade narrativa, continuidade ou identidade. Registrar saídas no relatório, removendo caminhos privados desnecessários. A medição de loudness/peak exige configuração/medidor apropriado ao perfil; não declarar esses limites verificados apenas com os comandos acima.

## 6. Fechamento e decisão

Entregar vídeo, áudio oficial, imagens/clipes selecionados, legendas, timeline, manifesto, avaliações com timecodes e tentativas, custo confirmado/comprometido/estimado, tempo do fornecedor/execução/revisão separados e classes permitidas/reprovadas. Calcular aprovação na primeira tentativa por classe, tentativas, alternativas e falhas descobertas só na montagem; custo por vídeo aprovado somente se houver vídeo aprovado.

B revisa integração, versões e reprodução técnica. O responsável humano decide estética/fidelidade; C registra escopo validado ou causa de bloqueio. O primeiro ensaio não conclui H01–H07 nem repetibilidade: testar outros dois artigos e experimentos específicos quando aplicáveis. Fundação e AG-01 podem avançar com contratos e fixtures enquanto o gate audiovisual permanece pendente.

## 7. Execução candidata Higgsfield

Em G0, registrar acesso por rota: imagem/animação Higgsfield e voz/avatar separado. Uma conexão válida não confirma outra conta, operação ou qualidade. Escolher modelo/endpoint de imagem e imagem→vídeo pelos schemas oficiais; registrar ambiente, campos suportados, limites e estimativa autenticada antes de reservar custo.

Produzir composição/imagem com referências de Tara, avaliar D, depois animar uma classe simples e avaliar E. Não substituir a imagem aprovada por text-to-video silenciosamente. Registrar tentativas, custo e aderência da identidade/ação/continuidade; montar o trecho avatar → apoio → avatar usando o áudio oficial. Som próprio deve ser desativado/removido conforme política de mixagem.

Persistir chave de idempotência por intenção/tentativa antes de enviar; timeout ambíguo permite replay somente do mesmo pedido/chave. Salvar request_id, consultar destino e distinguir queued/in_progress. Cancelamento só queued; pausa/cancelamento local não encerra pedido iniciado. Conferir reembolso antes de liberar reserva.

Uploads seguem headers retornados e não recebem credenciais da API no storage. Copiar mídia concluída para armazenamento do ensaio com hash e metadados; não usar URL temporária como arquivo final. Exercitar recuperação e correção visual preservando voz/áudio aprovados. O relatório deve declarar a operação efetivamente testada e não extrapolar aceite para o catálogo inteiro.
