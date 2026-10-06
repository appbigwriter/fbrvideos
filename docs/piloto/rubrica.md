# Rubrica candidata — aprovação humana pendente

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Usar os descritores `adequado`, `requer ajuste`, `inadequado`; nenhuma média pode compensar falha obrigatória. `não aplicável` exige justificativa, e `não avaliado` mantém pendência. A rubrica precisa de aprovação e exemplos do responsável antes dos jobs. Valores técnicos são parâmetros da ficha, não metas universais inventadas.

| Critério obrigatório | Adequado | Requer ajuste / inadequado | Evidência |
|---|---|---|---|
| Fidelidade | Toda alegação factual/experiência ligada à fonte; opinião identificada | Afirmação sem suporte, alteração de sentido ou experiência pessoal inventada | Fala ID, trecho ID, revisão e motivo |
| Guardrails Game Style | Competência técnica, acolhimento e representação não sexualizada; transparência editorial no local aprovado | Benchmark/review/uso de produto inventado, gatekeeping, sexualização ou persona apresentada como pessoa real | Fonte conceitual, roteiro e frame/timecode |
| Identidade | Rosto, corpo, sinais distintivos e narrativa compatíveis com Bible/ref | Mudança relevante de traço, idade aparente, proporção ou identidade | Referência e frame/timecode |
| Ambiente/figurino/objetos | Elementos e estados correspondem à direção e referência | Objeto troca de forma/posição sem intenção; look ou luz conflitam | Plano e frames comparados |
| Ação/movimento | Uma ação legível, estado final atingido, anatomia estável | Deformação, contato falso, salto ou ação diferente | Reprodução integral e início/meio/fim |
| Continuidade | Cortes preservam heranças declaradas ou mudança intencional | Eixo, olhar, posição, luz ou progressão se contradizem | Planos adjacentes e registro de continuidade |
| Voz e inteligibilidade | Texto completo, identidade vocal, idioma e pronúncia aprovados | Fonema cortado, palavra omitida, sotaque/timbre incompatível | Áudio original, transcrição e timecode |
| Câmera/off | Transição mantém timbre, nível, interpretação e ritmo aprovados | Troca vocal perceptível, clique, volume abrupto ou prosódia incompatível | Escuta comparativa e transição integral |
| Sincronização labial | Boca corresponde à fala dentro da tolerância aprovada | Offset, deriva temporal ou articulação incompatível | Trecho e diferença temporal medida |
| Mixagem/integridade | Uma faixa vocal, mídia decodificável e limites do perfil atendidos | Voz dupla, clipping, silêncio involuntário ou arquivo ausente | Medição, escuta, FFprobe/decodificação |
| Fala/imagem | Apoio corresponde à função do roteiro; ilustração não apresentada como registro factual | Imagem contradiz ponto ou sugere experiência/local real sem base | Fala/plano e contexto |
| Legenda | Texto fiel, legível e temporizado; áreas de legenda respeitadas | Omissão, nome incorreto, sobreposição ou atraso além da tolerância | SRT/VTT e preview |
| Entrega/versionamento | Mídia, timeline, aprovação e manifesto referem-se à mesma versão | Approval herdada após mudança ou arquivo sem origem | Hashes, versões e registro de revisão |

| Critério estético | Adequado | Requer ajuste | Inadequado |
|---|---|---|---|
| Composição/luz | Foco e hierarquia claros, direção de arte coerente | Pequeno desequilíbrio que admite correção localizada | Foco errado ou incoerência que compromete a intenção |
| Expressividade | Postura/rosto compatíveis com assunto/personagem | Gesto repetitivo ou intensidade inadequada corrigível | Expressão contradiz assunto ou descaracteriza personagem |
| Naturalidade | Voz e movimento sustentam interpretação plausível | Artefato perceptível, sem descaracterização, corrigível | Artificialidade recorrente impede aceitar o vídeo |
| Ritmo | Pausas, duração e cortes sustentam argumento | Trecho lento/apressado passível de ajuste | Conjunto difícil de acompanhar ou cortes interrompem sentido |
| Integração | Avatar e apoio formam uma sequência audiovisual coerente | Diferença localizada de escala, luz ou tratamento | Ruptura recorrente de estilo/presença/voz |

Para cada avaliação preencher: `evaluation_id`, alvo/versão/hash, critério, descritor, trecho/fonte ou frame/timecode, explicação, correção proposta, autor, data e decisão. Uma suspeita automática e uma decisão humana são registros distintos. Job concluído não gera avaliação `adequado` automaticamente.

**Gate proposto:** todos os critérios obrigatórios aplicáveis adequados; critérios estéticos adequados segundo exemplos acordados; nenhum `não avaliado` ou ajuste aberto; custos/tentativas dentro dos limites; reprodução técnica revisada por B; vídeo integral assistido e versão aprovada pelo responsável. Critérios reprovados levam a correção ou recorte explícito do repertório, nunca a compensação por notas altas.

H07 requer comparar os alertas automáticos ao conjunto de falhas humanas: guardar falsos alertas e falhas omitidas. Não medir eficácia de detector inexistente nem interpretar ausência de alerta como prova de qualidade.

## Aplicação aos candidatos Higgsfield

Avaliar separadamente imagem D, animação E e montagem F. Referências ou alta resolução não dispensam identidade, ação e continuidade. Confrontar avatar e apoio em planos adjacentes; verificar que a voz oficial permaneceu única e que som gerado não acrescentou fala/alegação. Registrar aderência, falhas por classe, tentativas e custo por cena aprovada; custo por vídeo aprovado só com aprovação integral. Um modelo aprovado em um recorte não valida demais modelos/operações.
