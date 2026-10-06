# FBR Videos — projeto base do sistema

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Versão 0.1 · 4 de outubro de 2026 · Base de produto para elaboração do PRD.

## 1. Definição do produto

Aplicação que transforma artigos de blog em vídeos narrados em primeira pessoa pela influencer virtual autora. O usuário seleciona um artigo, utiliza um perfil de produção e solicita o vídeo. O sistema adapta o conteúdo, define a situação narrativa e a direção visual, produz os componentes e monta uma versão para revisão.

O trabalho recorrente do usuário é selecionar conteúdos e avaliar resultados. A definição detalhada de cenas é gerada internamente, não exigida como formulário de entrada. Character Bibles já existentes são incorporados como autoridade de identidade e narrativa.

Este documento define a base funcional e a experiência do produto. Não constitui ainda um PRD de implementação nem comprova a qualidade dos fornecedores. A especificação audiovisual complementar é `especificacao-producao-audiovisual-v0.1.md`.

### Precedência sobre a proposta anterior

Este projeto corrige a experiência operacional inicialmente proposta: aprovações intermediárias A–E não são obrigatórias no fluxo cotidiano. O planejamento detalhado e o Dossiê de Produção são internos; aparecem por inspeção, exceção ou modo de calibração. Durante os testes de qualidade, revisões intermediárias continuam disponíveis. Conclusão automática de uma etapa não equivale a aprovação humana.

## 2. Objetivos e princípios de produto

1. Produzir vídeos a partir do conteúdo efetivo dos artigos.
2. Preservar a identidade e a voz narrativa da autora.
3. Automatizar decisões de direção dentro de um repertório visual validado.
4. Oferecer correção localizada, sem recriar o vídeo inteiro.
5. Controlar custo, tentativas e falhas sem exigir supervisão contínua.
6. Registrar fontes, referências e versões para investigar problemas.

A qualidade visual mínima é requisito de liberação do produto; um fluxo funcionando tecnicamente não basta. O sistema não promete adequação de qualquer artigo ou ação visual. Conteúdos fora do repertório geram alternativa ou pendência explícita.

## 3. Usuários e responsabilidades

No MVP, uma pessoa pode acumular todas as responsabilidades: configurar o universo, selecionar artigos, revisar vídeos e administrar integrações. O produto não exige estrutura de equipe.

Separar conceitualmente permissões de operação, aprovação e administração para evolução futura. Colaboração avançada e gestão completa de papéis ficam fora do MVP.

## 4. Jornada principal

### Configuração inicial

Cadastrar blog → importar personagens e Bibles → confirmar associação entre autores e personagens → configurar voz e referências → criar perfil de produção → validar uma produção de calibração → habilitar perfil para uso recorrente.

### Operação recorrente

Selecionar artigo → usar perfil sugerido → conferir estimativa/limite disponível → gerar → acompanhar → assistir e corrigir se necessário → aprovar → exportar.

O fluxo não exige escolher enquadramento, ambiente ou ação de cada cena. O usuário pode abrir opções avançadas ou revisão prévia de roteiro voluntariamente.

### Automação futura

Novo artigo → associação ao perfil → verificação de elegibilidade e orçamento → produção → fila de revisão. Publicação automática e geração recorrente sem intervenção serão evoluções separadas, depois da validação operacional.

## 5. Navegação

Menu principal:

- **Início:** resumo de trabalhos, pendências e consumo.
- **Artigos:** conteúdo do blog e ponto de partida das produções.
- **Produções:** vídeos em processamento, revisão e entrega.
- **Perfis de produção:** padrões reutilizáveis de formato e direção.
- **Universo:** personagens, ambientes, figurinos, objetos e estilos.
- **Configurações:** blogs, integrações, orçamento e preferências.

Assets reutilizáveis ficam dentro do Universo e de cada produção. Um menu independente de Biblioteca poderá ser acrescentado quando o volume justificar.

## 6. Definição das telas

### T01 — Início

**Objetivo:** mostrar o que precisa de atenção e permitir retomar o trabalho.

Componentes: resumo de produções; fila de revisão; falhas e bloqueios; jobs ativos; consumo do período; artigos recentes disponíveis. Ação principal: “Criar vídeo de um artigo”.

Comportamentos: abrir produção ou artigo; filtrar pendências; distinguir custo confirmado de estimado. Sem configuração inicial, apresentar os passos necessários. Sem trabalhos, orientar para Artigos.

### T02 — Artigos

**Objetivo:** organizar a matéria-prima e selecionar o conteúdo de origem.

Componentes: busca; filtros por blog, autor, categoria e situação; lista com título, autor, data, personagem associado e produções vinculadas. Ações: importar URL, sincronizar fonte suportada, abrir artigo e criar vídeo.

Situações: importado, incompleto, associação pendente, disponível e revisão de origem alterada. “Já possui vídeo” é informação independente, pois um artigo pode gerar várias produções.

MVP: importação por URL e colagem de texto como alternativa. Sincronização automática depende do CMS/feed a definir; a interface não deve oferecer integração não implementada.

### T03 — Detalhe do artigo

**Objetivo:** confirmar que a fonte foi capturada corretamente.

Componentes: conteúdo limpo; imagens originais disponíveis; metadados; URL; versão; personagem associado; histórico de produções. Ações: corrigir extração, atualizar captura, resolver autoria e criar vídeo.

Regras: mudanças criam nova revisão; produções existentes mantêm sua fonte original. Extração incompleta bloqueia geração até correção. Imagens do artigo só podem ser reutilizadas conforme disponibilidade e permissão registrada.

### T04 — Criar produção

**Objetivo:** iniciar com poucas escolhas.

Campos principais: artigo, perfil de produção e nome sugerido. O perfil traz personagem, idioma, formato, duração-alvo e orçamento. Exibir resumo e eventuais pendências.

Opções avançadas recolhidas: recorte editorial, duração, ambiente preferido, elementos a evitar e revisão prévia de roteiro. Sobrescritas valem apenas para a nova produção.

Ação: “Gerar vídeo”. Perfil não validado permite somente produção de calibração identificada. Sem base suficiente para estimar custo, mostrar teto e incerteza; nunca apresentar um valor como garantido.

### T05 — Produção e acompanhamento

**Objetivo:** acompanhar o resultado sem gerenciar cada job.

Componentes: artigo e perfil; etapa atual; custo estimado, comprometido quando disponível e confirmado; pendências; preview quando pronto; histórico de versões. Etapas visíveis: preparação, roteiro e direção, geração, montagem, revisão e entrega.

Ações: abrir pendência, pausar novos jobs, retomar, cancelar e inspecionar produção. Pausar não promete interromper jobs externos já iniciados. Cancelar informa o destino de jobs em andamento e preserva custos/arquivos já produzidos.

Não mostrar percentual global ou prazo preciso sem base confiável. Inspeção avançada abre roteiro, cenas, referências, avaliações e registros internos.

### T06 — Revisão do vídeo

**Objetivo:** avaliar e corrigir o resultado em contexto.

Componentes: player com timecode; lista de cenas; transcrição sincronizada; apontamentos; versões; comparação antes/depois. Selecionar uma cena mostra suas referências e intenção, sem exigir edição da ficha técnica.

Ações de correção: “Imagem não corresponde”, “Personagem diferente”, “Ambiente inadequado”, “Movimento estranho”, “Problema na fala/voz” e comentário livre. O sistema prepara um plano de correção, identifica elementos afetados e apresenta custo/limite antes de executar quando houver gasto adicional.

Edição direta de fala é permitida; o sistema sinaliza dependências e verifica fidelidade à fonte. Aprovação final é vinculada à versão renderizada; qualquer alteração relevante exige nova revisão. Registrar declaração de revisão integral, sem tratar reprodução do player como prova de julgamento.

### T07 — Entrega

**Objetivo:** disponibilizar a versão aprovada.

Componentes: vídeo; versão; formato; custo; data de aprovação; arquivos de legenda; manifesto opcional. Ações: baixar, copiar referência interna e criar nova produção a partir do mesmo artigo.

Não exportar como “aprovado” uma versão com pendências obrigatórias. Preview de revisão pode ser disponibilizado com identificação clara. Publicação em redes não faz parte do MVP.

### T08 — Perfis de produção

**Objetivo:** definir uma vez os padrões usados em muitos artigos.

Lista: nome, personagem, formato, blogs/categorias associados, versão e estado. Editor com seções: identidade; narrativa; direção visual; voz e presença em câmera; formato e montagem; custo e revisão.

Parâmetros: objetivo/público; duração-alvo; tom; idiomas; estilos; ambientes e looks permitidos; classes de cenas; equilíbrio entre avatar e cenas de apoio; legendas/trilha; orçamento; tentativas; alternativas. Campos técnicos têm valores de perfil aprovados, sem exigir conhecimento de prompts.

Ações: criar, duplicar, testar, versionar e habilitar. Estados: rascunho, em calibração, validado e suspenso. Validação é para um escopo declarado de formatos, personagens e classes de conteúdo; não significa adequação universal.

### T09 — Universo

**Objetivo:** manter identidade e repertório visual reutilizável.

Abas: Personagens; Ambientes; Figurinos e objetos; Estilos; Vozes.

Personagem: importar Bible, visualizar original e campos extraídos, confirmar interpretação, cadastrar referências e associar voz/autoria. O sistema não sobrescreve o Bible com inferências.

Ambiente: referências aprovadas, ângulos, objetos fixos, luz e evidência de continuidade. Figurinos/objetos: referências e regras. Estilo: exemplos, paleta, luz e linguagem visual. Voz: amostras, idioma, pronúncia e caminho de integração testado.

Ações comuns: incluir, avaliar, versionar, arquivar e consultar usos. Referências antigas permanecem acessíveis às produções que as utilizaram.

### T10 — Configurações

**Objetivo:** administrar fontes e operação.

Seções: blogs e associação de autores; fornecedores e teste de conexão; armazenamento; limites de gastos e tentativas; perfis de exportação; idioma/fuso. Credenciais ficam protegidas no servidor e não aparecem em exports ou logs de conteúdo.

Conexão válida confirma acesso técnico, não qualidade. O usuário pode definir limites por produção e por período. Erro de provedor deve mostrar efeito e ação de recuperação compreensíveis.

## 7. Direção automatizada interna

O usuário solicita um vídeo; o sistema gera o Dossiê de Produção com:

1. Extração e classificação dos argumentos e experiências do artigo.
2. Seleção de receita audiovisual compatível com conteúdo e perfil.
3. Roteiro em primeira pessoa com fontes por afirmação.
4. Situação narrativa e seleção de ambientes dentro do universo permitido.
5. Planos estruturados, continuidade e alternativas.
6. Composições/referências necessárias para cada rota.
7. Geração, avaliação e correção dentro dos limites.
8. Timeline baseada no áudio efetivo e renderização.

### Receitas audiovisuais

Estruturas iniciais candidatas: explicação, lista de recomendações, reflexão/opinião e relato pessoal sustentado pela fonte. Tutorial demonstrativo só é habilitado para ações validadas.

Cada receita define organização narrativa, funções visuais, classes de planos e alternativas. Sua escolha deve considerar o conteúdo, não apenas a categoria do blog. Se nenhuma receita for compatível, o sistema solicita ajuste de recorte ou utiliza uma receita conservadora validada; não inventa demonstrações.

### Avaliação e revisão

Checks determinísticos verificam campos, arquivos, tempos, dependências e orçamento. Avaliações por modelos sinalizam suspeitas sem garantir acerto visual. Durante o piloto, avaliação humana mede o desempenho dessas verificações. A revisão final humana permanece obrigatória no MVP.

## 8. Estados e comportamentos de exceção

Estado público da produção: em preparação; em produção; aguardando decisão; pausada; falhou; pronta para revisão; em correção; aprovada; exportada; cancelada.

Execução de jobs e avaliações mantêm estados internos separados. “Aguardando decisão” exige uma pendência objetiva e opções de resolução.

| Situação | Comportamento |
|---|---|
| Autor não associado | Pedir seleção da personagem antes de produzir |
| Artigo alterado na origem | Oferecer nova revisão sem alterar a produção existente |
| Fonte insuficiente ou contraditória | Sinalizar trecho; pedir ajuste ou excluir alegação |
| Cena fora do repertório | Aplicar alternativa compatível ou abrir pendência |
| Falha técnica transitória | Repetir conforme política, sem duplicar job válido |
| Resultado visual inadequado | Refazer etapa responsável dentro do limite |
| Limite de custo/tentativas atingido | Suspender novos gastos e apresentar opções |
| Timeout de fornecedor | Consultar job externo antes de repetir |
| Correção afeta outros elementos | Mostrar impacto e preservar o restante válido |

## 9. Requisitos funcionais para o PRD

| ID | Requisito | Prioridade |
|---|---|---|
| RF01 | Importar artigo por URL com captura revisável | MVP |
| RF02 | Permitir entrada manual quando extração falhar | MVP |
| RF03 | Associar autoria a personagem e Bible existentes | MVP |
| RF04 | Cadastrar referências e perfis versionados | MVP |
| RF05 | Criar produção com artigo e perfil, sem planejamento manual obrigatório | MVP |
| RF06 | Gerar roteiro e direção internos rastreáveis à fonte | MVP |
| RF07 | Selecionar receita e planos dentro do repertório permitido | MVP |
| RF08 | Integrar rotas de avatar, cenas de apoio, voz e montagem | MVP, condicionado a piloto técnico |
| RF09 | Acompanhar jobs, persistir progresso e retomar sem duplicação | MVP |
| RF10 | Limitar tentativas e gastos | MVP |
| RF11 | Revisar e corrigir trechos específicos | MVP |
| RF12 | Invalidar dependências e aprovações após alterações | MVP |
| RF13 | Exportar vídeo aprovado e legendas | MVP |
| RF14 | Inspecionar dossiê, referências e histórico | MVP |
| RF15 | Sincronizar artigos por feed/CMS | Próxima fase, fonte a definir |
| RF16 | Produzir lotes com controle de fila e orçamento | Próxima fase |
| RF17 | Automatizar a criação após novo artigo | Próxima fase, após qualidade validada |
| RF18 | Publicar em canais externos | Evolução separada |

## 10. Requisitos operacionais

- Jobs longos executam em background; fechar a tela não cancela a produção.
- Versões, arquivos e decisões são persistentes e recuperáveis.
- Adaptadores de fornecedores preservam um contrato interno comum.
- Custos estimados e confirmados são separados; limite considera compromissos conhecidos de jobs em andamento. Incertezas impedem novos gastos quando não há margem segura configurada.
- Logs de geração preservam diagnóstico sem expor credenciais.
- Exportações usam perfil técnico explícito e verificável.
- Interface e mensagens iniciais em português; tempos exibidos no fuso configurado.
- Falhas e pendências devem informar causa, impacto e próxima ação.
- Retenção, exclusão, backup e metas de desempenho serão especificados no PRD conforme hospedagem e volume.

## 11. Escopo do MVP e exclusões

MVP: um ambiente de operação, importação manual de artigos, uma receita inicial validada, um formato de entrega inicial, personagens/Bibles existentes, referências e perfis, geração integrada supervisionada, revisão localizada e exportação. O cadastro admite múltiplas personagens, mas a validação inicial ocorre em um recorte controlado.

Fora do MVP: editor audiovisual completo; publicação automática; treinamento próprio; sincronização com qualquer CMS; colaboração avançada; ações visuais arbitrárias; decisões estéticas totalmente autônomas; geração em lote sem acompanhamento de limites.

O formato inicial, receita e seleção final dos fornecedores dependem do piloto. Higgsfield é candidata a imagens e cenas de apoio; HeyGen permanece candidato para avatar e rota vocal compatível. Essas candidaturas não habilitam perfis nem demonstram qualidade.

## 12. Critérios de aceite de produto

| ID | Cenário | Resultado esperado |
|---|---|---|
| AC01 | Artigo e perfil válidos | Usuário inicia produção sem especificar cenas individualmente |
| AC02 | Conteúdo capturado incompleto | Sistema bloqueia execução e permite corrigir a fonte |
| AC03 | Narração em primeira pessoa | Afirmações e experiências são rastreáveis; invenções são pendências |
| AC04 | Direção visual | Planos usam referências e classes permitidas pelo perfil |
| AC05 | Produção interrompida | Retomada preserva assets válidos e não duplica jobs concluídos |
| AC06 | Imagem de uma cena reprovada | Correção mantém roteiro/áudio válidos e atualiza a montagem afetada |
| AC07 | Fala alterada | Áudio, lip sync, legendas e tempos afetados são revalidados |
| AC08 | Orçamento esgotado | Nenhum novo job pago é iniciado além da política de limites |
| AC09 | Versão aprovada alterada | Nova versão exige nova aprovação |
| AC10 | Entrega final | Vídeo reproduzível, legendas corretas e ausência de pendências obrigatórias |

AC03 e AC04 incluem avaliação humana no piloto. Qualidade mínima de identidade, estética, voz e continuidade terá exemplos e rubrica aprovados antes da liberação. Metas numéricas de custo e desempenho não serão inventadas antes dessa calibração.

## 13. Indicadores de produto

Medir tempo entre solicitação e versão revisável; tempo humano por vídeo; aprovação na primeira revisão; correções por classe; custo por vídeo aprovado; falhas de fidelidade/identidade/continuidade; frequência de alternativas e produções bloqueadas. Distinguir tempo de espera do fornecedor, execução e intervenção humana.

## 14. Plano de desenvolvimento e validação

1. **Protótipo de experiência:** Artigos → Criar produção → Acompanhamento → Revisão → Entrega, incluindo estados de falha. Validar que o usuário não precisa dirigir cada cena.
2. **Piloto audiovisual:** executar uma produção completa com artigo real, identidade, voz, ambiente e receita definidos; validar continuidade entre o avatar candidato HeyGen, a narração oficial e imagens/cenas de apoio candidatas Higgsfield, com modelos/operações definidos pelo ensaio.
3. **Repetição:** testar outros artigos e registrar limites, custos, correções e padrões reutilizáveis.
4. **PRD executável:** fechar contratos técnicos, fornecedores, metas e backlog a partir das evidências.
5. **MVP integrado:** implementar fluxo completo, persistência, fila, revisão e controle de custos.
6. **Ampliação:** adicionar receitas, formatos, sincronização e automação conforme resultados.

Não iniciar a integração completa de todos os fornecedores antes de demonstrar a viabilidade audiovisual do caminho escolhido. Protótipo de interface e persistência básica podem avançar em paralelo ao piloto.

## 15. Decisões pendentes para o PRD

| Decisão | Evidência necessária |
|---|---|
| Blog/CMS e associação de autoria | Estrutura real das fontes |
| Formato e duração iniciais | Canal e finalidade dos vídeos |
| Receita inicial | Artigos representativos |
| Identidade vocal e avatar candidato HeyGen | Teste com áudio oficial em câmera/off, acesso/engine e lip sync |
| Imagens e apoio candidatos Higgsfield | Schema por operação, acesso, identidade, ação, continuidade e custo por aprovado |
| Geradores e referências | Qualidade aprovada por classe de plano |
| Limites e capacidade | Orçamento, frequência e custos medidos |
| Hospedagem, armazenamento e retenção | Volume esperado e operação |
| Rubrica estética | Exemplos aprovados/reprovados pelo responsável |

Estas decisões não impedem a definição das telas; precisam ser fechadas antes dos respectivos itens de implementação.

## 16. Estrutura sugerida do PRD

O PRD seguinte deve conter problema/objetivos; usuários; escopo; fluxos por cenário; requisitos por tela; modelo de dados; contratos do pipeline; integrações; regras de qualidade; dependências; estados e erros; segurança/retencão; métricas; critérios de aceite; testes de integração; plano de lançamento e backlog priorizado.

Este projeto base fornece o desenho de produto. A especificação audiovisual fornece o método interno. Resultados do piloto fornecerão os valores e limites que faltam para tornar o PRD executável.

## 17. Integração de geração e experiência

A integração Higgsfield utiliza a aplicação existente e adapters internos. T04 continua pedindo artigo e perfil; seleção de modelo/prompt é configuração técnica ou inspeção avançada. T08 habilita somente repertório calibrado no escopo do perfil, preservando catálogo técnico e escolhas existentes. T10 distingue credencial salva, acesso verificado e qualidade validada. Roteiro rastreável, direção, correção, montagem, orçamento e aprovação permanecem no FBR.

A estimativa autenticada alimenta o orçamento sem substituir reserva e reconciliação. Cancelamento externo só é elegível antes do processamento; mídia concluída é copiada para armazenamento persistente. Ver a decisão de integração para contratos e limites.
