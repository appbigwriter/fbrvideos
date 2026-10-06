# Continuação S4/S5 — 6 de outubro de 2026

Atualização posterior: [continuação autônoma de S2–S6](continuacao-sprints-autonomas-2026-10-06.md). Comparação, edição de fala, executor provisionado, legendas e integração AG-08/09 foram acrescentados; o retrato abaixo é anterior a essas entregas.

Implementação em andamento; as sprints não receberam aceite integral.

Entregas de código nesta rodada:

- Contratos, fixtures e handoffs AG-08/AG-09 prontos para apresentação isolada. Nenhuma atribuição externa foi enviada.
- Páginas de revisão/entrega conectadas a APIs; player, cena/timecode, apontamentos e resolução com justificativa.
- Persistência imutável de apontamentos, comandos idempotentes e proteção de revisão/hash/ownership.
- Aprovação integral explícita: nova revisão de metadados conserva os bytes assistidos; avaliação/aprovação/dossiê/produção são gravados atomicamente.
- Entrega com manifesto e downloads locais protegidos por produção/revisão, integridade e aprovação atual; preview permanece identificado. MP4 suporta ranges para reprodução.
- Propostas de correção visual preservam áudio; custo desconhecido impede execução. Cancelar proposta preserva histórico e decisão independente do apontamento.
- Serviço interno de montagem usa áudio medido e FFmpeg, mantém intenção antes do render e publica mídia/timeline/dossiê/produção atomicamente. Replay não duplica render/evento.
- Migrações 006–008 e backup formato 8, preservando leitura dos backups 5/6/7.

Verificação: tipos e dois testes novos de UI passaram; cinco cenários de revisão/montagem passaram em PGlite e PostgreSQL nativo, incluindo MP4 sintético real. O ajuste de teste da contagem numérica/string do PostgreSQL foi corrigido e os cinco cenários nativos passaram novamente. `verify` global passou: 106 casos, 104 aprovados e dois exclusivos de PostgreSQL nativo omitidos em PGlite; tipos/build aprovados. Migrações 006–008 foram aplicadas no aplicativo e a API foi reiniciada com o novo código. Conferência de navegador desta rodada permanece pendente. Log: `var/verify-s4-s5-night.log`.

## Estado das sprints

- S0: fundação entregue; S0-C01 piloto audiovisual pendente.
- S1: base técnica concluída, com QA humana pendente.
- S2: criação/dossiê/planejador implementados; avaliação editorial em corpus real e aceite humano pendentes.
- S3: fila, custos, retomada e acompanhamento implementados; adapters reais, estimativa/cobrança da conta e ciclo de upload/download/callback pendentes.
- S4: implementação técnica de montagem/revisão avançada nesta rodada; validação integral, mixagem/lip sync e mídia real de fornecedores pendentes.
- S5: impacto/proposta/cancelamento/aprovação/exportação implementados; executor de regeneração, autorização do custo conhecido, comparação/edição de fala e pacote completo de legendas pendentes.
- S6: backup/restauração e recuperação de conexão implementados; jornada integral, segurança/deployment, observabilidade, retenção e calibração repetida pendentes.

Insumos do piloto continuam ausentes: artigo completo, referência visual, voz/avatar, acesso e teto. Nenhuma geração paga ou aprovação humana real foi fabricada. Essa dependência não bloqueia os demais incrementos técnicos.
