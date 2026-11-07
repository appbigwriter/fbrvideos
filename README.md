# FBRVideos

Aplicação local para adaptar artigos em vídeos com identidade/personagem, planejamento rastreável, geração por fornecedores, revisão localizada, montagem e exportação.

## Estado

Implementação técnica verificada em ensaio sintético. Piloto audiovisual, configuração/autorização das contas reais, calibração de qualidade e aceite de produto continuam pendentes. Ver [entrega de 29/10/2026](docs/arquitetura/entrega-fechamento-2026-10-29.md) e [tasklist atualizada](docs/tasklist-fechamento-2026-10-28.md).

## Executar localmente

Pré-requisitos: Node.js `>=24.11.1 <25`, npm, PostgreSQL e executáveis FFmpeg/FFprobe acessíveis no PATH.

1. Execute `npm ci`.
2. Configure um arquivo `.env` privado conforme `.env.example`, incluindo `DATABASE_URL` e o caminho de mídia. Não sobrescreva uma configuração existente.
3. Inicie PostgreSQL (`npm run dev:db` para cluster local de desenvolvimento, ou a instância escolhida). Confirme a porta da conexão configurada.
4. Execute `npm run db:migrate` antes de iniciar API/worker. Faça backup antes de migrar uma instalação com dados.
5. Para ensaio com arquivos sintéticos, configure **API e worker** com `FBR_GENERATION_MODE=synthetic`. `simulated` conserva o simulador legado de jobs e não produz a mídia necessária à jornada integral.
6. Execute `npm run dev:api`, `npm run dev:worker` e `npm run dev:web` em terminais separados. Acesse o frontend em `http://127.0.0.1:5173`.

O planejador `extractive` preserva texto literal e suas limitações. `codex_oauth` exige executável nativo configurado e sessão própria autorizada. Uma produção não comprova qualidade por usar OAuth ou por terminar tecnicamente.

O script `tools/local-operations.ps1` oferece `start`, `stop` e `diagnose` para operação local gerenciada; preserva processos de outros projetos. Ver [runbook local](docs/arquitetura/operacao-tasklist-2026-10-06.md).

## Primeiro uso

Cadastre personagem/Bible, importe artigo e confirme fonte/autoria, cadastre referências e anexe mídia, crie perfil e execute uma produção de calibração. Acompanhe a geração, revise os candidatos e o vídeo, solicite correções localizadas e aprove a versão final antes de exportar.

Produção recorrente automática exige perfil efetivamente calibrado, política versionada e avaliadores server-side com evidências. A habilitação usa a decisão de calibração persistida; não se obtém status validado pelo cadastro genérico. Sem evidência suficiente, a execução pede intervenção. A revisão final humana continua obrigatória.

## Verificar

```powershell
npm run verify
```

Inclui tipos, contratos, infraestrutura, pipeline, interface, ferramentas do piloto e build. Dois casos exigem `TEST_DATABASE_URL` apontando para um PostgreSQL **de ensaio**, separado dos dados reais.

`node tools/closure-smoke.mjs` constrói imagens e cria recursos Docker temporários identificados: roda PostgreSQL nativo, testa API/worker e serve o frontend com certificado TLS temporário. Não lê o `.env` do projeto nem usa contas de fornecedores. Retém logs no diretório temporário informado e remove somente os próprios contêineres/rede/chave TLS.

## Implantação, backup e piloto

- [Pacote de implantação local/contêiner e restauração](docs/arquitetura/implantacao-fechamento-2026-10-28.md).
- [Instrumentos de evidência do piloto real](docs/piloto/fechamento-operacional-v0.1.md).
- [Requisitos e aceites](docs/matriz-aceite-fechamento-2026-10-28.md).
- [Fronteira com FlowRouter](docs/arquitetura/fronteira-flowrouter-v0.1.md): integração futura opcional, fora da versão atual.

Migrações atuais até **016**. Backup completo atual **fbr-metadata-13**, com leitura dos formatos 5–12. Upload de referência: até 20 MB por arquivo; ingestão/probe/render de geração: até 100 MB por input. Não confundir esses limites com o suporte de streaming/leitura a arquivos maiores. Descarte automático de mídia permanece desativado.
