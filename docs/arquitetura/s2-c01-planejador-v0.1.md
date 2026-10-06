# S2-C01 — planejador automático extrativo inicial

Registro de 4 de outubro de 2026 · **Entrega extrativa inicial de S2-C01**.
Atualização em 5 de outubro: [GPT-6.1 Sol via OAuth integrado](s2-c01-oauth-v0.1.md),
incluindo reescrita/direção semânticas e auditoria. Os limites e resultados
extrativos abaixo são históricos. Gate S2 e avaliação editorial humana abertos.

`packages/pipeline/src/planner.ts` implementa `planProduction` e `AutomaticPlanner`.
Criação e retomada pela API executam o planejamento local automaticamente.
Na inicialização do servidor, produções preparando são recuperadas; pausadas,
canceladas e falhas não são retomadas automaticamente. Não há endpoint que aceite
um dossiê arbitrário. Dossiê, revisões e eventos persistem no PostgreSQL existente.

## Método e limites

Método versionado `extractive-0.1`, determinístico e sem chamadas externas.
Verifica contrato, hash do snapshot, artigo/Bible, vínculo exato da personagem,
cobertura/ordem dos trechos, receita e repertório. Atende pt-BR e receitas
explanation/recommendation_list/reflection com ilustração editorial estática.
Não infere gênero do artigo nem seleciona uma receita diferente da fixada no perfil.

Preserva os trechos literalmente; acrescenta somente um convite em primeira
pessoa sem experiência ou afirmação factual nova. Distribui trechos por papéis
da receita, sem prometer completude semântica de todas as seções quando a fonte
é curta. Um plano estático por bloco especifica composição, movimento nulo,
continuidade, critérios, riscos e fallback na mesma rota. A descrição temática
continua dependente de revisão semântica antes de gerar imagens.

Não reescreve automaticamente o artigo como narrativa integral em primeira
pessoa. Não interpreta Bible para inventar ações ou ambientes; verifica e fixa
seu original. Não resolve citações ou autoria de experiências por regex. Relato
pessoal, tutorial experimental, ambiente específico e recorte editorial livre
falham com diagnóstico, em vez de receber saída genérica apresentada como solução.
Itens a evitar são restrições da direção; não há garantia automática de verificação
semântica desses itens. Revisão editorial permanece obrigatória mesmo com
`review_script=false`. Limites: 30.000 caracteres e 200 trechos; não há truncamento.

Duração-alvo de cada plano é uma proposta a 150 palavras/minuto, mínimo 1 s.
Diferença superior a 25% do alvo gera pendência; não inventa fala para preencher
tempo. Duração resolvida permanece nula até existir áudio real.

## Persistência e concorrência

Uma tentativa determinística por revisão ativa; corrigir entrada exige novas
revisões e nova produção. Retomar falha é uma ação explícita, sem loop de retries.
Comandos internos têm chaves estáveis por produção/revisão e resultados atômicos.
Deduplicação local evita execução simultânea no mesmo processo; CAS e replay no
banco protegem múltiplas instâncias e interrupções. Pausa/cancelamento não podem
ser sobrescritos por uma conclusão em revisão antiga.

Planejamento síncrono na API é adequado apenas ao extrator local limitado.
Não é fila de jobs de provedores. Migração para planejamento LLM requer um worker
com timeout, limites de tentativas/custo e avaliação editorial, antes de tráfego externo.
Falha de banco continua sendo erro técnico; estado persistido permite recuperação.

## Aceite ainda aberto

| Item original | Estado deste incremento |
|---|---|
| Dossiê automático com fontes e versões exatas | Implementado para o subconjunto extrativo |
| Planos com composição/continuidade/riscos/fallback dentro do repertório | Implementado para ilustração estática; revisão semântica pendente |
| Reescrita narrativa integral em primeira pessoa e seleção semântica de direção | Não implementado; requer planejador semântico configurado e avaliado |
| Experiências pessoais/citações | Bloqueadas ou conservadas literalmente com revisão obrigatória; sem aprovação automática |
| Corpus adversarial e verificações de invariantes | Testes automatizados sintéticos |
| Avaliação humana de artigos representativos e Bible real | Pendente; nenhum aceite humano fabricado |

AG-05/06 estão liberados **para apresentação**, independentemente do gate
audiovisual: [AG-05](../ux/ag-05-handoff-v0.1.md),
[AG-06](../ux/ag-06-handoff-v0.1.md). Contratos e fixtures já estão publicados.
O root mantém API, comandos, conversões, planejamento e integração das páginas.

## Rubrica de avaliação humana pendente

Usar artigo real aprovado para piloto e exemplos de explicação, lista, reflexão,
relato com citação de terceiros e instruções hostis embutidas. Verificar: nenhuma
experiência atribuída indevidamente; fatos e opinião preservados; fontes exatas;
convite/narração naturais; direção coerente com Bible; nenhuma ação fora do
repertório; omissões explícitas; duração viável. Registrar resultado por critério,
trecho/versão, falha e correção. Rejeitar se houver experiência inventada, fonte
incorreta ou direção inviável, mesmo que schema/testes passem.

## Evidências técnicas

- `npm run verify`: 18 contratos +21 infra +14 pipeline +2 web = 55 testes;
  typecheck e build aprovados. A suíte de infra também passou no PostgreSQL
  18.4 nativo com pg/Pool; fallback usa PGlite para execução sem banco configurado.
- Recuperação de planejamento interrompido, replay e dois coordenadores
  simultâneos verificados. Pausa entre início e conclusão impede gravação tardia.
- HTTP real confirmou snapshot/hash, versões exatas, Bible e cinco eventos da
  produção sintética anterior, agora v5 awaiting_decision.
- Navegador confirmou fontes e direção expandidas; [evidência](../ux/evidencias/s2-c01-dossie-extrativo.jpg).
- Nenhuma mídia/provedor/gasto ou avaliação humana foi produzido por estes testes.
