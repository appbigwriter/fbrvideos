# Contratos FBR Videos — v0.1.0

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../../docs/arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Importar schemas, tipos, rotas e portas de `@fbr/contracts`; importar dados sintéticos de `@fbr/contracts/fixtures`. A API aplica `.parse`/`.safeParse` às entradas e saídas na fronteira. Não importar implementações de `packages/domain` ou SDKs no frontend.

`schemas.ts` contém Artigo, Personagem/Bible, Referência, Perfil, Produção, Dossiê, Bloco/Fala/Fonte, Plano, Asset, Job, Avaliação, Timeline, Aprovação, Correção e Manifesto. `presentation.ts` projeta rotas, rótulos, eligibility, ações e exportação. `ports.ts` descreve comandos e adapters/armazenamento/repositórios. `fixtures.ts` demonstra preparação, revisão, fonte incompleta, falha, teto de custo, correção e entrega fictícia.

S1-B01 acrescenta `configuration.ts` (comandos de cadastro/revisão e listas), `configuration-ui.ts`
(props/callbacks/labels controlados para AG-02/03/04) e `configuration-fixtures.ts` (dados sintéticos),
reexportados nos mesmos entrypoints. `CONTRACT_VERSION` permanece 0.1.0; exports existentes preservados.
Ver [pacotes liberados](../../docs/ux/antigravity-s1-pacotes-v0.1.md) e [entrega S1](../../docs/arquitetura/s1-b01-entrega-v0.1.md).

Objeto válido não comprova fidelidade factual, qualidade estética, arquivo existente nem integração de fornecedor. Verificações cruzadas ficam no domínio (`inspectDossier`, `productionApprovalValid`); banco, scheduler e avaliação humana precisam produzir evidência nas próximas stories.

Rodar `npm run typecheck` e `npm run test:contracts` na raiz. No Windows desta sessão, usar `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run test:contracts` porque o npm no PATH estava quebrado. O tsx requer execução fora do sandbox restrito após aprovação (`uv_os_get_passwd` falhou antes dos testes). Ver decisões e limites em `docs/arquitetura/s0-b01-decisoes-v0.1.md`.

## Compatibilidade Higgsfield

Contrato 0.1.0 preservado. GenerationAdapter admite imagem/animação candidatas Higgsfield e rotas separadas de áudio/avatar. Capabilities dependem de operação e evidência; não marcar accepts_official_audio ou avatar pelo som nativo. Campos específicos de idempotência, conta/ownership e projeções de conexão serão concretizados nas stories responsáveis, sem schemas paralelos nesta revisão.
