# Entradas para liberar o ensaio

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


**Inventário atualizado em 4 de outubro de 2026:** documentos de planejamento e base de aplicação presentes. O responsável corrigiu a entrada para [04-game-style-tara-lindqvist.md](../fontes/04-game-style-tara-lindqvist.md), Projeto + Character Bible completo, já recebido e preservado; ver `contexto-gamestyle.md`. Ainda faltam artigo real, referência visual aprovada, voz disponível identificada, avatar/look e acesso/teto autorizado. Nenhuma mídia audiovisual foi gerada. Exemplos fictícios dos documentos não contam como artigo ou mídia de ensaio.

A verificação de acesso limitou-se à presença: `.env`, `.env.local` e `.env.production` ausentes; `.env.example` presente; variável `HEYGEN_API_KEY` não definida no processo; comando `heygen` não localizado. Nenhum conteúdo de segredo foi lido ou divulgado. Isto não prova ausência de conta ou acesso em outro ambiente. FFmpeg e FFprobe 9.0 respondem localmente.

## Mínimos externos para começar

O Character Bible já foi recebido. Faltam artigo real completo, referência visual aprovada da personagem, acesso autorizado com voz disponível e teto de custo. Uma referência combinada pode cobrir figurino/ambiente/estilo; o usuário não precisa preparar um arquivo para cada categoria. A amostra vocal é útil, mas não obrigatória quando a identidade vocal disponível é identificada por ID do fornecedor. A equipe propõe receita, direção e defaults técnicos a partir desses insumos, sem exigir que o usuário defina cenas ou codec/fps.

## Checklist de calibração da equipe

| Entrada | Responsável | Aceite para iniciar | Estado |
|---|---|---|---|
| Um artigo representativo | Responsável editorial | Texto completo, origem, autoria, revisão e permissão de uso registradas | Ausente |
| Contexto do blog/personagem | Responsável editorial | Projeto fornecido; não substitui artigo | Recebido: Game Style/Tara; inglês EUA/global |
| Character Bible existente | Responsável editorial | Fonte fornecida pelo usuário, preservada e associada à Tara | Recebido: Parte B do documento completo; hash conferido |
| Referência da personagem e referências adicionais aplicáveis | Responsável editorial + C | Referência combinada válida ou arquivos separados; extras só se a receita precisar | Ausentes |
| Voz candidata e pronúncias | Operador + responsável editorial | Voz disponível por ID ou amostra; validar timbre/idioma no ensaio | Ausentes |
| HeyGen: conta, API e avatar/look ou imagem permitida | Operador de integrações | Credencial configurada fora de chat/logs, consulta autenticada autorizada, IDs e engines disponíveis confirmados | Não verificado |
| Higgsfield: imagem/apoio e uma classe de movimento | Operador + C + responsável editorial | Acesso por operação/modelo, schema, referências, estimativa e alternativa; credencial somente no servidor | Candidatura aceita; acesso e ensaio pendentes |
| Receita, canal, formato e duração-alvo | Responsável editorial | Recorte compatível com artigo e requisitos do destino | Pendente |
| Rubrica, exemplos e limites técnicos | Responsável editorial + B/C | Critérios aprovados antes dos jobs, com evidência de decisão | Pendente |
| Orçamento | Responsável operacional | Moeda, teto total, reserva por etapa, tentativas máximas, política de incerteza e autorização concreta de uso | Pendente |
| Destino de mídia e revisor | B + responsável editorial | Pasta/armazenamento permitido, retenção e identidade do revisor definidos | Pendente |

Preencher os mínimos de `entrada-piloto.json` com caminhos locais (relativos à pasta da ficha ou absolutos) e referências aos registros de acesso/teto autorizado; não inserir chave, token ou URL assinada. `en-US` foi registrado como locale candidato a partir de inglês/EUA; sotaque e voz oficial ainda exigem confirmação. Os números da ficha são propostas técnicas revisáveis de C, não requisitos adicionais do usuário nem capacidades já testadas. Guardar os originais em pasta própria de insumos. A autorização para desenvolver o projeto não constitui por si só teto de geração paga.

Para a repetição prevista na especificação, serão necessários depois pelo menos dois outros artigos de estruturas diferentes. Não bloquear o primeiro ensaio por sua ausência, mas não concluir repetibilidade com um único artigo.

## Gates pendentes

1. **G0 — prontidão:** ficha completa; acesso consultado; rubrica/formato/orçamento aprovados. A checagem local só cobre uma parte.
2. **G1 — editorial/direção:** briefing, roteiro rastreável e storyboard aprovados A–C.
3. **G2 — assets:** áudio e imagens aprovados; avatar, movimento e integração avaliados D/E.
4. **G3 — trecho e vídeo:** montagem real, arquivos íntegros e revisão integral F.
5. **G4 — decisão de S0:** B revisa o caminho de integração; humano aprova qualidade e escopo; relatório inclui custos e limitações.

G0–G4 estão pendentes. S3-C01 não recebe liberação de integrações reais por estes documentos.

## Acesso por rota após a decisão Higgsfield

A evidência de acesso_verification_record deve discriminar fornecedor, conta sem segredo, operação/modelo, data, acesso confirmado ou pendente e escopo autorizado de consulta/geração. Consultar apenas HeyGen não verifica Higgsfield. A inspeção histórica de variáveis HeyGen acima não avaliou credenciais Higgsfield. O preflight permanece offline e não verifica esses registros.

A ficha registra candidaturas sem selecionar modelo/endpoint final. Voz oficial/avatar seguem separados; upload de áudio não comprova lip sync. Estimativa da conta e custos de todas as rotas devem caber no mesmo teto antes dos jobs.
