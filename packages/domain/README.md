# Domínio — B

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../../docs/arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


S1-B01 implementa ConfigurationService, portas de leitura/transação, validação de vínculos,
revisões e elegibilidade da fonte em `src/configuration.ts`. S2-B01 implementará produções.
Não depende de React, Fastify, pg-boss ou fornecedor. DTOs públicos vêm de `@fbr/contracts`.

Entrega e limites: [S1-B01](../../docs/arquitetura/s1-b01-entrega-v0.1.md).

## Política de fornecedores

A candidatura Higgsfield não altera regras: catálogo disponível difere de repertório calibrado; job concluído difere de asset aprovado; estimativa difere de gasto confirmado; cancelamento local não comprova interrupção externa. Adapters continuam fora do domínio.
