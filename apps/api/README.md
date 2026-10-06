# API FBR — S1

API Fastify local para ingestão e configuração versionada. `app.ts` é testável por injeção;
`server.ts` conecta PostgreSQL por DATABASE_URL e verifica migração antes de escutar.

Ver [S1-B01](../../docs/arquitetura/s1-b01-entrega-v0.1.md) para endpoints/setup e limites.
Executar db:migrate antes de dev:api. Ainda não publicar a API: autenticação de deployment
e ownership por usuário/tenant pertencem à implementação posterior. S1 admite operador local.

AG-02/03/04 recebem somente apresentação. Controllers que conectam callbacks à API,
resolução de conflitos e mapeamento de formulários permanecem sob integração aqui.
