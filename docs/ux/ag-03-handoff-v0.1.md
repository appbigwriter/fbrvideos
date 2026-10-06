# AG-03 — apresentação do Universo

Data: 4 de outubro de 2026. Origem: S1-A01. Complexidade: C1. Executor: Antigravity/Gemini 3.7. Estado: **PRONTO para apresentação somente leitura**. Contratos e fixtures publicados; integração da página/API e revisão visual ocorrem aqui. Não depende de geração de mídia ou de contas de fornecedores.

## Base concreta

- Props `UniversePanelProps`, `UniverseTab`, `UniverseSelection`, helper `selectedUniverseRecord`, tabs `universeTabs` e labels `configurationStatusLabels`, via `@fbr/contracts`.
- DTO `UniverseSchema`: personagens e referências versionadas. Bible original é separado da interpretação.
- Fixture `universeConfigurationFixture` e aviso `CONFIGURATION_FIXTURE_NOTICE`, via `@fbr/contracts/fixtures`.
- T09 em `jornada-e-telas-v0.1.md`; shell/CSS AG-01 já integrado. Não criar outro shell/H1.

## Arquivos permitidos

Criar somente:

- `apps/web/src/components/universe/UniversePanel.tsx`
- `apps/web/src/components/universe/UniverseDetails.tsx`
- `apps/web/src/styles/universe.css`

Não editar páginas/main/AppRoutes, componentes/CSS existentes, contratos, fixtures, backend, dependências ou documentos. Root integra componente e CSS. Arquivos estavam livres na liberação; reportar conflito antes de sobrescrever.

## Interfaces e comportamento

Export obrigatório `UniversePanel(props: UniversePanelProps)`; `UniverseDetails` recebe props derivadas dos tipos publicados. Tabs e seleção são controlados: não criar estado local que contradiga `tab`/`selected`.

1. Renderizar as cinco tabs de `universeTabs`; clique chama `onTabChange`. Filtrar apenas a apresentação por categorias da tabela publicada; isso não altera catálogo nem repertório permitido. Personagens apresenta entidades de personagem e referências de kind character, distinguindo os dois tipos.
2. Cards mostram nome, tipo e revisão/status. Clique chama `onSelect({kind:'character'|'reference',ref:{id,version}})`. Não substituir versão recebida por outra revisão. A seleção exata pode ser resolvida por `selectedUniverseRecord`.
3. Detalhe de personagem: nome/status/versão, interpretação e estado de confirmação, referências/voz disponíveis e variações autorizadas. “Consultar Bible original” chama `onOpenBible` com referência da personagem. Não fazer fetch nem inserir o Bible por HTML. A interpretação não é o original.
4. Detalhe de referência: nome/kind/status/versão, regras, direitos de uso e IDs/revisões dos assets vinculados. Distinguir “Pendente”, “Aprovado” e “Arquivado” pelos labels; não realizar aprovação ou concluir qualidade a partir do cadastro.
5. Não há URLs de miniatura resolvidas nesse DTO. Usar fallback “Sem mídia disponível”; não construir URLs de disco/fornecedor, buscar imagens externas ou inventar preview. Futuro AssetStore será conectado aqui.
6. Carregamento, erro com `onRetry`, tab vazia e seleção inexistente precisam de mensagens claras. Fechar detalhe chama `onSelect(null)`.
7. Nenhum formulário de cadastro, importação, upload, interpretação de Bible, edição, aprovação ou integração de fornecedor pertence a AG-03.

## Aceite e retorno

- Cinco tabs corretas, categorias conforme tabela publicada e sem esconder entidades por falta de mídia/teste.
- IDs/versões exatos nos callbacks; seleção desatualizada não exibe outro registro como selecionado.
- Fixture deixa explícito que não há mídia real. Confirmar interpretação não implica integração vocal ou qualidade visual.
- Texto escapado por React; teclado e foco visível, seleção/tab identificáveis sem depender de cor. Layout legível em 360 px.
- Rodar typecheck/build; entregar arquivos/diff, verificações de tabs/seleção/estados e limitações. Sem alteração permanente de main/páginas para demonstração.

## Prompt pronto

> Implemente apenas AG-03 no FBR Videos em F:\Projetos\_FBR\FBRVideos. Siga docs/ux/ag-03-handoff-v0.1.md, criando somente os três arquivos permitidos. Exporte UniversePanel com UniversePanelProps de @fbr/contracts; use universeTabs, selectedUniverseRecord, labels e universeConfigurationFixture publicados. Construa tabs, cards e detalhes somente leitura, com callbacks e fallback de mídia. Não faça fetch/upload, interprete Bible, aprove referências ou altere páginas/main/contratos/dependências. Entregue arquivos/diff, verificações e limitações para integração aqui.
