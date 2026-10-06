# Integração Higgsfield — decisão de planejamento v0.1

Data: 4 de outubro de 2026. Decisão aceita pelo responsável: incluir Higgsfield como candidata ao piloto de imagens e cenas de apoio. Integração, acesso da conta, qualidade e custos reais ainda não foram testados. Esta revisão complementa os documentos v0.1; não altera o contrato executável 0.1.0 nem conclui gates.

Continuação técnica: [S1-C01](s1-c01-entrega-v0.1.md) implementa catálogo por operação, validação e adapters simulados.
Schemas públicos foram revisados; acesso da conta, qualidade, tarifas do ensaio e integrações reais continuam pendentes.

## Escopo e precedência

O FBR Videos transforma artigo + perfil em roteiro rastreável, direção, assets, montagem, revisão localizada e entrega. A Higgsfield fornece operações de geração dentro desse processo. O app mantém React/Vite, Fastify, TypeScript estrito, Zod e workspaces npm, com PostgreSQL/pg-boss e AssetStore conforme decisões S0-B01.

Aplicar o caminho de aplicação existente do material fornecido. Não criar outro app, migrar para Next.js ou substituir a jornada pelo template Studio. O template pode orientar a integração, mas não define nossa interface, persistência ou autorização. A documentação do produto prevalece sobre instruções genéricas de scaffold.

## Responsabilidades por rota

| Etapa | Candidato / responsabilidade | Evidência exigida |
|---|---|---|
| Ingestão, roteiro e direção | FBR: fontes, Bible, receita, planos e referências versionadas | Fidelidade editorial e planos dentro do repertório |
| Imagem e composição | Higgsfield, modelo/operação a selecionar | Schema, referências/composição suportadas e identidade avaliada |
| Apoio animado | Higgsfield, imagem→vídeo/referências conforme operação | Imagem aprovada, ação, continuidade, duração e custo avaliados |
| Voz oficial | Rota separada; candidato HeyGen conforme voz/engine | Áudio aprovado, identidade, idioma, pronúncia e alinhamento |
| Avatar | Candidato HeyGen com áudio oficial aprovado | Acesso real, look/engine, identidade e lip sync |
| Montagem e legendas | FBR com timeline declarativa e FFmpeg | Uma voz principal, tempos efetivos, arquivos e versão revisados |
| Correção e entrega | FBR: dependências, orçamento e aprovação humana | Preservação dos derivados válidos e exportação do render aprovado |

HeyGen para apoio permanece como alternativa documental, sem seleção automática. Não substituir voz/avatar por áudio nativo da Higgsfield sem experimento e decisão registrados. Receber áudio como referência ou gerar som não demonstra preservação do áudio oficial nem sincronização labial.

## Catálogo e capacidades

Preservar modelos instalados e escolhas existentes. Não remover ou ocultar modelos por ausência de documentação ou teste. Separar catálogo técnico disponível do repertório habilitado em cada perfil: produção recorrente usa somente rotas/modelos/classes calibrados para seu escopo; itens não verificados ficam identificados para investigação/calibração, sem execução paga automática.

Verificar modelo e operação a partir do catálogo oficial e dos links de sua referência/schema. Fixar endpoint, ambiente, parâmetros e evidências por tentativa. Não assumir campos universais nem trocar modelo ou endpoint silenciosamente. Seedance 2.0 text-to-video documenta duração de 4–15 s e áudio opcional; isso não demonstra avatar com áudio oficial. Clips curtos precisam ser planejados pela duração efetiva da fala e montados pelo FBR.

`GenerationAdapter` mantém submit/query/cancel e capabilities por operação. A Higgsfield inicia como candidata a `image`/`animation`; `audio`/`avatar` só serão declaradas com evidência própria. Limites e campos dependem do modelo/operação; documentar parâmetros omitidos e bloquear requisito essencial não suportado.

## Integração operacional planejada

1. REST no servidor: `https://api.higgsfield.ai` e `Authorization: Key <credencial completa>`. Para credencial da operação, usar variável server-only `HF_API_KEY`, com placeholder vazio quando a integração for implementada. Não copiar automaticamente nomes de variáveis do SDK: seguir sua configuração documentada.
2. Configurações administra a conexão. Se houver chave fornecida pelo usuário, coletar a credencial inteira em um campo de senha; proteger armazenamento server-side. Chave salva, acesso técnico verificado e perfil audiovisual validado são estados distintos. Nunca expor credenciais em navegador, logs, manifesto, exports ou fixtures. Persistência/autenticação devem seguir a arquitetura FBR; cookie do template não é requisito do produto.
3. Salvar comando, intenção/tentativa, parâmetros fixados e `Idempotency-Key` antes do envio; salvar `request_id` e URLs de acompanhamento após aceitação. Mesmo pedido ambíguo usa mesma chave, endpoint, corpo e webhook. Regeneração intencional usa nova chave. Idempotência do fornecedor complementa deduplicação e reconciliação persistentes do FBR.
4. Consultar estado em background com backoff/prazo limitados. Mapear queued/in_progress/completed/failed/nsfw/canceled ao job interno; falha de comunicação permanece unknown até reconciliação. Resultado completed não significa aprovação audiovisual. Usar status_url/cancel_url retornados, validando origem antes de enviar credenciais.
5. Webhooks são opcionais: persistir evento antes do 2xx, deduplicar request_id + estado terminal e conferir resultado por consulta autenticada antes de aplicar transições quando não houver autenticação verificável do callback. A página consultada não especifica assinatura; não inventar verificação criptográfica. Manter consulta como recuperação, inclusive cancelamento.
6. Cancelamento só é elegível enquanto todos os jobs do pedido estão queued. in_progress não pode ser interrompido pela API documentada. Pausa/cancelamento da produção impedem novos envios, mas mantêm reconciliação, arquivos e custos dos pedidos ativos.
7. Pedir upload assinado no servidor; PUT com todos os upload_headers retornados, sem credenciais da API/cookies da aplicação no storage. Usar public_url apenas após sucesso. Não registrar URL assinada; verificar tipos e limites da operação e registrar permissão de uso das referências.
8. Estimar cada pedido com seus parâmetros e conta; reservar custo atomicamente no FBR antes de submeter. Estimativa não é gasto confirmado nem substitui teto/margem. Reconciliar créditos/USD e moeda operacional sem conversão inventada. Documentação informa que failed/nsfw não são cobrados e cancelamento elegível é reembolsado; confirmar lançamentos da conta antes de liberar reservas.
9. Copiar resultados para AssetStore imutável, com hash/metadados e proveniência. A retenção publicada é de pelo menos sete dias; URL do fornecedor não é arquivo durável do FBR. Download interrompido deve ser recuperável dentro dessa janela.

## Plano e aceite

- S0-C01: selecionar operação de imagem e animação na Higgsfield; verificar conta/schema/estimativa; gerar imagem, avaliar, animar uma classe simples e montar avatar → apoio → avatar com voz oficial. Medir identidade, continuidade, ação, áudio, retrabalho, tempo e custo por cena/vídeo aprovado. Gates A–F são do piloto.
- S1-C01: capabilities por operação e distinção entre catálogo técnico, acesso da conta e repertório calibrado. Nenhum modelo final foi escolhido nesta revisão.
- S3-B01/C01: adapters REST, ownership por usuário/tenant ou principal autenticado da operação, fila, idempotência, reconciliação, orçamento, uploads e cópia dos resultados. Verificar propriedade antes de consulta, resultados e cancelamento; histórico do browser não é autorização.
- S4/S5: montagem com áudio oficial, avaliação das transições e correção só visual preservando áudio válido; alteração de fala invalida derivados. Aprovação fica vinculada ao render exato.
- S6: verificar timeout ambíguo, crash após envio, callback duplicado/forjado, cancelamento queued/in_progress, limite concorrente, estimativa indisponível, download interrompido e retomada. Testes de contrato/simulação não validam qualidade do fornecedor.

Aprovar Higgsfield como fornecedora do perfil somente com mídia real, rubrica humana e custo medido no recorte declarado. O gate atual permanece pendente de artigo, referências, voz, acesso e teto. Preparação documental não autoriza despesas nem habilita produção recorrente.

## Fontes consultadas e limites

Consulta pública em 4 de outubro de 2026; sem credenciais ou geração paga. O índice e as páginas de modelo foram consultados na web; páginas operacionais .md foram obtidas por HTTP público após falha de leitura no navegador de pesquisa. Revalidar contratos ao implementar.

- [Índice oficial](https://docs.higgsfield.ai/docs/llms.txt) e [catálogo](https://open.higgsfield.ai/explore).
- [Seedance 2.0 — referência](https://open.higgsfield.ai/models/bytedance/seedance-2.0/text-to-video/api-reference).
- [Kling 3.0 Standard — referência](https://open.higgsfield.ai/models/kling-video/v3.0/std/text-to-video/api-reference).
- [Pedidos e cancelamento](https://docs.higgsfield.ai/docs/concepts/requests.md).
- [Idempotência](https://docs.higgsfield.ai/docs/concepts/idempotency.md) e [erros/retries](https://docs.higgsfield.ai/docs/concepts/errors.md).
- [Webhooks](https://docs.higgsfield.ai/docs/how-to/webhooks.md) e [uploads](https://docs.higgsfield.ai/docs/concepts/file-uploads.md).
- [Estimativa, cobrança e retenção](https://docs.higgsfield.ai/docs/concepts/billing-and-retention.md).

O material fornecido pelo usuário é orientação inicial; capacidades publicadas, acesso autenticado e qualidade aprovada são evidências distintas. Não se confirmou equivalência de voz/avatar, schema de todos os modelos, acesso, preço da conta ou desempenho audiovisual.
