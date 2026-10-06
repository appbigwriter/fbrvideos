# S1-B01 — ingestão e configuração versionada

Data: 4 de outubro de 2026. Estado: **código, migração, API e contratos entregues; validação no PostgreSQL nativo local e HTTP real concluída**. AG-02/03/04 foram acionados pelo responsável. Não conclui o gate inteiro S1, a integração de telas S1-A01 ou o piloto audiovisual. Validação em outro ambiente de deployment permanece fora desta entrega.

## Implementado

- Comandos estritos de criação/revisão para artigos, personagens/Bibles, referências e perfis, em `packages/contracts/src/configuration.ts`. Exports aditivos preservam contrato 0.1.0 e AG-01.
- PostgreSQL: heads + revisões JSONB imutáveis, Bibles originais imutáveis e deduplicação de comandos. Migração transacional em `packages/infra/migrations/001_configuration.sql`; triggers impedem update/delete de revisões e Bibles.
- Mesma conexão durante transações; command_id/fingerprint impedem replay com dados diferentes. expected_version/CAS impedem perda de atualização. Erro faz rollback; criação de revisão preserva todos os registros anteriores.
- Serviço de configuração em `packages/domain/src/configuration.ts`: hash, trechos da fonte, associação explícita autora/personagem confirmada e referências de versões existentes. Original do Bible fica no banco; interpretação é separada. Não importar automaticamente o Bible de Tara sem confirmação editorial da interpretação.
- Ingestão manual e URL com recaptura. URL sempre chega incomplete até revisão humana; extração insuficiente oferece colagem. Alterações criam nova revisão, sem substituir snapshots já fixados.
- Fetch HTTP/HTTPS com endereço público validado em todos os resultados DNS, IP fixado no socket, TLS para hostname original, redirects validados, sem credenciais/portas alternativas, prazo de 12 s e corpo até 2 MB. Não executa JS nem busca subrecursos. Charset de saída tratado como UTF-8; páginas dinâmicas/codificação não suportada requerem colagem/correção. Imagens da fonte são metadados com direito desconhecido, sem download ou autorização implícita.
- API Fastify local em `apps/api/src/app.ts`: listas/filtros, revisão exata, cadastro/revisão, captura/recaptura e leitura textual do Bible. Schemas validam entradas/saídas; erros legíveis sem dump de payload/segredos. Host/Origin limitados a loopback/dev; ainda sem autenticação de deployment.
- Compose de PostgreSQL local, comandos db:migrate/dev:api e testes incluídos em verify.

## Endpoints

| Método/caminho | Contrato / comportamento |
|---|---|
| GET /health | Estado técnico e contrato |
| GET /api/articles | q/source_author/character_id/status, offset >= 0, limit 1–100; ArticleListSchema |
| GET /api/universe | UniverseSchema com personagens/referências |
| GET /api/characters, /api/references | items validados pelos schemas das entidades |
| GET /api/profiles | ProfilesSchema |
| GET /api/{articles,characters,references,profiles}/:id?version=N | Última revisão ou revisão exata; 404 se ausente |
| POST /api/{articles,characters,references,profiles} | Save*Schema; expected_version=null; criação |
| POST /api/{articles,characters,references,profiles}/:id/revisions | Save*Schema; expected_version obrigatório positivo; CAS |
| POST /api/articles/import-url | ImportUrlSchema; captura revisável incompleta |
| POST /api/articles/:id/refresh | RefreshArticleSchema; nova captura incompleta; sem fetch no replay |
| GET /api/bibles/:hash | Original text/plain, hash exato e nosniff |

Salvar exige command_id único por intenção, reason e data completos. Repetir mesmo comando devolve o mesmo resultado; editar é nova intenção/chave. IDs/created_at/author/version vêm do servidor. Erros de forma 400, ausente 404, conflito 409, inelegibilidade 422, corpo excessivo 413; falha interna não expõe exceção. Headers Host/Origin indevidos retornam 403.

## Limites de cadastro nesta entrega

Referências podem ser cadastradas como pending/archived e perfis como draft/calibrating/suspended. A API não permite inventar aprovação de referência ou validação de perfil sem workflow/evidência. Assets reais/upload não foram implementados: asset_refs não vazios são bloqueados. Uma referência vocal cadastrada não comprova acesso, qualidade ou integração. Bible, referência e perfil podem orientar planejamento, mas geração depende dos gates e capacidades posteriores.

## Como executar localmente

1. Com Docker Desktop ativo, executar `docker compose up -d postgres` na raiz. O volume preserva os dados; não executar comandos de remoção de volume para reiniciar o trabalho.
   Alternativa usada neste Windows: `npm run dev:db` inicia PostgreSQL **nativo** em 127.0.0.1:55432, com cluster persistente em `var/postgres-native`, bancos fbr e fbr_s1_test. Não instala serviço nem cria usuários do SO. Usa embedded-postgres 18.4.0-beta.17 somente em desenvolvimento, com binário PostgreSQL 18.4; não é PGlite. Se `.env` não existir, cria DATABASE_URL local; se existir, preserva seu conteúdo. Não executar duas instâncias dev:db sobre o mesmo cluster.
2. Copiar `.env.example` para `.env` somente se ainda não houver arquivo e configurar DATABASE_URL para o PostgreSQL local. A senha publicada é apenas desenvolvimento; não usar em deployment.
3. Executar `npm run db:migrate`, depois `npm run dev:api`. A API recusa host público nesta etapa. `npm run dev:web` abre o shell integrado, ainda sem controllers de cadastro conectados.
4. No Windows deste workspace, se o wrapper npm falhar, usar `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"` com os mesmos argumentos.
5. `npm run verify` executa tipos, contratos, S1, rotas/fixtures e build. Para testar no PostgreSQL de destino, definir TEST_DATABASE_URL para **banco dedicado de ensaio**, executar test:s1 e registrar evidência. O teste cria registros fictícios e triggers nesse banco; não usar banco de produção.
6. `npm run test:live`, com API ativa, cria dados sintéticos em fbr e registra IDs em `var/s1-http-evidence.json`. Após reiniciar a API, definir `SMOKE_VERIFY_EXISTING=1` e executar test:live para verificar a revisão atual e a original. Esses dados estão identificados como sintéticos; não representam o piloto. Ctrl+C encerra a API e o processo dev:db sem intenção de remover o cluster.

## Evidências e pendências

- Typecheck e build passaram; suite original de 17 testes de contrato preservada.
- A primeira rodada de 12 testes S1 usou PGlite. Nesta continuação, a suíte passou novamente com pg/Pool e PostgreSQL nativo 18.4 no banco dedicado fbr_s1_test, incluindo duas edições concorrentes em conexões independentes. O teste específico de disco/reabertura segue usando PGlite; a persistência nativa foi confirmada por leitura HTTP após reiniciar a API. O teste de busca passou a usar título único por execução, permitindo repetir a suíte sem apagar o banco.
- Dois testes web passaram: onze rotas AG-01 apresentam página correta/um H1 e fixtures de AG-02/03/04 validam os contratos/seleção exata.
- Capture HTTPS real de https://example.com funcionou: título Example Domain, 156 caracteres e autoria marcada como não identificada. É smoke técnico, não artigo/piloto FBR nem validação universal de extração.
- Serviço Docker não pôde ser iniciado neste Windows. A alternativa nativa em 55432 recebeu a migração e respondeu ao driver pg; `SELECT version()` confirmou PostgreSQL 18.4 x86_64-windows. API contínua em loopback3001 passou em cadastro/replay, CAS concorrente com respostas 200/409, Bible original, erros 400/403/404, catálogo e diagnóstico bloqueado. Leitura depois de reiniciar a API preservou a revisão atual e a anterior. Evidência de smoke local em var/s1-http-evidence.json; não houve teste em banco de produção.
- Verificação completa após [S1-C01](s1-c01-entrega-v0.1.md): 40 testes passaram, typecheck/build passaram. Catálogo e checagem audiovisual são diagnósticos sem geração.
- AG-01 recebido, revisado e conectado às rotas/CSS; testes de render estático não demonstram layout/teclado em navegador. QA visual humana continua pendente.
- Sem geradores, fila de produção, API Higgsfield/HeyGen, mídia paga ou perfil validado. Auth/deployment, AssetStore e workflows de aprovação continuam no backlog.

## Próximas liberações

[AG-02/03/04](../ux/antigravity-s1-pacotes-v0.1.md) foram recebidos e INTEGRADOS tecnicamente em [S1-A01/S2-B01](s1-a01-s2-b01-entrega-v0.1.md). Controllers usam API real. [S2-C01 parcial](s2-c01-planejador-v0.1.md) agora executa planejamento extrativo; AG-05/06 PRONTOS com handoffs. Planejamento semântico, gate audiovisual e QA humana permanecem pendentes.

## Fontes técnicas

[node-postgres: transações](https://node-postgres.com/features/transactions), [PostgreSQL: SELECT/locks](https://www.postgresql.org/docs/current/sql-select.html), [Node 24 HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html), [Node 24 DNS](https://nodejs.org/docs/latest-v24.x/api/dns.html), [Cheerio](https://cheerio.js.org/docs/intro/), [PGlite](https://pglite.dev/docs/). Versões resolvidas em package-lock.json. PGlite é dependência de teste; a API usa pg/PostgreSQL conforme ADR-002.
