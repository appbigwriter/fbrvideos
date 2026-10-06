# Contrato de apresentação — UX 0.1

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Alinhamento A/B de 4 de outubro de 2026. A fonte executável é `packages/contracts/src`; este documento descreve sua apresentação e os requisitos de interação. API e view models usam `snake_case`. Não definir schemas concorrentes na interface.

Projeção executável publicada: `ProductionViewSchema` / `ProductionView` em `presentation.ts`; `navigation`, `routePaths` e `productionStateLabels` no mesmo módulo, reexportados pelo `index.ts`. IDs de ações existentes: `generate`, `pause`, `resume`, `cancel`, `correct`, `approve`, `export`. Criação usa `CreateProductionRequestSchema`; pausa/retomada/cancelamento/aprovação usam `ProductionCommandSchema`, com `approve_final` e `reviewed_in_full`. Correção, apontamentos e autorização do plano de custo receberão comandos públicos nas sprints correspondentes; AG-01 não os implementa.

`ProfileSummarySchema` contém ref/nome/status/elegibilidade. Os detalhes de personagem, idioma, formato e duração de T04 virão de `ProfileSchema` ou de projeção adicional aprovada em S1/S2. O shell de AG-01 não presume que esses campos já existam no summary.

## Entradas necessárias

S1-B01 publica comandos/listas em `packages/contracts/src/configuration.ts` e props/callbacks
de AG-02/03/04 em `configuration-ui.ts`, reexportados por `@fbr/contracts`. As fixtures novas
são reexportadas por `@fbr/contracts/fixtures`. Os handoffs S1 são autoridade concreta para
componentes de artigos, universo e campos controlados; não substituem comandos futuros de produção.

| Entrada | Apresentação e invariantes de UX |
|---|---|
| `article` / referência `{id, version}` | Título, autoria, origem e revisão explícitas; versões fixadas na produção não são atualizadas por consulta à origem |
| `profile` / referência `{id, version}` | Nome, personagem, idioma, formato e duração-alvo; escopo/estado de validação; perfil de calibração identificado |
| `eligibility` | `{allowed, calibration_only, blockers:[{code,message,next_action,required}]}`. Renderizar impedimentos recebidos; não inferir adequação pela aparência da ficha |
| Estado da produção | `preparing`, `producing`, `awaiting_decision`, `paused`, `failed`, `ready_for_review`, `correcting`, `approved`, `exported`, `cancelled`; rótulos em jornada-e-telas |
| Estado da execução e avaliação | Separados do estado da produção. Job concluído não vira aprovação visual; `unknown` não vira falha certa |
| `costs` | `currency`, `estimated_minor` (inteiro ou null), `committed_minor`, `confirmed_minor`, `ceiling_minor`, `safety_margin_minor`; valores em menor unidade monetária, sem floats. Confirmado e comprometido separados; usar formatador monetário apenas na apresentação |
| `actions` | Cada ação tem `{enabled, reason}`. Botão acompanha esse input; motivo visível ao lado quando desabilitado. O servidor revalida o comando; disabled não substitui autorização |
| Etapa e erro/pendência | Causa legível, efeito, ação seguinte, ID, obrigatoriedade e alvo/revisão quando aplicável. Sem percentuais ou ETA gerados pela interface |
| `current_render`, `current_approval` | Identidade e revisão da renderização; aprovação aponta à mesma versão. Mostrar histórico de aprovação anterior sem aplicá-lo à nova versão |
| `pending_issues` | Pendências obrigatórias recebidas impedem aprovação/exportação; critérios estéticos não substituem critérios obrigatórios |
| `correction` | Proposta ID/revisão, produção/render alvo, trecho/plano, afetados/preservados, custo estimado e limite, mudança de fala e necessidade de fidelidade/revisão; disponibilidade de executar vem do domínio |
| `export` | Versão, disponibilidade, arquivos com tipo/nome/estado e ação autorizada; URLs válidas são emitidas pela base técnica, nunca construídas pela UI |

Estimativa null é “Não disponível”. Comprometido é valor ainda reservado/pendente conforme definição de B; não somar duas vezes custos confirmados. Margem segura é exibida como política, e a disponibilidade de executar é recebida, não calculada em componentes. No exemplo BRL, centavos são formatados em reais. A aplicação deve respeitar a unidade monetária da moeda escolhida na implementação do formatador.

## Comandos e eventos de apresentação

Nomes abaixo são intenções de callback, não contratos novos de API. O integrador B/root mapeia cada intenção aos comandos executáveis; AG-01 não implementa esses comandos.

| Intenção | Dados mínimos entregues ao integrador | Feedback |
|---|---|---|
| Abrir artigo/perfil/produção | ID e revisão relevante | Navegação e contexto preservado |
| Criar produção | Artigo+revisão, perfil+revisão, nome, sobrescritas opcionais, request/idempotency key de B | Pendente; sucesso aponta à produção; erro preserva formulário |
| Corrigir origem | ID/revisão base, texto/metadados explicitamente editados | Nova revisão; produção existente mantém a antiga |
| Pausar/retomar/cancelar | Produção e versão do comando de B | Mostrar semântica de jobs externos e resposta de reconciliação |
| Apontar problema | Produção, render/revisão, plano/cena e intervalo, categoria, comentário | Apontamento vinculado; proposta de correção separada |
| Editar fala | Bloco/trecho e revisão base, novo texto | Fidelidade + plano de impacto; não alterar mídia silenciosamente |
| Executar correção | Proposta+revisão, alvo e confirmação do plano/limite | Nova versão em correção; aprovação antiga permanece apenas no histórico |
| Aprovar | Produção/render/revisão, declaração de revisão integral | Resposta da base; só indicar aprovação após confirmação |
| Exportar/baixar | Produção+render/revisão e arquivo recebido | Pacote/URL autorizado; indisponibilidade explícita |

Categorias visuais em T06: “Imagem não corresponde”, “Personagem diferente”, “Ambiente inadequado”, “Movimento estranho”, “Problema na fala/voz” e “Outro”. IDs de categoria são acordados com B/C antes de integração. O protótipo usa labels e IDs locais de fixture, sem impor enum de domínio.

## Comportamento compartilhado

- Carregamento tem texto e preserva contexto. Falha de consulta oferece tentar novamente, sem exibir dados antigos como novos.
- Vazio descreve a ação disponível. Sem integração não habilitar sincronização, upload ou teste externo.
- Ações indisponíveis exibem motivo; conflitos de revisão mostram atualizar/rever, sem sobrescrever versão atual.
- Eventos tardios não atualizam a produção/versão errada. Estratégia de polling e reconciliação pertence a B.
- Só exibir duração, timecode, miniatura ou arquivo quando disponibilizados por contrato. Placeholders do protótipo são identificados como desenho.
- Sem dados essenciais, apresentar pendência, nunca preencher com fato aparente.

## Fixture e revisão

`fixtures/cenarios-v0.1.json` descreve cenários visuais e resultados esperados, com referências fictícias e moedas explícitas. O HTML contém o mesmo conjunto de cenários para funcionar via `file://` sem fetch. Os cenários projetam o domínio; não são dados de produção nem prova de API. Fixtures de domínio de B são autoridade para validação de schema; a equivalência da apresentação deve ser revisada antes de integrar AG posteriores.

## Requisitos futuros de integração

Projetar separadamente conexão (credencial salva/acesso verificado), capabilities documentadas/testadas e repertório calibrado do perfil. Essas projeções serão definidas por B/C; esta revisão não inventa novos campos em ProductionView. Ownership e consulta autenticada são responsabilidades do servidor.

Apresentar inelegibilidade de cancelamento externo quando o pedido iniciou, mantendo custos/resultados reconciliáveis. Não inferir aprovação de completed, custo confirmado da estimativa, suporte de avatar do áudio nativo ou disponibilidade permanente de URL do fornecedor.
