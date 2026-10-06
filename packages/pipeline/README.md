# Pipeline — C

Base S1-C01 implementada: `src/catalog.ts`, `src/validation.ts`, `src/simulated-adapter.ts`.
Ver [entrega e limites](../../docs/arquitetura/s1-c01-entrega-v0.1.md). `npm run test:pipeline`
verifica catálogo, bloqueios, repertório/escopo e ciclos simulados sem mídia/custo.
API local publica catálogo e diagnóstico; nenhum adapter real está implementado e nenhuma calibração foi registrada.

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../../docs/arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Planejador, catálogo, validação de capacidades e montagem. Contratos públicos de adapters
estão em `@fbr/contracts`. SDKs, prompts e FFmpeg permanecem internos. Integrações reais
dependem do gate S0-C01.

## Rotas candidatas

Higgsfield: imagem e animação de apoio, conforme schema/capabilities por operação. Voz oficial/avatar: separados, com candidato HeyGen. Preservar catálogo técnico e habilitar somente repertório calibrado por perfil. Montagem mantém áudio oficial e assets persistidos. Ver decisão de integração para critérios do piloto e limites; adapters reais não implementados.
