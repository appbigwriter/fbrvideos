# Fronteira FBRVideos / FlowRouter

Data: 28/10/2026. Decisão de implementação para o fechamento atual: **FlowRouter é integração opcional futura e não é dependência desta versão do FBRVideos**. A decisão é reversível após prova da rota real e contrato estável, conforme FRV-01–FRV-03 da tasklist.

## Responsabilidades

| Responsável | Deve decidir/executar |
| --- | --- |
| FBRVideos | Artigo/fonte, autoria/Bible, narrativa, direção, receita e repertório, perfil validado, orçamento global, política de avaliação, correções, montagem, legendas, revisão e entrega final |
| FlowRouter | Sessões Google isoladas, observação de capacidade, conta elegível, envio ao Flow, reconciliação de tentativas, continuidade/afinidade entre contas e coleta dos arquivos remotos |

FBRVideos mantém PostgreSQL e contratos `GenerationAdapter`; FlowRouter mantém seu armazenamento e contrato de execução. Não há fusão de bancos, credenciais, perfis de navegador ou interfaces. Voz/avatar dos fornecedores atuais não são substituídos por suposição de equivalência com Google Flow.

## Razão

Os produtos compartilham conceitos de jobs, dependências, recuperação, orçamento/capacidade e proveniência. Esses conceitos não tornam os produtos equivalentes. O PRD do FlowRouter exclui montagem automática de um filme final; FBRVideos exige direção audiovisual e entrega integrada. Criar troca de contas Google no FBRVideos duplicaria a responsabilidade específica do executor.

O recorte observado em 28/10 mostrou um adapter de navegador que bloqueava geração real sem comprovação e um build incompleto. O outro projeto tinha mudanças concorrentes; esse diagnóstico não deve ser presumido permanente. A dependência só pode ser adotada após nova verificação, independentemente de o simulador passar.

## Contrato exigido se a integração for adotada

1. Adapter FBRVideos → API autenticada local FlowRouter, com versão de protocolo e capabilities efetivas.
2. Identidade persistente entre produção/plano/versão e projeto/tarefa/tentativa/conta remotos.
3. Chave idempotente antes do envio e reconciliação antes de qualquer retry incerto.
4. FlowRouter é o único responsável pelo reenvio ao Flow; o adapter não inicia uma segunda política concorrente.
5. Pausa impede novos envios e acompanha o que já foi aceito; cancelamento remoto somente quando comprovado pelo executor.
6. Input por revisão/hash e output por arquivo íntegro/hash/proveniência; FBRVideos faz sua própria ingestão e avaliação.
7. Capacidade da assinatura não é custo monetário confirmado. Custos desconhecidos permanecem desconhecidos.
8. Dependências não portáveis e indisponibilidade geram pendência; nenhuma troca silenciosa para outro fornecedor pago.
9. FBRVideos pode continuar usando seus adapters atuais sem FlowRouter, incluindo ensaio sintético explícito.

## Consequências

FRV-01–FRV-03 não são executadas nesta versão. A tasklist não autoriza modificar o FlowRouter nem declarar sua rota real viável. Não se implementa um adapter sem contrato estável só para marcar uma opção como concluída. Se uma versão posterior exigir Google Flow, reabrir a decisão e executar os aceites de integração sem duplicar a direção editorial.
