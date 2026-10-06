# AG-02 — lista e apresentação de artigos

Data: 4 de outubro de 2026. Origem: S1-A01. Complexidade: C1. Executor: Antigravity/Gemini 3.7. Estado: **PRONTO para implementação externa de apresentação**, após publicação de contratos/fixtures S1 e verificação técnica. Integração com a API e avaliação visual humana ficam aqui. Não depende do piloto audiovisual ou de um servidor PostgreSQL ativo para construir os componentes.

## Base concreta

- React/Vite existente; AG-01 integrado em `apps/web/src/AppRoutes.tsx` e `main.tsx`.
- Props: `ArticlesPanelProps`, `ArticleFilters`, `SelectOption` em `packages/contracts/src/configuration-ui.ts`, via `@fbr/contracts`.
- DTO: `ArticleListSchema` e `ArticleListItemSchema` em `configuration.ts`; labels `configurationStatusLabels`.
- Fixture: `articlesConfigurationFixture` e `CONFIGURATION_FIXTURE_NOTICE`, via `@fbr/contracts/fixtures`.
- Hierarquia: `jornada-e-telas-v0.1.md`, T02. Reutilizar a linguagem visual de `apps/web/src/styles/shell.css` e componentes AG-01.

## Arquivos permitidos

Criar somente:

- `apps/web/src/components/articles/ArticlesPanel.tsx`
- `apps/web/src/components/articles/ArticleFilters.tsx`
- `apps/web/src/components/articles/ArticleList.tsx`
- `apps/web/src/styles/articles.css`

Não editar shell, páginas, main/AppRoutes, dependências, contratos, fixtures, backend ou documentos. Não adicionar pacotes. Root integra componentes e CSS ao retornar. Os caminhos estavam livres na liberação; se algum estiver ocupado, interromper a alteração desse arquivo e comunicar conflito.

## Interfaces e comportamento

`ArticlesPanel(props: ArticlesPanelProps)` é export nomeado obrigatório e não cria AppShell/H1: será conteúdo de uma página existente. Pode dividir renderização nos outros dois componentes com props derivadas do contrato, sem schemas ou regras paralelos.

1. Exibir busca e seleções de autora, personagem e situação. Dados vêm de `filters`, `author_options` e `character_options`; mudança emite `onFiltersChange` com o novo objeto. Não buscar, filtrar a lista no cliente ou inferir opções a partir da página recebida. “Todas” tem valor vazio; status utiliza enum/labels publicados.
2. Botão “Importar artigo” chama `onImport`. Não implementar formulário, scraping ou URL fetch.
3. Lista mostra título, autora, revisão, situação e associação de personagem. Sem nome da personagem no DTO, apresentar ID/revisão ou “Autoria pendente”; não inventar nome. Origem/URL, se mostrada, é texto; não inserir HTML capturado.
4. “Abrir artigo” chama `onOpenArticle` com `{id,version}` do item. “Criar vídeo” chama `onCreateVideo` com a mesma referência somente quando a elegibilidade recebida permitir. Isso abre criação; não envia geração. Exibir impedimentos/motivos recebidos, sem recalcular elegibilidade.
5. Paginação usa `total`, `offset` e `limit`; chama `onPageChange` com offset anterior/próximo. Não alterar dados nem iniciar consulta.
6. `loading`: mensagem acessível de carregamento; `error`: mensagem recebida e botão `onRetry`, sem apresentar lista antiga como atual. Lista vazia orienta importar ou ajustar filtros. Fixture de captura incompleta deve mostrar bloqueio e permitir abrir artigo.
7. HTML textual via React; não usar `dangerouslySetInnerHTML`. Sem miniaturas/contagens de produções inexistentes, preços ou qualidade presumida.

## Aceite e retorno

- Componentes controlados; nenhuma chamada HTTP, localStorage, polling, persistência ou regra de domínio.
- Referências exatas nos callbacks; busca/filtros preservam valores recebidos; nenhum botão inicia operação falsa.
- Lista normal, vazia, carregando, erro e captura incompleta apresentados com fixtures/callbacks de ensaio. Cenário fictício é identificado como simulação no ensaio.
- Labels associados, foco visível, mensagem de estado com `role=status`/`aria-live`; desktop e 360 px sem corte horizontal. Tabela pode virar cartões, preservando leitura.
- Rodar typecheck e build; documentar comportamento dos callbacks verificado e limitações de QA. Se criar harness temporário, removê-lo antes de entregar; não alterar main para demonstração.

## Prompt pronto

> Implemente apenas AG-02 no FBR Videos em F:\Projetos\_FBR\FBRVideos. Siga docs/ux/ag-02-handoff-v0.1.md, criando somente os quatro arquivos permitidos. Exporte ArticlesPanel com ArticlesPanelProps de @fbr/contracts; use labels e articlesConfigurationFixture publicados. Reutilize a linguagem visual do AG-01. Faça apresentação controlada, estados e callbacks, sem fetch, persistência, regras, dependências ou alteração das páginas/main. Entregue arquivos/diff, verificações e limitações para integração aqui.
