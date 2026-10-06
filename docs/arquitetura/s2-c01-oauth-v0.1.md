# S2-C01 — GPT-6.1 Sol via OAuth

5 de outubro de 2026 · **Integração semântica implementada e verificada tecnicamente;
aceite editorial humano e gate S2 continuam abertos.**

Decisão do responsável: `gpt-6.1-sol` com OAuth. Codex CLI 0.159.3 local já
autenticado com ChatGPT; verificação estruturada confirmou acesso ao modelo.
Sem substituição de modelo ou chave da API.

## Autenticação e transporte

`CodexOAuthInference` (`packages/infra/src/codex-oauth.ts`) é uma ponte local
para o executável nativo Codex, conforme uso programático documentado em
[modo não interativo](https://learn.chatgpt.com/docs/non-interactive-mode),
[autenticação](https://learn.chatgpt.com/docs/auth) e
[SDK](https://learn.chatgpt.com/docs/codex-sdk).
O CLI mantém/renova sua sessão. O app não lê/copia tokens, não usa endpoints
internos do ChatGPT e não implementa login próprio. Login independente para
múltiplos usuários/deployment exige outro escopo e registro próprio no
[Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source/sign-in).

Configuração server-side em `.env.example`, já aplicada no ambiente local:

```dotenv
FBR_PLANNER=codex_oauth
FBR_CODEX_EXECUTABLE=<caminho absoluto do executável nativo codex.exe>
```

Login se necessário: `codex login`; diagnóstico: `codex login status`.
Não colocar auth.json/tokens no projeto. Extrator só com configuração explícita
`FBR_PLANNER=extractive`; falha OAuth não aciona fallback silencioso.

Cada inferência usa stdin, processo sem shell, diretório temporário isolado,
sessão efêmera e JSON Schema. Ignora configuração do usuário; fixa modelo/login
ChatGPT. Shell, unified_exec, subagentes e web estão desabilitados; uso de
ferramenta é rejeitado pelo parser. Ambiente contém só variáveis necessárias
ao runtime/login, sem DATABASE_URL/chaves do app. stderr não é encaminhado.
Saída máxima 2 MB, timeout 180 s por chamada; erros sanitizados.

## Planejamento e auditoria

`SemanticPlanner` envia artigo, perfil, Bible original/interpretado e referências
fixadas como dados, nunca instruções. Cria briefing, roteiro em primeira pessoa,
fontes, cenas, continuidade, riscos, critérios e fallback. Preserva a receita
do perfil; não troca receita/perfil/revisão para contornar bloqueios.

Confere hashes, completude, personagem, fontes/versões, repertório/rotas,
função das referências, dependências anteriores e ausência de duração real ou
mídia fictícia. Experiência pessoal exige evidência literal atribuída à autora.
Limites: artigo 30.000 caracteres, Bible 60.000 e 200 trechos; sem truncamento.
IDs dos planos recebem namespace por produção/revisão no servidor.

Uma segunda chamada audita invenções, atribuição de experiências, direção,
Bible, restrições e cobertura. Rejeição/avaliação incoerente bloqueiam conclusão.
Só blocos têm sequence; falas e planos têm ID/ordem na lista. Auditoria é sinal
de modelo, nunca aprovação humana. Dossiês permanecem awaiting_decision com
revisão editorial/gate audiovisual, mesmo com review_script=false.
Não gera voz/imagem/clip/render. Duração proposta não é duração real.

## Recuperação, tentativas e cota

Migração `003_planning_inference.sql` registra intenção antes da inferência.
`PostgresInferenceJournal` deduplica execução, guarda resposta/uso em tokens e
protege evidência terminal contra mutação. Cache exige fingerprint idêntico
de método, prompt e schema, com registro da execução de origem.

Falha/timeout não é repetido automaticamente. Execução ativa de outra instância
é adiada; running sem conclusão por mais de 240 s vira diagnóstico desconhecido,
sem nova chamada. Retomar é explícito e cria nova revisão. Até duas chamadas
novas por tentativa: plano e auditoria, sem loop de reparação. Pausa/cancelamento
impedem novas chamadas e conclusão em revisão antiga; chamada enviada pode
consumir cota. API retorna sem esperar o modelo; recuperação background a cada
5 s. OnClose encerra subprocessos, aguarda tarefas e fecha o banco. A interface
atual usa o botão de atualizar acompanhamento. Não é fila de geração S3.

OAuth usa cota ChatGPT. Zero consumo de mídia não significa zero utilização do
modelo. Tokens de proveniência incluem cache; diário identifica execução
original/reuso. Não converte tokens em preço nem fabrica despesa de mídia.

## Evidências e próximos passos

- `npm run verify`: **62 testes** (18 contratos, 23 infra, 19 pipeline, 2 web),
  typecheck/build aprovados. Infra também verificada no PostgreSQL 18.4 nativo.
- Ensaio real OAuth: produção sintética `02b827ac-df24-45ba-9429-a36d3b31a65a`
  concluiu em v6 com quatro blocos em primeira pessoa, quatro planos e fontes
  artigo/perfil/Bible v1. Duração proposta 15 s versus alvo 60 s permanece pendência.
- Primeira auditoria rejeitou incorretamente ausência de sequence em falas/planos.
  Corrigido o critério, reaproveitado o plano por fingerprint exato e refeita só
  auditoria. Falha/retomada/conclusão preservadas no histórico.
- Testes rejeitam fonte/rota inválida, vivência fabricada, cobertura insuficiente,
  auditoria contraditória, timeout e retry/fallback silencioso.
- [Evidência no navegador](../ux/evidencias/s2-c01-oauth.jpg).

Ensaio sintético comprova transporte/integração, não qualidade em artigos
representativos e Bible real. Mesmo modelo pode errar na auditoria; referência
literal não prova autoria da experiência. Aplicar rubrica humana e piloto
S0-C01 antes do aceite. AG-05/06 PRONTOS com contratos estáveis; integrar
retornos do Antigravity. AG-07–AG-10 não liberados.
