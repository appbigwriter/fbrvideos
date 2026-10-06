# AG-01 — estrutura visual e navegação

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Origem: S0-A01 · Complexidade C1 · Executor: Antigravity/Gemini 3.7, conforme fila autorizada pelo usuário. Material UX preparado em 4 de outubro de 2026. Estado do pacote: **INTEGRADO tecnicamente**, após retorno do Antigravity e conexão das rotas/CSS pelo root. A liberação original foi PRONTO com contratos, typecheck, 17 testes e build aprovados. O aceite técnico cobre shell/páginas vazias, não qualidade audiovisual nem aprovação humana de produto. QA visual em navegador permanece pendente.

## Estado vigente após retorno do Antigravity

AG-01 **INTEGRADO tecnicamente em 4 de outubro de 2026**. Os seis arquivos foram recebidos, revisados e preservados; root conectou `AppRoutes.tsx`, `main.tsx` e CSS. Onze rotas passaram no teste de render estático; typecheck e build passaram. QA visual/teclado em navegador e julgamento humano continuam pendentes. O estado PRONTO no registro inicial acima descreve a liberação original. Não reenviar AG-01; próximos pacotes são [AG-02/03/04](antigravity-s1-pacotes-v0.1.md).

## Base e entradas concretas

- Base técnica existente: React/Vite em `apps/web`; preservar decisões de B.
- Contratos: `packages/contracts/src`, via `@fbr/contracts`. B confirmou `navigation` para menu e `routePaths` para todas as rotas.
- Desenho: `docs/ux/jornada-e-telas-v0.1.md` e `docs/ux/prototipo-jornada.html`.
- Apresentação: `docs/ux/contrato-apresentacao-v0.1.md`.
- Fixtures visuais: `docs/ux/fixtures/cenarios-v0.1.json`; somente referências de desenho, AG-01 não conecta o fluxo simulado à aplicação.

Entradas técnicas e ownership confirmados pelo root. Conclusão externa vai a EM_REVISAO; não marcar INTEGRADO antes de integrar em `main.tsx` aqui e verificar rotas reais. Avaliação humana do protótipo e validação visual continuam pendentes; não são representadas como já realizadas.

O workspace ainda não é repositório Git, conforme verificação do root. Este pacote não pressupõe branch, commit-base ou comandos Git. Usar ownership explícito dos seis arquivos e devolver diff/arquivos comparáveis; isolamento por checkout só poderá ser acrescentado após inicialização/decisão do root.

## Rotas acordadas com B

| Caminho | Tela/estado vazio |
|---|---|
| `/` | Início: “Selecione um artigo para começar. Produções e pendências aparecerão aqui.” |
| `/artigos` | Artigos: “Nenhum artigo disponível. A importação será conectada nesta etapa do produto.” |
| `/artigos/:id` | Detalhe: “Conteúdo e revisão do artigo serão apresentados aqui.” |
| `/producoes` | Produções: “Nenhuma produção disponível. Crie um vídeo a partir de um artigo.” |
| `/producoes/nova?artigo=:id` | Criar produção: “Escolha artigo e perfil. As cenas serão planejadas pelo sistema.” |
| `/producoes/:id` | Acompanhamento: “Estado, etapas, consumo e pendências da produção serão apresentados aqui.” |
| `/producoes/:id/revisao` | Revisão: “O vídeo renderizado estará disponível para revisão nesta tela.” |
| `/producoes/:id/entrega` | Entrega: “Arquivos da versão aprovada serão apresentados aqui.” |
| `/perfis` | Perfis de produção: “Configure uma vez os padrões para vários artigos.” |
| `/universo` | Universo: “Personagens, Bibles e referências serão apresentados aqui.” |
| `/configuracoes` | Configurações: “Fontes, fornecedores e limites serão configurados aqui.” |

Query string é contexto opcional, não segmento de rota. Mapear os nomes finais de `routePaths` sem criar constantes paralelas. Link de menu Artigos pode funcionar como ação inicial; importação, geração, salvamento e downloads ficam sem botões de operação falsa.

## Arquivos permitidos e divisão de integração

Antigravity pode criar somente:

- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/MainNavigation.tsx`
- `apps/web/src/components/PageHeader.tsx`
- `apps/web/src/components/EmptyState.tsx`
- `apps/web/src/pages/ShellPages.tsx`
- `apps/web/src/styles/shell.css`

Não editar `main.tsx`, entrypoint HTML, package/config raiz, contratos ou documentos originais. A frente B/root conecta as páginas ao bootstrap/rotas e importa o CSS. Não modificar dependências. Antes de enviar, root reserva esses seis caminhos; se estiverem ocupados, atualizar ownership aqui antes da execução.

Interfaces visuais do pacote: `AppShell({children})` contém marca e menu; `MainNavigation()` consome `navigation` e usa links de React Router com `aria-current`; `PageHeader({title, description?})`; `EmptyState({title, description, children?})`; `ShellPages.tsx` exporta páginas nomeadas para a tabela acima, com títulos/textos aprovados. Nenhuma página consulta API. `children` aceita conteúdo de apresentação; não inclui regra de negócio ou autenticação. Labels vêm de `navigation` quando disponíveis.

Exports técnicos publicados: `navigation`, `routePaths`, `productionStateLabels`, `ProductionViewSchema` e tipo `ProductionView` em `packages/contracts/src/presentation.ts`, reexportados por `packages/contracts/src/index.ts`. Chaves de `routePaths`: `home`, `articles`, `article`, `productions`, `createProduction`, `production`, `review`, `delivery`, `profiles`, `universe`, `settings`. Páginas nomeadas esperadas em `ShellPages.tsx`: `HomePage`, `ArticlesPage`, `ArticlePage`, `ProductionsPage`, `CreateProductionPage`, `ProductionPage`, `ReviewPage`, `DeliveryPage`, `ProfilesPage`, `UniversePage`, `SettingsPage`.

## Critérios de aceite

1. Menu tem exatamente Início, Artigos, Produções, Perfis de produção, Universo e Configurações; marca “FBR Videos”.
2. Cada página tem um H1, descrição e estado vazio adequado. Menu ativo identificável por texto/forma e sem depender somente de cor.
3. Layout mantém ordem de leitura/foco em desktop e 360 px; sem rolagem horizontal. Foco visível, navegação por teclado e link de pular ao conteúdo.
4. Páginas não mostram percentuais, ETA, preços, vídeos, fornecedores conectados ou aprovações inventadas. Sem ficha de cena obrigatória.
5. Rotas usam contrato de B; aplicação abre cada caminho após integração aqui. Prefixo `/producoes/nova` não é confundido com detalhe de ID.
6. Nenhuma chamada externa, polling, storage, auth, validação de domínio, máquina de estados ou API nova.
7. Entrega inclui diff, caminhos alterados, verificação feita e limitações. O root integra e verifica build/typecheck e navegação na base técnica.

## Prompt pronto quanto ao UX

O trecho pode ser enviado quando root confirmar as entradas técnicas acima:

> Implemente apenas AG-01 no FBR Videos usando a base React/Vite existente e `navigation`/`routePaths` de `@fbr/contracts`. Siga `docs/ux/ag-01-handoff-v0.1.md` para ownership, interfaces, rotas, textos e critérios; use `docs/ux/prototipo-jornada.html` como referência de hierarquia visual e `docs/ux/jornada-e-telas-v0.1.md` como desenho. Crie somente os seis arquivos permitidos no handoff. Entregue AppShell, navegação, cabeçalho, estado vazio e páginas vazias nomeadas; a integração de `main.tsx` pertence ao root/B. Não replique a simulação do protótipo, não invente contratos, não altere dependências ou configuração e não faça chamadas externas. Se os exports técnicos descritos não estiverem disponíveis, relate a pendência antes de alterar escopo. Entregue arquivos, diff, verificações e limitações para revisão aqui.

## Limite da revisão Higgsfield

AG-01 permanece PRONTO no mesmo escopo e seis arquivos. O candidato de geração não altera rotas, menu, callbacks, exports ou contrato 0.1.0. Não adicionar Studio/Next.js, SDK, picker operacional, chave, uploads ou geração. Configurações permanece página vazia; essas integrações pertencem às sprints futuras aqui.
