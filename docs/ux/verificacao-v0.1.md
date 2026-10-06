# Verificação — S0-A01 / AG-01

Estado atual em 5 de outubro: [S2-C01 via OAuth](../arquitetura/s2-c01-oauth-v0.1.md)
verificado no navegador com dados sintéticos: produção v6, quatro blocos em
primeira pessoa e planos com fontes v1; consumo de mídia separado da cota OAuth.
Fonte/direção expandidas: [evidência](evidencias/s2-c01-oauth.jpg).
Avaliação humana editorial, mobile e acessibilidade completa permanecem pendentes.
Os registros abaixo preservam as etapas anteriores.

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Data: 4 de outubro de 2026. Escopo: documentação visual e protótipo local em `docs/ux`. Sem fornecedores, gastos, mídia real, persistência ou commits.

## Evidência executada pela frente A

O registro abaixo descreve a preparação S0 anterior ao retorno AG-01. Estado atual: entrega Antigravity
recebida e integrada a AppRoutes/main/CSS; onze rotas passaram no teste de render estático em
`apps/web/test/routes.test.tsx`, com typecheck/build aprovados. Isso não demonstra layout/teclado em
navegador. Ver [entrega S1-B01](../arquitetura/s1-b01-entrega-v0.1.md) e [pacotes liberados](antigravity-s1-pacotes-v0.1.md).

Comando: `node docs/ux/verificar-prototipo.cjs`, executado na raiz do projeto com Node 24.11.1.

Resultado: oito cenários passaram; JSON externo/embutido idênticos e válidos; script executável compila; nenhuma chamada externa no script. A verificação usa DOM mínimo em VM para exercitar o código do HTML e inspecionar HTML emitido. Não é execução em navegador nem prova de layout/acessibilidade assistiva.

| Cenário | Evidência observada |
|---|---|
| Navegação | Doze destinos do protótipo renderizam H1; seis entradas de menu |
| Fonte incompleta | Gerar desabilitado e comando sem efeito; texto vazio não libera; salvar cria revisão 2; produção fixa revisão 2 mesmo com revisão de origem 3 |
| Pausa e retomada | Pausa sinaliza externos em andamento; estado e produção preservados |
| Aprovação/entrega | Entrega bloqueada sem aprovação; checkbox integral habilita somente a versão exibida; mídia real continua indisponível; recibo textual fictício exportável |
| Correção visual | Plano informa derivados/preservados; aprovação ativa invalidada; versão 2 exige revisão; aprovação anterior permanece no histórico; comentário HTML escapado |
| Mudança de fala | Plano explicita áudio, lip sync, legendas, tempos, montagem e fidelidade à fonte |
| Falha conhecida | Nova tentativa apenas de montagem, preservando custo e componentes |
| Limite esgotado | Retomar e gerar desabilitados; comando não inicia simulação de gasto; cancelar preserva custo |

Esses checks verificam a demonstração, não as políticas autoritativas de orçamento, idempotência, aprovação ou render. Essas políticas pertencem à base técnica e serão verificadas em integração.

## Revisão cruzada e liberação técnica

A leu `packages/contracts/src/presentation.ts` e `ports.ts`: rotas, estados, custos, elegibilidade, criação a partir de artigo/perfil e declaração integral alinhados. A apontou possibilidade de `export.available` sem kind e render de tipo errado. B incorporou exigência de tipo render, kind explícito quando disponível e entrega aprovada válida para habilitar a ação export. Preview permanece separado da entrega aprovada.

Root informou typecheck, 17 testes de contrato e build aprovados após as correções. Root confirmou disponibilidade dos seis caminhos permitidos e revisão de coerência do desenho. Em consequência, o handoff local AG-01 foi marcado PRONTO. Não executamos AG-01 nem o marcamos integrado. A fila original não foi editada; o registro de liberação está no handoff.

Gaps acordados para sprints posteriores: T04 precisa de detalhes de `ProfileSchema` ou projeção adicional além de `ProfileSummarySchema`; apontamentos, correção e autorização de custo precisam de comandos públicos em S4/S5. Não bloquearam o shell vazio AG-01.

## Validação humana e visual pendente

Abrir `prototipo-jornada.html` diretamente em navegador e verificar:

1. Jornada principal: Artigos → artigo → criar com perfil → gerar simulado → acompanhamento → pronta para revisão → declarar revisão → aprovar simulado → exportar recibo fictício.
2. Cada opção de cenário: recuperar fonte, falha e limite; corrigir imagem e fala; comparar versão ativa/histórico; tentar entrega antes de aprovar.
3. Teclado: Tab em ordem de leitura, link de pular conteúdo, foco visível, ação desabilitada com motivo e anúncio de resultado.
4. Desktop e viewport de 360 px: sem cortes/rolagem horizontal; menu e custos legíveis.
5. Responsável de produto confirma que não precisou preencher ficha de cena e entendeu o custo, o bloqueio e a versão aprovada.

Essas verificações não foram registradas como realizadas pela frente A. Player, timecode, transcrição e mídia finais exigem ativos reais nas sprints correspondentes. Qualidade humana, receita, formato e fornecedores dependem do piloto.

## Arquivos e limites

A escreveu somente `docs/ux`, incluindo fixtures e comando de verificação. Não escolheu stack, não editou contratos/configuração raiz, app de produção, arquitetura, piloto ou documentos originais. Não houve integração externa ou commits. O workspace não possui repositório Git; usar ownership explícito no AG-01.

Os cenários JSON de UX são descritores de desenho coerentes com enum/eligibilidade/custos de B, não um `ProductionView` completo. As fixtures executáveis de domínio estão em `packages/contracts/src/fixtures.ts`, via `@fbr/contracts/fixtures`. A tentativa opcional de gerar snapshot por `node --import tsx` encontrou erro de runtime `uv_os_get_passwd`; não foi usada como evidência de aprovação e não impede o protótipo standalone.

## Cenários futuros de integração Higgsfield

Na aplicação integrada, verificar chave salva versus acesso/qualidade; estimativa versus custo confirmado; cancelamento queued versus in_progress; modelo não verificado versus repertório validado; mídia copiada versus URL expirada; correção visual preservando áudio. Esses cenários não foram executados no protótipo e não alteram sua evidência histórica.
## Verificação da integração S1-A01/S2-B01

Após retorno de AG-02/03/04, os dez arquivos foram preservados e os controllers conectados à API local.
Navegador real confirmou importação manual, revisão de fonte, leitura de Bible original, cadastro de referência e perfil,
criação de produção, pausa/retomada e histórico. Revisões posteriores de artigo/personagem não substituíram os vínculos fixados.
Valor monetário com três casas decimais foi recusado no formulário sem criar revisão. Formulário de perfil preservou personagem v1
mesmo com v2 disponível; estados e eventos foram reconferidos por HTTP após reiniciar a API.

46 testes, tipos e build passaram; capturas desktop foram inspecionadas. Avaliação humana, auditoria completa de acessibilidade/responsividade
e qualidade audiovisual permanecem pendentes. [Registro detalhado](../arquitetura/s1-a01-s2-b01-entrega-v0.1.md).
# Continuação S2-C01 — inspeção do dossiê extrativo

4 de outubro de 2026: navegador real confirmou produção sintética
`ea955415-9926-4ed5-89a9-ee5e1e525035` em awaiting_decision v5,
após recuperação automática. Fontes e perfil permanecem em v1; trecho fonte
e direção expandem corretamente. Leitura estimada 8,4 s versus alvo 60 s
gera pendência; duração real continua ausente. Consumo confirmado zero,
sem geração, aprovação ou mídia inventada.

Evidência: [dossiê extrativo](evidencias/s2-c01-dossie-extrativo.jpg).
QA humana, acessibilidade completa, avaliação em 360 px e qualidade editorial
real continuam pendentes. AG-05/06 ainda não implementados pelo Antigravity.

