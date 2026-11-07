# Conclusão do FBRVideos e fronteira com FlowRouter

Análise local de 28/10/2026. Repositórios examinados: `F:\Projetos\_FBR\FBRVideos` e `F:\Projetos\_FBR\FlowRouter`.

## Parecer

FBRVideos tem uma base técnica integrada e verificada em ensaio local, mas não está finalizado como produto audiovisual aceito. Além dos gates externos documentados, há uma divergência entre a experiência recorrente especificada e as aprovações intermediárias exigidas pelo código.

FlowRouter tem uma finalidade complementar: executar tarefas no Google Flow com sessões isoladas e continuidade entre contas. Há sobreposição relevante de infraestrutura de execução, mas não equivalência entre os produtos. Não há integração implementada entre eles nos caminhos examinados.

## Evidências de conclusão e pendências

- `docs/arquitetura/entrega-tasklist-2026-10-07.md` registra TL-01–TL-18 implementadas ou provisionadas, com jornada sintética integrada. O próprio documento preserva EX-01–EX-04.
- `docs/piloto/entrada-piloto.json` permanece `awaiting_inputs`; modelos, verificação de acesso e autorização de orçamento continuam sem preenchimento nos campos do piloto. Isso descreve a evidência registrada, não prova ausência de credenciais em qualquer outro ambiente.
- EX-01: artigo real, referências e voz/look autorizados para o piloto.
- EX-02: configuração e validação efetivas de conta, modelo, operação, custos e teto autorizado.
- EX-03: vídeo real avaliado quanto a fidelidade, identidade, voz, sincronismo, continuidade, legendas e custo; calibração humana do perfil.
- EX-04: ambiente definitivo e decisões operacionais, incluindo retenção.
- Os adapters reais Higgsfield/HeyGen e sua composição existem. Sua existência e seus testes offline não demonstram qualidade, acesso ou comportamento real da conta.
- A entrega técnica registra limite de 100 MB por entrada de ingestão/probe/render, apesar de leitura/streaming suportarem arquivos maiores. Deve constar dos limites da versão.

### Divergência funcional a resolver antes de encerrar o produto

`docs/projeto-base-sistema-v0.1.md:18` dispensa aprovações intermediárias A–E obrigatórias no cotidiano; a jornada recorrente em sua linha 45 vai de artigo/perfil a gerar, acompanhar e revisar o resultado.

Entretanto:

- `packages/infra/src/review-workflow.ts:160` (`beginGeneration`) exige aprovações humanas editoriais e de direção, sem exceção nesse método para produção recorrente.
- `packages/infra/src/production-pipeline.ts:146` libera dependências somente com outputs aprovados.
- O mesmo pipeline publica outputs como `candidate` na linha 179 e registra a decisão como avaliação humana em `evaluateCandidate`, na linha 246. A montagem também depende de áudio e visuais aprovados.

Esse caminho atende ensaio supervisionado/calibração, mas não demonstra a experiência recorrente automatizada prometida. Resolver implementando a política de operação recorrente de perfis calibrados, com critérios de avaliação e exceções explícitos, ou revisando formalmente o escopo. Não basta trocar automaticamente o rótulo para “aprovação humana”.

## Comparação de escopo

| Responsabilidade | FBRVideos | FlowRouter |
| --- | --- | --- |
| Entrada principal | Artigo + perfil/personagem | Manifesto com prompts, tarefas e referências |
| Roteiro, fontes e direção | Núcleo do produto | Recebe instruções já preparadas |
| Geração | Contratos de providers, candidatos Higgsfield/HeyGen | Automação do Google Flow por navegador |
| Identidade, voz e avatar | Parte da produção audiovisual | Sem responsabilidade editorial equivalente no PRD |
| Filas, tentativas, pausa e recuperação | Implementados no pipeline | Parte central do escopo de execução |
| Custos/capacidade | Orçamento da produção e cobrança por operação | Capacidade por conta, elegibilidade e troca de conta |
| Artefatos, hashes e proveniência | Sim | Sim, previstos no escopo e contratos |
| Montagem, legendas, correção e exportação final | Núcleo do produto | Montagem automática de filme final explicitamente excluída |
| Persistência | PostgreSQL, pg-boss, arquivos locais | SQLite e arquivos locais previstos |

A sobreposição é alta em mecanismos de execução: estados de tarefas, idempotência, resultados incertos, recuperação, dependências, coleta, proveniência, métricas e backup. A regra de elegibilidade entre contas e a operação do navegador são específicas do FlowRouter; a regra editorial e a montagem pertencem ao FBRVideos.

Não foi encontrada referência a FlowRouter/Google Flow em `apps`, `packages`, `docs` ou `.env.example` do FBRVideos na busca desta análise. Compartilhar conceitos não significa compartilhar contratos ou implementação: as interfaces `GenerationAdapter` do FBRVideos e `Adapter` do FlowRouter são diferentes.

## Fronteira recomendada

Manter FBRVideos como responsável pela produção: artigo, roteiro, identidade, perfil, orçamento global, avaliação audiovisual, montagem e aprovação final. Manter FlowRouter como executor especializado do Flow: sessões, contas, capacidade, envio, reconciliação e coleta.

Se a rota Google Flow for necessária e comprovada, integrar por um adapter do FBRVideos para a API local do FlowRouter. O FBRVideos envia tarefas já definidas; FlowRouter executa e retorna arquivos e proveniência; FBRVideos valida, incorpora os candidatos e monta o vídeo.

Definir antes dessa integração:

1. Chave idempotente e vínculo entre produção/plano e projeto/tarefa/tentativa remotos.
2. Mapeamento de capacidades, parâmetros, estados, incerteza e erros.
3. Responsabilidade única por reenvio: FlowRouter decide tentativas de envio ao Flow; o adapter não cria uma segunda política concorrente.
4. Pausa/cancelamento sem presumir interrupção remota e sem disparar reenvios.
5. Transferência de arquivos, hash, proveniência e revisão dos inputs.
6. Capacidade de assinatura separada de custo monetário observado; saldo desconhecido não vira custo zero.

Não há motivo demonstrado para fundir bancos, interfaces ou repositórios agora. Também não há evidência de que FlowRouter substitua voz/avatar ou elimine a necessidade dos outros fornecedores. Sua viabilidade real precisa ser comprovada antes de torná-lo dependência do FBRVideos.

## Verificação executada nesta análise

| Projeto | Comando | Resultado |
| --- | --- | --- |
| FBRVideos | `npm run verify` | Código 0; tipos e build aprovados; 164 testes, 162 aprovados, 2 omitidos por exigirem PostgreSQL nativo |
| FlowRouter | `npm run typecheck` | Passou no recorte observado |
| FlowRouter | `npm run test` | 3 testes de adapters aprovados |
| FlowRouter | `npm run build` | Falhou: ausente `apps/dashboard/vite.config.ts` |

O build FBRVideos emitiu avisos de bundle acima de 500 kB e diretiva `use client` de dependência; não impediram a compilação. Não foi executada nova rodada com PostgreSQL nativo, navegador, serviços reais ou consumo pago.

Log da verificação FBRVideos salvo no diretório temporário do usuário como `fbrvideos-audit-20261028.log`.

FlowRouter apresentou novos arquivos entre leituras desta análise, indicando mudanças concorrentes. Os resultados descrevem o recorte observado e devem ser revalidados após estabilização. Seu `BrowserAdapter` atualmente bloqueia preparação/envio real e não comprova autenticação/capacidade; o simulador gera SVGs identificados como simulação. A tasklist ainda declara nenhuma story implementada, embora já exista código parcial: não serve isoladamente como inventário atual.

## Critérios concretos de encerramento

1. Resolver a divergência da jornada recorrente e demonstrar o comportamento escolhido.
2. Concluir piloto com mídia real, fornecedores configurados e orçamento autorizado.
3. Registrar aceite audiovisual integral e perfil calibrado com evidências reais.
4. Confirmar ambiente e políticas de operação; validar instalação e recuperação no destino.
5. Se FlowRouter entrar na arquitetura, comprovar primeiro sua rota real e verificar o contrato integrado sem duplicar envios.

Conclusão de status: FBRVideos = entrega técnica local verificada, aceite de produto pendente. FlowRouter = implementação parcial em movimento, integração real não comprovada. Os produtos podem ser complementares se a fronteira entre direção audiovisual e execução no Flow permanecer explícita.
