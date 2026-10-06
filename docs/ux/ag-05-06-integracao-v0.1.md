# Integração AG-05/06 — 5 de outubro de 2026

**INTEGRADOS tecnicamente às páginas reais.** Aceite editorial humano, piloto audiovisual e gates S2/S3 continuam pendentes. A rodada paralela S1 terminou antes desta integração; informou 69 testes aprovados e preservou as telas externas.

## Conexão e revisão

`ProductionsConnected.tsx` usa `ProductionSetupPanel` na criação e `DossierPanel` no acompanhamento. `ProductionPresentation.ts` projeta o resumo e converte os campos controlados ao pedido validado pelo contrato público. `main.tsx` importa os dois CSS; seletores foram limitados aos wrappers da integração para evitar efeitos sobre outras telas.

Criação seleciona perfis da identidade/revisão do artigo. Bloqueios conhecidos aparecem no resumo e desabilitam submit: artigo incompleto, autora não associada, perfil ausente/incompatível/suspenso/incompleto, recorrência sem validação, nome vazio e duração inválida. A decisão completa de elegibilidade, Bible, referências, repertório e registro de calibração permanece no servidor. O controller conserva `useCommand`, chave de intenção/replay e navegação após resposta válida.

Duração vazia utiliza o perfil; preenchida envia `overrides.target_seconds` positivo. Itens a evitar são convertidos por linha, com linhas vazias removidas, a `overrides.avoid`. O resumo informa estimativa de mídia indisponível, teto/margem e cota OAuth. A criação informa que dispara planejamento e não anuncia ausência de consumo.

Dossiê recebe o artigo do snapshot, nunca a última revisão de cadastro. O projetor valida ID/versão e mostra erro em caso de divergência. Loading, falha com retry e ausência de planejamento usam AG-06. Fontes exatas expandem o segmento literal, com ID, revisão e segmento. Fontes de outra revisão/editoriais indisponíveis não recebem conteúdo substituto nem alegação de aprovação. Falas factuais sem fonte não são apresentadas como transições. Referências ausentes e continuidade não registrada ficam explícitas; critérios não usam marca de aprovado. Total de duração desconhecido não vira soma parcial ou zero. Conteúdo omitido do briefing também é apresentado.

## Evidências

- `npm run verify`: 73 testes aprovados (18 contratos, 26 infraestrutura, 23 pipeline, 6 web), tipos e build aprovados. Quatro novas regressões cobrem overrides/revisões, bloqueios, snapshot divergente e fonte editorial/ausente. Após os ajustes finais de apresentação, tipos, seis testes web e build passaram novamente.
- Navegador com API/PostgreSQL locais: produção `02b827ac-df24-45ba-9429-a36d3b31a65a`, revisão 6, dossiê revisão 1, fonte/perfil revisão 1. Expansão da fonte e direção confirmou dados existentes. Não se criou produção extra nem se fez nova chamada OAuth/gasto de mídia para esta verificação.
- Criação com artigos/perfis reais: seleção, campos avançados, duração negativa bloqueada e duração 75 habilitando submit. Teste responsivo em viewport 360 px: ambas as telas sem overflow horizontal; clientWidth e scrollWidth medidos em 345 px com scrollbar. Viewport restaurado ao finalizar. Inspeção funcional não equivale a auditoria completa de acessibilidade.
- [Criação integrada](evidencias/ag-05-integrado.jpg) e [dossiê integrado](evidencias/ag-06-integrado.jpg).

Serviços locais foram reiniciados com o cluster existente para a conferência. Componentes AG-07 continuam fora desta entrega. O próximo trabalho é receber/revisar AG-07 e integrar acompanhamento, mantendo o piloto audiovisual como dependência de geração real.
