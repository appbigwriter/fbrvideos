# S1-C01 — catálogo e configuração audiovisual

Data: 4 de outubro de 2026. **Base técnica implementada e verificada; aceite audiovisual e gate completo S1 pendentes.** Continuação autorizada enquanto o Antigravity executa AG-02/03/04. Os arquivos desses pacotes foram preservados.

## Entrega

`@fbr/pipeline` implementa catálogo inicial, validação de configuração e adapters simulados. Contratos aditivos em `packages/contracts/src/pipeline-catalog.ts` preservam versão 0.1.0 e os props dos handoffs. Não há SDK de geração, chamada paga, arquivo de mídia produzido ou aprovação automática.

O catálogo contém cinco receitas: explicação, lista de recomendações, reflexão/opinião, relato pessoal e tutorial demonstrativo. As quatro primeiras são candidatas; tutorial permanece experimental. Relato pessoal exige validação editorial dos trechos no planejador futuro. Não basta escolher uma classe para inventar experiências ou demonstrações. Cada receita fixa funções narrativas e classes possíveis. São receitas versionadas de preparação, sem escolha final do piloto.

As seis classes do contrato possuem rotas, requisitos de referência, restrições e alternativas. As alternativas respeitam o repertório do perfil; em modo recorrente também exigem escopo de evidência. A resposta preserva a exigência de revisão da direção: encontrar uma alternativa não autoriza trocar a função narrativa nem executar um job automaticamente.

O snapshot de modelos é inicial e extensível, não um inventário completo da plataforma. Candidatos sem schema revisado permanecem visíveis. Cada operação registra fonte/data de revisão, parâmetros, suporte conhecido/desconhecido, requisitos, acesso da conta, implementação e evidências. Nenhum modelo está com acesso confirmado ou adapter real implementado; o registro de calibrações está vazio.

## Rotas e fontes revisadas

| Operação candidata | Alcance desta implementação |
|---|---|
| [Soul Standard — imagem](https://open.higgsfield.ai/models/higgsfield-ai/soul/standard/api-reference) | Regras do schema texto/estilo. Não assume suporte a referências de identidade nem composição. |
| [Seedance 2.0 — texto para vídeo](https://open.higgsfield.ai/models/bytedance/seedance-2.0/text-to-video/api-reference) | Regras de duração, resolução e aspecto. Política FBR exige `generate_audio=false` explícito para apoio. |
| [Seedance 2.0 — imagem para vídeo](https://open.higgsfield.ai/models/bytedance/seedance-2.0/image-to-video/api-reference) | Regras específicas de imagem inicial/final e duração. Não aceita campos do schema texto para vídeo indiscriminadamente. |
| [HeyGen — áudio para avatar](https://developers.heygen.com/audio-to-video) | Subconjunto conservador com avatar e áudio externo; não substitui narração por script/voice_id. Look/engine ainda dependem de acesso e ensaio. |
| Voz HeyGen e outros candidatos do [catálogo Higgsfield](https://open.higgsfield.ai/explore) | Permanecem candidatos; schema específico/acesso/qualidade não confirmados. |

Não foram fixadas tarifas nem modelo vencedor. Revisão documental não demonstra fidelidade, continuidade, sincronismo ou custo real.

## Validação e fronteiras

`validateModelRequest` rejeita operação/rota divergente, campo desconhecido, tipo/enum/limite inválido, referência sem suporte e ausência de entradas versionadas. URL fornecida não substitui asset fixado. URLs devem ser HTTPS sem credenciais; essa validação não realiza fetch nem substitui o futuro resolvedor de assets/URLs assinadas. O schema pode reconhecer referências sem demonstrar que a operação conserva identidade.

`checkAudiovisualConfiguration` combina elegibilidade artigo/perfil com revisão exata da personagem/Bible, voz oficial, referências, repertório, receita, formato e operações. Referências devem estar aprovadas, com direitos e assets declarados. A operação deve ter schema revisado, acesso verificado e adapter real. Em modo recorrente exige registro de evidência associado ao perfil/receita/operação/revisão, classes do artigo, formato e classes visuais aplicáveis. Strings de evidência escritas no perfil não criam calibração no registro do servidor.

Essa checagem é diagnóstico de preparação. Não resolve arquivos/avaliações de assets, não confere hash no AssetStore e não reserva orçamento. Esses passos, a fixação dos modelos no snapshot da produção, autorização do ensaio e geração real pertencem às stories seguintes. Não há endpoint que aprove perfil/evidência. Os cadastros atuais continuam permitindo somente perfil draft/calibrating/suspended e referência pending/archived.

## API local

- `GET /api/pipeline/catalog`: catálogo técnico completo deste snapshot, incluindo candidatos não verificados.
- `POST /api/profiles/:id/audiovisual-check`: diagnóstico, sem gravação nem geração; usa `AudiovisualCheckRequestSchema` e retorna `EligibilitySchema`.

Body da checagem: `profile_version`, `article:{id,version}`, `mode:calibration|recurring`, `article_class`, `format` e `model_operations` com IDs do catálogo. Formato canônico nesta etapa: `larguraxaltura@fps`, por exemplo `1920x1080@24`; deve coincidir com o delivery do perfil. Revisão ausente retorna 404; body inválido 400. O servidor carrega personagem e referências nas revisões fixadas, sem trocar pela última versão.

## Simulações e evidências

Cinco adapters em memória exercitam áudio, imagem, avatar, animação e render. Submit valida parâmetros e deduplica chave/attempt; a mesma chave com dados diferentes gera conflito. Query progride queued → running → succeeded, preservando snapshots retornados. Cancelamento só ocorre em queued e seu replay é estável. Tentativa nova é um job distinto. Não há autorização de retry, contador de orçamento ou execução real nesta camada.

Jobs trazem provider `simulation`, nenhum output asset e custo zero. `succeeded` significa ciclo simulado terminado, não mídia gerada/aprovada. Estado desaparece ao reiniciar: persistência/fila real ainda não implementadas.

Verificação: 17 testes de contrato, 12 de S1, nove de pipeline e dois web passaram; typecheck e build passaram. A suíte S1 usou PostgreSQL 18.4 nativo por `TEST_DATABASE_URL`; o teste específico de disco/reabertura continua PGlite. Smoke HTTP real confirmou endpoints, bloqueios e persistência após reiniciar a API. Detalhes do ambiente em [S1-B01](s1-b01-entrega-v0.1.md). Aviso já conhecido do bundler sobre `use client` em React Router não bloqueia build.

## Continuação

Atualização: AG-02/03/04 INTEGRADOS tecnicamente em S1-A01/S2-B01. [S2-C01 parcial](s2-c01-planejador-v0.1.md) implementa extração e planejamento estático automáticos, com fontes e bloqueios; verificação atual passou com 55 testes, tipos/build e infra nativa. AG-05/06 PRONTOS para apresentação pelos handoffs específicos. Planejador semântico, piloto S0-C01, QA humana e gate S2 permanecem pendentes antes de consolidar fornecedores e integrações reais S3.
