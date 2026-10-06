# Especificação de produção audiovisual — v0.1

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Data: 4 de outubro de 2026. Estado: especificação conceitual, ainda não validada em produção.

## 1. Objetivo e limites

Transformar artigos de blog em vídeos narrados em primeira pessoa pela influencer virtual autora, preservando conteúdo, identidade, direção de arte e continuidade audiovisual. Os Character Bibles existentes são fontes de autoridade e devem ser integrados, não recriados automaticamente.

Esta versão especifica o método e os contratos do futuro app. Não escolhe definitivamente fornecedores, não certifica qualidade de geração e não fixa custos ou limites técnicos sem testes. Publicação automática fica fora do piloto; sua política será configurada separadamente.

O principal artefato é o Dossiê de Produção. O plano é a unidade de execução; o vídeo é a unidade de entrega. Prompts são derivados das especificações aprovadas.

## 2. Classificação das decisões

| Classe | Significado | Exemplos |
|---|---|---|
| Regra estrutural (R) | Obrigação do sistema | Rastrear falas, preservar versões e bloquear assets reprovados |
| Parâmetro configurável (P) | Escolha editorial ou operacional | Formato, ambiente, ritmo e orçamento |
| Hipótese (H) | Escolha provisória que exige experimento | Complexidade animável, referências necessárias e continuidade de voz |

Uma hipótese só vira padrão operacional após evidência registrada. Alterações estruturais exigem nova versão da especificação. Parâmetros são registrados por produção; não podem mudar silenciosamente.

## 3. Princípios obrigatórios

- R01: nenhuma experiência pessoal pode ser inventada a partir de uma afirmação genérica do artigo.
- R02: toda afirmação verificável da fala possui fonte identificada no artigo ou em material editorial aprovado.
- R03: transições, convites e opiniões editoriais são identificados e revisáveis.
- R04: personagem, ambiente, figurino e estilo são referências versionadas.
- R05: geração visual começa somente com intenção, ação, composição e referências definidas.
- R06: imagem aprovada é condição para animação derivada dela.
- R07: uma falha obrigatória não pode ser compensada por uma boa nota estética.
- R08: cada asset registra origem, especificação, referências, configuração e avaliação.
- R09: aprovação se aplica a uma versão específica; mudanças relevantes invalidam aprovações dependentes.
- R10: retomadas não duplicam uma geração concluída e válida.
- R11: imagens ilustrativas não são descritas como registros reais de locais, produtos ou acontecimentos.
- R12: dados ausentes essenciais geram pendência; o sistema não os completa como se fossem fatos.

## 4. Níveis de configuração

### 4.1 Universo

Character Bible, referências aprovadas, voz, ambientes, figurinos, objetos recorrentes, estilo visual e regras de narração. Um perfil audiovisual complementar pode referenciar o Bible, mas não contradizê-lo. Conflitos entre fontes exigem resolução editorial registrada.

Cada ambiente contém identidade, imagens, mapa espacial quando necessário, posições dos objetos fixos, ângulos disponíveis, fontes de luz e variações permitidas. Sem geometria validada, não presumir continuidade espacial entre vistas geradas.

### 4.2 Produção

Artigo e sua revisão; personagem; objetivo; público; mensagem; formato; idioma; duração-alvo; situação narrativa; ambientes; figurinos; arco visual; modalidade de voz; parâmetros de montagem; teto de custo; política de revisão e entrega.

### 4.3 Plano

Intenção; fala associada; rota de produção; referências; ação; estados inicial e final; enquadramento; câmera; composição; luz; objetos; continuidade; duração; restrições; critérios de aprovação e alternativa.

## 5. Modelo de dados

Todos os registros versionáveis possuem `id`, `version`, `created_at`, `author`, `status` e histórico de alterações. Datas operacionais usam UTC, apresentadas no fuso configurado. Referências apontam para versões imutáveis.

| Entidade | Campos específicos mínimos |
|---|---|
| Personagem | Bible, referências visuais, perfil narrativo, voz, variações autorizadas |
| Ambiente | Referências, mapa espacial, ângulos, objetos fixos, luz, variações |
| Figurino/Objeto | Identidade visual, referências, regras de uso |
| EstiloVisual | Paleta, composição, luz, textura, movimento e exemplos |
| Artigo | Origem, data de captura, conteúdo, hash, trechos com IDs e revisão |
| Produção | Briefing, configurações, dependências fixadas, orçamento e estado |
| BlocoNarrativo | Intenção, falas, fontes, modo em câmera/em off e sequência |
| Plano | Contrato visual completo, dependências e alternativa |
| Asset | Tipo, arquivo, hash, dimensões/duração, origem, execução e direitos de uso registrados |
| Execução | Etapa, provedor, modelo, parâmetros, job externo, tentativas, custos e erro |
| Avaliação | Alvo e versão, critérios, resultado, evidências, autor e ação corretiva |
| Timeline | Segmentos de áudio, planos, legendas, trilha, transições e versão |

O Dossiê agrega essas entidades e fornece um manifesto exportável. Arquivos grandes ficam em armazenamento de assets; o manifesto contém suas referências.

## 6. Contratos do pipeline

| Etapa | Entrada | Saída | Condição de avanço |
|---|---|---|---|
| 01 Ingestão | URL, arquivo ou texto | Artigo revisável e trechos identificados | Conteúdo completo; origem registrada |
| 02 Briefing | Artigo + universo | Mensagem, abordagem, situação e arco visual | Aprovação editorial A |
| 03 Roteiro audiovisual | Briefing aprovado | Blocos, falas, fontes e funções visuais | Aprovação editorial B |
| 04 Planejamento | Roteiro + catálogo | Planos, estados, referências e dependências | Campos obrigatórios completos |
| 05 Storyboard | Planos + universo | Composições e sequência visual | Aprovação de direção C |
| 06 Áudio | Falas aprovadas + voz | Segmentos, pronúncia e tempos efetivos | Aprovação vocal; texto completo |
| 07 Imagens | Planos + storyboard | Imagens candidatas e selecionadas | Aprovação visual D |
| 08 Avatar/animação | Áudio, imagens e contratos | Clipes avaliados | Aprovação de movimento E |
| 09 Montagem | Assets aprovados + tempos | Timeline, legendas e vídeo | Revisão integral F |
| 10 Entrega | Vídeo aprovado | Pacote e relatório | Integridade dos arquivos e autorização aplicável |

Áudio e imagens podem ser produzidos independentemente após suas entradas aprovadas. A duração efetiva do áudio deve estar disponível antes de fixar a montagem e os pedidos de clipes que dependem dela.

O piloto usa revisão humana em A–F. Etapas automáticas posteriores exigem política explícita e evidência de desempenho. O app não deve confundir conclusão técnica de um job com aprovação editorial.

## 7. Método de direção narrativa

1. Identificar tese, fatos, recomendações e experiências presentes no artigo.
2. Selecionar o recorte adequado à duração; registrar omissões relevantes.
3. Definir por que a personagem conta esse assunto naquele contexto.
4. Escolher situação, ambientes e arco visual dentro do universo aprovado.
5. Escrever fala natural em primeira pessoa, sem acrescentar biografia.
6. Associar a cada bloco uma função visual: apresentar, demonstrar, contextualizar, comparar, refletir ou concluir.
7. Traduzir funções em ações observáveis e planos executáveis.

Falas são classificadas como `afirmacao_factual`, `experiencia_pessoal`, `opiniao_editorial` ou `transicao_convite`. Afirmações e experiências exigem fonte; opiniões devem ser compatíveis com a personagem e não disfarçar alegações factuais. Trechos impossíveis de sustentar são reformulados ou removidos.

## 8. Contrato de plano

Campos obrigatórios:

- Identificador, bloco e intenção narrativa.
- Segmentos de fala, função da imagem e rota de produção.
- Referências versionadas de personagem, ambiente, figurino, objetos e estilo, quando aplicáveis.
- Elementos essenciais; ação observável; estados inicial e final.
- Enquadramento, câmera, posição dos elementos, luz e áreas reservadas para legendas.
- Continuidade de entrada e saída; dependências espaciais e temporais.
- Duração-alvo provisória e duração ajustada ao áudio.
- Movimento da câmera e dos sujeitos; elementos que devem permanecer fixos.
- Restrições, riscos, critérios obrigatórios e alternativa.

Uma intenção abstrata como “transmitir paz” não basta: precisa virar postura, gesto, luz e composição. Um plano inicial deve ter uma ação principal; ações compostas são decompostas ou classificadas como experimento.

### Exemplo estrutural fictício

```json
{
  "id": "P03",
  "version": 1,
  "block_id": "B02",
  "intent": "Ilustrar uma pausa nas notificacoes",
  "route": "animated_scene",
  "speech_segment_ids": ["A02"],
  "references": {
    "character": "personagem_01:v3",
    "environment": "cozinha_01:v2",
    "wardrobe": "look_02:v1",
    "prop": "celular_01:v1",
    "style": "estilo_01:v1",
    "composition": "storyboard_P03:v1"
  },
  "visual": {
    "framing": "detalhe",
    "required_elements": ["mao", "celular", "mesa"],
    "initial_state": "celular com tela para cima",
    "action": "virar o celular",
    "final_state": "celular com tela para baixo",
    "camera_motion": "fixa",
    "lighting": "perfil_manha_difusa:v1"
  },
  "duration": {"target_seconds": null, "resolved_seconds": null},
  "constraints": ["preservar formato do celular", "nao adicionar objetos"],
  "continuity_in": ["mesa e figurino iguais ao plano anterior"],
  "continuity_out": ["celular permanece virado"],
  "risk": "contato entre mao e objeto",
  "fallback": "plano alternativo com celular ja virado",
  "status": "draft"
}
```

Este exemplo descreve a estrutura, não uma cena já validada. Valores nulos essenciais impedem envio à execução correspondente.

## 9. Catálogo inicial de planos

| Classe | Uso | Requisitos adicionais | Alternativa |
|---|---|---|---|
| Avatar em câmera | Abertura, comentário, encerramento | Look, fundo, voz e enquadramento testados | Reformular para trecho em off com imagem aprovada |
| Personagem com movimento simples | Presença e gesto | Pose inicial clara e um movimento principal | Imagem com movimento de montagem |
| Detalhe sem manipulação | Objetos e texturas | Objeto aprovado e composição legível | Imagem estática |
| Ambiente sem personagem | Contextualização | Ângulo e luz aprovados | Movimento suave sobre imagem |
| Ilustração editorial | Explicação e metáfora | Relação explícita com a fala | Outra composição aprovada |
| Interação simples | Demonstração | Estados e contato especificados | Estado final sem mostrar a interação |

As classes são hipóteses de viabilidade, não garantias. Ações complexas, locomoção longa, reflexos, múltiplas pessoas e mudanças amplas de câmera ficam na faixa experimental até validação. Alternativas que alteram a função narrativa exigem revisão do roteiro/direção.

## 10. Storyboard e geração de imagens

O storyboard resolve posição, escala, ângulo e continuidade antes do acabamento. Pode usar desenho, blocos ou montagem de referências. Deve respeitar o formato final e as áreas de legenda.

A geração recebe um pacote composto por ficha, referências, composição, restrições e critérios. O adaptador do provedor registra quais informações foram efetivamente enviadas e quais não são suportadas. Capacidades ausentes geram uma adaptação revisável ou bloqueio; não são ignoradas silenciosamente.

A imagem é avaliada em identidade, ambiente, elementos, composição, luz, continuidade e adequação ao movimento. Nenhuma técnica de referência garante sozinha consistência. A escolha de modelo, quantidade de referências e eventual treinamento depende dos experimentos.

## 11. Voz, avatar e sincronização

Há uma identidade vocal oficial por personagem, com idioma, sotaque, ritmo, pronúncia e exemplos aprovados. A forma de gerar a voz é uma hipótese técnica a validar.

Caminho preferencial: gerar áudio aprovado e utilizá-lo tanto na montagem quanto no avatar, se a integração suportar e produzir resultado satisfatório. Caminho alternativo: obter segmentos de áudio pelo fornecedor de avatar e validar sua continuidade com a narração em off. Não presumir compatibilidade nem equivalência vocal entre fornecedores.

O áudio é segmentado em unidades semânticas, preservando contexto de interpretação. Os tempos efetivos e alinhamento de palavras orientam timeline e legendas. Evitar ajustar a fala artificialmente para corrigir um planejamento visual inadequado sem revisão.

Cada segmento tem modo `on_camera`, `voice_over` ou `pause`. Clipes podem ter margens de edição configuráveis. Na montagem, o áudio oficial tem precedência; áudio duplicado dos clipes é removido ou explicitamente utilizado. Pausas, respiração, trilha e ambiente são mixados segundo um perfil aprovado.

Mudança de texto invalida áudio, sincronização labial e legendas dependentes. Mudança de duração invalida o ajuste temporal dos planos relacionados. Mudança somente visual não invalida automaticamente a fala.

## 12. Continuidade

Manter um registro por sequência: posição dos sujeitos, direção do olhar, estado e localização de objetos, figurino, luz, horário narrativo, eixo de câmera e progressão temporal.

Cada plano declara o que herda e o que modifica. Cortes com mudança intencional de espaço ou tempo são identificados. Planos adjacentes com continuidade direta são avaliados em conjunto. Dependências podem incluir o frame final anterior, mas seu uso precisa ser testado para evitar acumular erros.

## 13. Estados, versões e recuperação

Plano: `draft → specified → storyboard_approved → image_approved → clip_approved → assembled`.

Rotas sem imagem ou sem clipe usam requisitos próprios; não criam aprovações fictícias para etapas que não se aplicam. Avatar exige aprovação de configuração e de áudio antes do clipe.

Execução: `queued`, `running`, `succeeded`, `failed`, `cancelled` ou `unknown`. Um timeout de comunicação não prova falha da geração externa: consultar o job antes de repetir. Avaliação: `approved`, `rejected` ou `needs_review`.

Arquivos e aprovações anteriores permanecem no histórico. Uma revisão substitui a versão ativa e marca seus descendentes afetados como desatualizados. Uma chave de execução derivada de entradas, versões e configurações evita duplicação em retomadas; regeneração intencional usa nova tentativa identificada.

| Falha | Etapa de correção |
|---|---|
| Intenção visual ambígua | Briefing, roteiro ou planejamento |
| Enquadramento inadequado | Storyboard |
| Rosto, roupa ou ambiente incorretos | Referências ou geração da imagem |
| Deformação no movimento | Animação, simplificação ou alternativa |
| Descontinuidade entre planos | Planejamento e planos afetados |
| Voz ou pronúncia inadequada | Configuração vocal ou áudio |
| Fala não sustentada | Roteiro |
| Duração insuficiente | Planejamento temporal ou montagem |

Limites de tentativas e custos são parâmetros obrigatórios antes de executar jobs pagos. Ao atingir o limite, parar a etapa, registrar motivo e apresentar alternativa/intervenção. Falhas técnicas transitórias têm política de repetição própria; falhas de direção não recebem repetição cega.

## 14. Critérios de avaliação

### Obrigatórios

Fidelidade das afirmações; identidade; elementos e ação essenciais; ambiente; figurino; continuidade; ausência de deformações relevantes; integridade do áudio; sincronização labial quando aplicável; correspondência fala/imagem; legibilidade das legendas e ausência de arquivos ausentes.

### Estéticos

Composição, luz, expressividade, naturalidade, ritmo, integração entre avatar e cenas e adequação à direção de arte. Usar descritores `adequado`, `requer ajuste` e `inadequado`, acompanhados de evidência. Limites técnicos mensuráveis de áudio e exportação são definidos no perfil de entrega.

Avaliações registram critério, resultado, frame/timecode ou trecho, explicação e correção. Critérios não aplicáveis são justificados. Verificações automáticas podem conferir metadados, arquivos, texto e sinalizar suspeitas visuais; aprovação automática estética é hipótese separada.

O vídeo final é assistido integralmente no piloto. Aprovações isoladas dos planos não garantem ritmo nem coerência do conjunto.

## 15. Arquitetura funcional

1. Interface: universo, artigo, direção, storyboard, produção, montagem e avaliações.
2. Base do dossiê: registros, versões, dependências, aprovações e custos.
3. Motor de direção: produz propostas estruturadas dentro das referências autorizadas.
4. Orquestrador: verifica pré-condições, agenda jobs e trata retomadas.
5. Adaptadores: traduzem contratos para fornecedores de voz, imagem, avatar e vídeo.
6. Armazenamento: assets imutáveis, previews e exportações.
7. Montagem: timeline declarativa e renderização reproduzível.
8. Avaliação: checagens técnicas, revisão humana e evidências.

Credenciais ficam no servidor, separadas do manifesto. O motor de execução não modifica decisões editoriais aprovadas. Stack React/Vite/Fastify e decisões PostgreSQL/pg-boss/AssetStore estão registradas em S0-B01; implementação de persistência/fila permanece pendente. Seleção final de fornecedores e modelos depende do piloto. Higgsfield é candidata a imagem/animação de apoio; voz/avatar são rotas separadas.

## 16. Parâmetros ainda a preencher

| Grupo | Parâmetros |
|---|---|
| Editorial | Público, recorte, duração, ritmo, limites de adaptação |
| Visual | Formato, resolução, ambientes, looks, luz e catálogo permitido |
| Voz | Identidade, idioma, interpretação, pronúncia e caminho de integração |
| Movimento | Classes permitidas, duração por classe, câmera e ações |
| Operacional | Custos, tentativas, concorrência, timeout e política de revisão |
| Entrega | Codec, frame rate, áudio, legendas, nomes e canais |

Não atribuir valores universais sem teste ou decisão editorial. Perfil incompleto pode permitir planejamento, mas bloqueia a execução que dependa dos campos ausentes.

## 17. Hipóteses e experimentos

| Hipótese | Experimento | Evidência para decidir |
|---|---|---|
| H01 Referências preservam identidade | Mesma personagem em ângulos e ambientes definidos | Aprovação por plano e tipos de desvio |
| H02 Ambiente mantém coerência espacial | Sequência com dois ou mais ângulos | Posição de elementos e continuidade |
| H03 Voz em câmera e em off é consistente | Montagem alternando os dois modos | Escuta comparativa e sincronização |
| H04 Ações simples são repetíveis | Executar classes do catálogo | Taxa de aprovação, retrabalho e custo |
| H05 Storyboard melhora aderência | Comparar planos equivalentes com e sem composição de referência | Aderência visual e esforço de correção |
| H06 Alternativas preservam intenção | Substituir uma ação problemática | Avaliação narrativa e de montagem |
| H07 Checagens automáticas ajudam | Comparar sinais automáticos com revisão humana | Falhas não detectadas e falsos alertas |

## 18. Protocolo do piloto

1. Integrar um Character Bible existente, voz candidata, estilo e um ambiente.
2. Selecionar um artigo representativo e registrar os critérios de sucesso antes de gerar.
3. Planejar seis a oito planos cobrindo as três rotas principais.
4. Aprovar A–F, registrar todas as tentativas e separar falhas de direção de falhas técnicas.
5. Revisar catálogo, referências e contratos a partir das evidências.
6. Repetir com pelo menos dois artigos de estrutura diferente; essa amostra identifica problemas iniciais, não prova generalização.
7. Definir quais etapas podem ser automatizadas e quais permanecem supervisionadas.

Métricas: proporção de planos aprovados na primeira tentativa; tentativas por classe; custo total e por vídeo aprovado; tempo humano de revisão; falhas de continuidade; falhas factuais; acionamento de alternativas e falhas percebidas apenas na montagem final.

O piloto só autoriza expansão quando os critérios obrigatórios forem atendidos e custo/retrabalho estiverem dentro dos limites escolhidos. Metas numéricas serão definidas antes da execução, conforme orçamento e exigência visual.

## 19. Escopo do primeiro app

Incluir: importação de artigo; referências versionadas; briefing e roteiro editáveis; fichas de plano; storyboard; avaliações; execução por adapters; retomada; custo; timeline básica; exportação e manifesto.

Adiar: treinamento de modelo próprio, edição livre complexa, ações cinematográficas arbitrárias, múltiplos canais de publicação e aprovação estética inteiramente automática.

## 20. Critérios de aceite da especificação e próximos artefatos

Esta v0.1 está completa conceitualmente quando o fluxo, dados, contratos, falhas, aprovações e hipóteses podem ser inspecionados sem depender de um fornecedor específico. A validação operacional permanece pendente.

Próximos artefatos: schemas executáveis; perfis preenchidos de universo e entrega; formulário de avaliação; storyboard de um artigo real; matriz de capacidades dos fornecedores; relatório do piloto e especificação v0.2 com decisões baseadas em evidência.

## 21. Aplicação da decisão Higgsfield

O plano continua sendo a unidade de execução. O adapter de imagem/animação recebe referências versionadas e composição quando suportadas pelo modelo; registra campos enviados/omitidos e evidências. Imagem avaliada é pré-condição da animação derivada. Text-to-video só pode ser alternativa declarada de uma classe calibrada; não contorna identidade, storyboard ou avaliação.

Áudio nativo do clipe é desativado quando suportado ou removido na montagem; eventual som ambiente exige avaliação. A voz oficial tem precedência. Referência sonora não comprova reutilização fiel da fala nem lip sync.

A intenção de geração recebe chave de idempotência persistida antes do envio; nova tentativa deliberada recebe nova chave. Eventos e consultas reconciliam jobs sem aprovação fictícia. Assets são copiados e verificados no AssetStore antes de habilitar montagem/entrega; URLs do provedor não substituem retenção do FBR.
