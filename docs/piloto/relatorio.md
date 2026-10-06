# Relatório de preparação S0-C01

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Data: 4 de outubro de 2026. Frente C. **Resultado: protocolo e instrumentos entregues; spike audiovisual real não executado; gate pendente por insumos.** S0-C01 não está concluída. A fundação/AG-01 pode avançar com contratos/fixtures sem receber validação audiovisual fictícia.

## Evidência obtida

Foram lidos os quatro documentos base v0.1 e o material Game Style fornecido pelo responsável. A entrada foi corrigida para [04-game-style-tara-lindqvist.md](../fontes/04-game-style-tara-lindqvist.md), Projeto + Character Bible completo da Tara. O hash da cópia local foi conferido: `d6165f63903b78f08b911411b5253569b4519c559b45c658fa08bc1c3ab1193c`. A ressalva interna de reconciliação permanece como proveniência, sem nova pendência de aprovação. O documento define blog/persona, tom, inglês EUA/global e guardrails; não contém artigo para adaptação, referência visual ou avatar pronto. `contexto-gamestyle.md` registra sua aplicação.

O Bible já está disponível; ainda não foram recebidos artigo, referência visual e mídia real de ensaio. A verificação de acesso observou somente ausência dos arquivos de ambiente comuns e da variável HeyGen no processo; não inspecionou segredos, contas externas ou credenciais em outro ambiente. Nenhuma consulta autenticada, upload ou chamada de geração foi feita.

A documentação primária atual do HeyGen foi consultada para `capacidades.md`. Há uma rota documentada para alimentar avatar com áudio aprovado e rotas distintas de síntese, conforme tipo da voz. Isso identifica um **candidato a testar**, não uma integração viável já demonstrada. A conta, compatibilidade, identidade, continuidade vocal e lip sync seguem desconhecidos no caso FBR.

## Verificações realizadas

| Verificação | Resultado observado | Limite da conclusão |
|---|---|---|
| Inventário por arquivos e presença de insumos | Projeto + Bible recebidos; artigo/ref/mídia não recebidos | Não verifica arquivos fora dos caminhos fornecidos ou fonte remota |
| Leitura dos documentos | Escopo, gates, fidelidade e revisão A–F incorporados | Não constitui aceite editorial do ensaio |
| `ffmpeg -version` | Sucesso; versão 9.0 | Não demonstra render, loudness, suporte de qualquer mídia real |
| `ffprobe -version` | Sucesso; versão 9.0 | Não demonstra integridade de arquivo ausente |
| `pwsh -NoProfile -File .\docs\piloto\preflight.ps1` | Processo retornou código `2`; sete pendências mínimas após registrar o Bible | Falha esperada por falta de entradas; não é bug nem piloto reprovado |
| Consulta das fontes HeyGen | Documentação atual acessível nos links da matriz | Recurso documentado não é acesso da conta nem resultado testado |
| Parse JSON e links Markdown locais do pacote | Sucesso | Verifica sintaxe/referências locais, não veracidade dos inputs |
| Revisão de `packages/contracts/src/ports.ts` e `schemas.ts` | Áudio separado e rotas visuais compatíveis com o protocolo | Inspeção documental; sem executar adapter real |

As sete pendências da ficha são artigo, referência da personagem, registro de acesso verificado, ID de voz disponível, moeda, referência ao teto autorizado e valor desse teto. O Bible deixou de ser pendência. Defaults técnicos da equipe e referências opcionais não são bloqueios obrigatórios impostos ao usuário. Valores candidatos exigem calibração antes de virar perfil validado.

## Testes audiovisuais não executados

| Teste | Estado | Entrada que falta | Evidência exigida para fechar |
|---|---|---|---|
| Fidelidade do roteiro/primeira pessoa | Não executado | Artigo real; Bible recebido | Falas/fonte + avaliação A/B |
| Identidade e ambiente | Não executado | Referência visual + rota permitida; Bible recebido | Imagens e avaliações D com comparação |
| Uma classe de movimento | Não executado | Imagem aprovada, acesso/teto | Clipe real, parâmetros, avaliação E e custo |
| Voz em off | Não executado | Voz disponível/acesso/teto | Áudio real, pronúncias, transcrição e aprovação |
| Áudio aprovado no avatar | Não executado | Áudio, imagem/look e acesso/teto | Job, clipe, offsets e lip sync |
| Transição avatar → apoio → avatar | Não executado | Assets reais aprovados | Trecho montado e escuta/revisão comparativa |
| Vídeo integral/legendas/exportação | Não executado | Assets, timeline e calibração | Preview/pacote íntegros e avaliação F |
| Custos/retrabalho/tempo humano | Não medidos | Execução autorizada real | Livro de tentativas/custos e tempos separados |
| Retomada/idempotência/correção | Não executado | Adapter e jobs reais | Histórico de recuperação e preservação das versões |

Não foram produzidos áudio, imagem, clipe, vídeo, legenda ou manifesto de produção real. Não há job externo, custo medido por vídeo ou aprovação humana. Não foram iniciadas despesas por este trabalho; o saldo/custo de contas externas não foi consultado. H01–H07 permanecem sem validação experimental.

## Próxima execução concreta

A revisão dos contratos confirmou `operation: audio` com `route: null`, rotas próprias para avatar/animação, assets/versionrefs e intervalos source-in/out na timeline. Não foi identificado bloqueio estrutural para preparar S0. Capacidades por endpoint/voz/look/engine precisam ser concretizadas em `supported_fields`/`evidence_refs` nos adapters futuros. Checagens de faixa vocal duplicada e alinhamento devem integrar o executor e a revisão real; schemas básicos não provam sincronização. Isso pertence às integrações/montagem posteriores e não foi implementado neste pacote.

Receber os mínimos externos, propor a receita a partir do artigo, confirmar a voz/look disponível e o teto autorizado. C executa o protocolo supervisionado e entrega o trecho, depois a montagem integral, com rubrica/timecodes e custos. B revisa integração; o responsável humano decide qualidade e escopo. Só então atualizar capabilities para testadas e deliberar sobre S0/S3. A eventual substituição de animação por imagem deve aparecer como limite do repertório, não como aprovação da classe de movimento.

## Formato de registro do ensaio futuro

Registrar para cada tentativa: ID/versão, entrada/hash, plano/fala, fornecedor/endpoint/modelo/engine, parâmetros, job, início/fim UTC, estado técnico, custo estimado/comprometido/confirmado com moeda, arquivo/hash, avaliação e responsável. Para o resultado integral, registrar duração, formato efetivo, offset de áudio, limites de mixagem medidos, legendas, dependências, revisão integral, versão/hash aprovado e limitações. Sem denominador real, métricas de aprovação e custo por aprovado ficam `não calculáveis`.

## Revisão documental Higgsfield — sem novo ensaio

O responsável aceitou incluir Higgsfield como candidata a imagens e cenas de apoio, preservando voz/avatar separados e a stack FBR. Foram incorporadas evidências públicas de catálogo, schemas exemplares, idempotência, estimativa, ciclo/cancelamento, upload, webhook e retenção na matriz e decisão de arquitetura. Nenhum modelo final foi selecionado.

Esta revisão não adiciona mídia, consulta autenticada, IDs de geração, custos medidos ou aprovação audiovisual. A ausência de insumos e os resultados históricos acima permanecem válidos. G0 deverá verificar acesso às duas famílias de rotas; G2/G3 deverão avaliar imagens/clipes candidatos Higgsfield integrados à voz oficial e avatar candidato HeyGen. S0-C01 e H01–H07 continuam pendentes.
