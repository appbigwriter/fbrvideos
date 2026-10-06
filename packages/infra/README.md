# Infraestrutura — B

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../../docs/arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Adapters PostgreSQL, pg-boss, fila com reservas, AssetStore local, persistência de mídia, render local,
manifestos e backup/restauração de metadados implementados como bases técnicas. Bibles originais são preservados no PostgreSQL.
Nunca expor credenciais nem URLs permanentes de assets privados no contrato de UI.

Ver [entrega S1-B01](../../docs/arquitetura/s1-b01-entrega-v0.1.md) para setup, endpoints e limites de testes.

## Integração planejada

Journal e reservas persistem a intenção antes do envio. Higgsfield real, upload/download e cobrança continuam pendentes do piloto. Segredos e URLs assinadas ficam fora dos DTOs/logs. Ver [registro](../../docs/arquitetura/s3-fundacao-2026-10-05.md) e [runbook](../../docs/arquitetura/operacao-local-v0.1.md).
