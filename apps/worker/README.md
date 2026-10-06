# Worker de geração

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../../docs/arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


`src/server.ts` conecta pg-boss ao journal PostgreSQL. O transporte leva IDs; intenção, reservas, posse e resultados ficam nas revisões da aplicação. O dispatcher recupera intenções persistidas que não chegaram ao transporte.

Após `npm run db:migrate`, iniciar em PowerShell:

```powershell
$env:FBR_GENERATION_MODE = 'simulated'
npm run dev:worker
```

A execução disponível usa adapters simulados, sem rede de fornecedor, mídia ou cobrança. Reiniciar o simulador perde seus jobs em memória; a fila conserva reserva e sinaliza incerteza quando o job não é encontrado. Journal e pg-boss permanecem persistidos.

Pausa impede novos envios, mantendo consultas ativas. Cancelar libera jobs locais não enviados. Para jobs externos, consultar antes e cancelar somente enquanto queued. Callbacks apenas provocam consulta, sem aplicar payload não autenticado.

## Higgsfield em S3

Adapters reais, consulta por chave após envio ambíguo, estimativa da conta, upload/download e registro de callbacks continuam pendentes. Não habilitar geração real por variável de modo. Ver [registro técnico](../../docs/arquitetura/s3-fundacao-2026-10-05.md) e [runbook](../../docs/arquitetura/operacao-local-v0.1.md).
