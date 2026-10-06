# Jornada e telas — UX 0.1

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Base: projeto-base-sistema-v0.1, especificacao-producao-audiovisual-v0.1, sprints-implementacao-3-agentes-v0.1 e fila-execucao-sol-antigravity-v0.1. Escopo: S0-A01, protótipo e contrato visual para AG-01.

## Decisões de experiência

1. O CTA recorrente é “Criar vídeo de um artigo”. Artigo e perfil são as escolhas necessárias; direção e cenas são geradas internamente.
2. As revisões intermediárias A–E são opcionais na operação recorrente, seguindo a precedência do projeto base. No piloto/calibração são supervisionadas e identificadas. Conclusão técnica nunca aparece como aprovação humana.
3. Avançado e inspeção ficam recolhidos. Uma pendência objetiva pode abrir seu trecho sem exigir dirigir o vídeo inteiro.
4. Custos têm três naturezas visíveis. Um valor desconhecido aparece como “Não disponível”, sem assumir zero. O teto é limite, não preço garantido; a margem vem do domínio.
5. A revisão se refere à renderização e à versão exibidas. A declaração de revisão integral é explícita; o player não fornece prova de julgamento.
6. Correção visual preserva fala/áudio válidos somente conforme plano de impacto recebido. Mudança de fala mostra áudio, lip sync, legendas e tempos afetados, exige fidelidade à fonte e nova revisão.
7. Preview não aparece como entrega aprovada. Alteração da versão ativa não herda a aprovação anterior; histórico preserva essa decisão na versão antiga.
8. Pausa interrompe novos agendamentos. Jobs externos iniciados podem continuar; cancelamento informa o destino desses jobs e os custos já incorridos.

## Navegação e hierarquia

Menu: Início · Artigos · Produções · Perfis de produção · Universo · Configurações. Assets permanecem no Universo e na produção; sem Biblioteca independente no MVP. Indicar seção ativa por texto/posição além de cor.

```text
Início → Artigos → Detalhe do artigo → Criar produção
                                      ↓ artigo + perfil + limites
                                Acompanhamento
                                  ↓ versão renderizada
                                    Revisão
                                ↙ correção   ↘ aprovação da versão
                      Proposta → nova versão     Entrega → exportação
```

Rótulos de rotas no protótipo são hashes locais; a base de B define as rotas da aplicação. A tabela de rotas acordadas fica no handoff AG-01.

Layout: barra lateral no desktop; menu que quebra em linhas em telas estreitas; cabeçalho com título e contexto; conteúdo com uma ação principal e ações secundárias. Faixa persistente do protótipo declara simulação. Alertas ficam próximos da ação impedida. Ordem de foco acompanha a leitura. Botões nativos, labels associados, foco visível e área de status viva fornecem a base de teclado; validação de acessibilidade assistiva será feita na aplicação integrada.

## Telas principais

| Tela | Hierarquia e dados | Ação principal | Estados e próxima ação |
|---|---|---|---|
| T01 Início | Pendências, revisão, trabalhos e consumo do período | Criar vídeo de um artigo | Sem configuração: passos de blog/Bible/voz/perfil/calibração; vazio: ir a Artigos; falha: abrir produção |
| T02 Artigos | Título, autoria, revisão, personagem e situação; produções vinculadas independentes da elegibilidade | Abrir artigo ou criar vídeo | Vazio: importar URL/texto; carregando: texto; indisponível: tentar consulta; incompleto: corrigir extração; autoria pendente: associar |
| T03 Artigo | Origem, revisão, texto limpo, imagens/direitos quando disponíveis e produções | Criar vídeo | Fonte incompleta bloqueia gerar; corrigir cria revisão nova. Origem alterada não altera snapshot de produção existente |
| T04 Criar produção | Artigo/revisão, perfil/revisão, nome sugerido; personagem, idioma, formato, duração; consumo e teto | Gerar vídeo | Impedimentos recebidos ao lado do CTA; perfil não validado: só calibração; incerteza: mostrar teto e indisponibilidade de estimativa |
| T05 Acompanhamento | Etapa, estado público, custos, pendências, versões e preview disponível | Abrir revisão quando pronta | Falha: causa/efeito/ação; custo: parar novos gastos e ver opções; pausada/cancelada: explicar jobs externos; sem ETA inventada |
| T06 Revisão | Versão renderizada, player/timecode, transcrição e cenas; apontamentos e referências recolhidas | Aprovar esta versão | Apontamento: categoria + trecho + comentário; plano de correção antes do gasto; declaração integral; pendência obrigatória bloqueia aprovação |
| T07 Entrega | Versão aprovada, formato, custo, aprovação e arquivos | Baixar vídeo/legendas | Arquivo ausente ou aprovação divergente bloqueia export aprovado; histórico e preview continuam explicitamente identificados |
| T08 Perfis | Nome, personagem, formato, revisão e escopo de validação | Criar/duplicar/testar | Rascunho, em calibração, validado, suspenso; validação não promete adequação universal |
| T09 Universo | Abas de personagem, ambientes, figurinos/objetos, estilos e voz | Importar/cadastrar conforme tipo | Bible original separado da interpretação; referência pendente não recebe aprovação fictícia |
| T10 Configurações | Fontes/autoria, fornecedores, armazenamento, limites e exportação | Configurar item | Conexão técnica não prova qualidade; credenciais protegidas; sem ações de integrações ainda inexistentes |

Opções avançadas de T04: recorte editorial, duração, preferência de ambiente, elementos a evitar e revisão prévia do roteiro. Sobrescritas pertencem à produção. Não há formulário obrigatório de enquadramento, câmera, pose ou ação de cena.

## Estados públicos e mensagens

Os códigos finais pertencem aos contratos de B. A UX não deduz estado público pelo estado isolado de um job.

| Estado público | Mensagem e ação típica |
|---|---|
| Em preparação | “Organizando fonte e perfil.” Inspeção opcional; nada está aprovado por conclusão técnica |
| Em produção | Etapa nominal, consumo e pausa de novos jobs; sem percentual global |
| Aguardando decisão | Pendência com causa, impacto, alternativas e ação requerida |
| Pausada | “Novos jobs pausados. Trabalhos já enviados podem continuar.” Retomar se autorizado |
| Falhou | Falha conhecida, trecho afetado e diagnóstico legível; tentar conforme política recebida |
| Pronta para revisão | Versão renderizada e ação Abrir revisão |
| Em correção | Versão alvo, plano aceito, dependências afetadas e consumo; revisão anterior preservada |
| Aprovada | Versão aprovada, data e responsável; abrir entrega |
| Exportada | Versão e pacote disponibilizado; não significa publicado em rede externa |
| Cancelada | Novos jobs cancelados; arquivos/custos preservados; status de externos ainda visível |

Timeout com resultado desconhecido: “Ainda não sabemos se o fornecedor concluiu. Consultar execução antes de repetir.” O domínio fornece ações disponíveis; não oferecer nova geração paga indiscriminada.

## Exemplos de exceção

- Fonte incompleta: “O corpo do artigo está incompleto. Corrija a captura antes de gerar.” Ação: corrigir extração ou colar texto, preservando a revisão antiga.
- Falha conhecida: “A montagem falhou; os componentes válidos foram preservados.” Ação recebida: tentar montagem; não refazer automaticamente os componentes.
- Custo esgotado: “Nenhum novo job pago será iniciado. O limite não permite a próxima etapa.” Ações possíveis: abrir política de limites, escolher alternativa aprovada, cancelar; retomar depende de nova autorização do domínio, não do clique no cartão.
- Correção: apresentar versão/trecho, elementos afetados/preservados e custo adicional com incerteza. “Executar correção” exige plano válido e margem confirmada; alterações exigem nova versão e revisão.

## Critérios de produto a validar

O responsável consegue iniciar com artigo/perfil sem fichas de cena, localizar a causa de impedimento e entender a próxima ação? Distingue custo confirmado de estimado? Entende que a versão nova precisa de revisão? Reconhece simulação e mídia inexistente no protótipo? Esses pontos exigem avaliação do responsável; o desenho não registra uma aprovação que ainda não ocorreu.

## Integração candidata e comportamento de apresentação

T04 continua artigo + perfil; não adotar seletor obrigatório de modelo/prompt do Studio. T08 mostra escopo calibrado, sem confundir catálogo técnico com habilitação recorrente. T10 distingue chave salva, acesso testado e qualidade validada; chave completa fica em campo de senha e chamadas autenticadas permanecem no servidor quando esse fluxo for implementado.

Em T05, Higgsfield só cancela pedidos queued; pedidos in_progress continuam acompanhados após pausa/cancelamento local. Estimativa da API não é custo confirmado. Em T06/T07, a mídia pertence à cópia persistida no FBR; a URL temporária do fornecedor não é entrega durável. Conexão e geração continuam indisponíveis no shell/protótipo.
