# AG-04 — campos de formulário reutilizáveis

Data: 4 de outubro de 2026. Origem: S1-A01. Complexidade: C1. Executor: Antigravity/Gemini 3.7. Estado: **PRONTO para componentes controlados**. Não implementa CRUD, regras do perfil, integração ou editor completo.

## Base concreta

- Props `FieldBaseProps`, `TextFieldProps`, `SelectFieldProps`, `CheckboxFieldProps`, `FormActionsProps`, `SelectOption`, via `@fbr/contracts` em `configuration-ui.ts`.
- `profileFieldDescriptions` traz labels/ajudas; `configurationFields` traz o catálogo de campos. Não inferir valores, opções ou validação a partir deles.
- Comandos S1: SaveArticleSchema/SaveCharacterSchema/SaveReferenceSchema/SaveProfileSchema publicados; pertencem ao integrador, não aos componentes.
- Fixture profilesConfigurationFixture, via `@fbr/contracts/fixtures`, representa perfil em rascunho com parâmetros ausentes. Não preenchê-los automaticamente.
- Linguagem visual de `shell.css`; acessibilidade de `jornada-e-telas-v0.1.md`.

## Arquivos permitidos

Criar somente:

- `apps/web/src/components/forms/ConfigurationFields.tsx`
- `apps/web/src/components/forms/FormActions.tsx`
- `apps/web/src/styles/forms.css`

Não editar shell/páginas/main/AppRoutes, contratos/fixtures, API, package/config ou documentos. Root conecta os componentes e CSS. Caminhos livres na liberação; não sobrescrever trabalho concorrente.

## Exports e comportamento

ConfigurationFields.tsx exporta funções nomeadas:

| Export | Props publicadas | Entrada/evento |
|---|---|---|
| TextField | TextFieldProps | Texto controlado; onChange(string) |
| TextareaField | TextFieldProps | Texto multilinha; onChange(string) |
| NumberField | TextFieldProps | Valor textual controlado, inputMode decimal; onChange(string), sem conversão monetária ou arredondamento |
| SelectField | SelectFieldProps | Opções/placeholder recebidos; onChange(value string) |
| CheckboxField | CheckboxFieldProps | checked recebido; onChange(boolean) |

NumberField deve preservar entrada parcial/vazia; usar input textual com teclado numérico, sem converter para Number, inventar defaults ou aplicar regras de teto. A conversão e validação server-side pertencem ao integrador.

Todos os campos usam id/label, help/error nullable, required/disabled recebidos. Exibir ajuda e erro com IDs derivados do id do campo; conectar aria-describedby e aria-invalid. Não gerar erro próprio, filtrar opções recebidas ou modificar valor prop. Inputs, textarea e select precisam de foco visível e rótulos associados.

FormActions.tsx exporta `FormActions(props: FormActionsProps)`: botão submit com submit_label; desabilitado durante pending ou quando can_submit=false; mostrar blocked_reason quando informado. Botão “Cancelar” chama onCancel e tem type=button. Mensagem acessível de salvamento quando pending. Não chamar API ou onSubmit dentro do componente; o submit pertence ao form do integrador.

## Aceite e retorno

- Exports/props tipados e controlados, sem hooks de domínio, storage, fetch ou persistência.
- Erro vem do integrador; nenhuma alegação de validação de perfil, custo ou qualidade.
- Valores vazio/parcial, erro, ajuda, obrigatório, desabilitado, pending e bloqueio apresentados; submit não executa ação falsa.
- Sem truncamento em 360 px; contraste/foco/labels e estados legíveis. CSS novo usa classes próprias sem redefinir estilos globais de AG-01/02/03.
- Rodar typecheck/build e documentar callback/estado verificado e limitações. Harness temporário, se usado, não altera páginas/main na entrega.

## Prompt pronto

> Implemente apenas AG-04 no FBR Videos em F:\Projetos\_FBR\FBRVideos. Siga docs/ux/ag-04-handoff-v0.1.md, criando somente os três arquivos permitidos. Use os tipos de campos e FormActionsProps publicados em @fbr/contracts. Exporte TextField, TextareaField, NumberField, SelectField, CheckboxField e FormActions. Faça inputs controlados, labels, ajuda, erros recebidos, foco e ações nativas de formulário. Não valide domínio, converta moeda, preencha defaults, salve dados ou altere páginas/main/contratos/dependências. Entregue arquivos/diff, verificações e limitações para integração aqui.
