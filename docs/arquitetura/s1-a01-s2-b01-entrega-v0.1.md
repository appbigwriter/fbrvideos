# S1-A01 e S2-B01 — integração e preparação persistente

Data: 4 de outubro de 2026. **Integração funcional S1-A01 e backend S2-B01 implementados e verificados.** AG-02/03/04 foram recebidos e integrados tecnicamente; os dez arquivos do Antigravity foram preservados. Avaliação humana do produto e piloto audiovisual permanecem pendentes. Esta entrega não conclui o gate S2, pois S2-C01 ainda não executa planejamento automático.

## Interface conectada

As rotas em `AppRoutes.tsx` usam controllers em `pages/*Connected.tsx`; shell/AG-01 e apresentações AG-02/03/04 permanecem separados. `main.tsx` importa os três estilos entregues e a camada complementar de integração. Os controllers não usam fixtures como dados operacionais.

- Artigos: lista e filtros de servidor, opções de autora sem corte de paginação, paginação, captura URL, colagem manual, leitura da revisão selecionada, confirmação de completude/autoria e gravação de nova revisão. Recaptura cria outra revisão incompleta; não substitui a fonte já usada em produções.
- Universo: abas/seleção reais, cadastro e revisão de personagens/Bibles/referências, leitura do original como texto seguro e distinção da interpretação. Texto original vazio durante edição preserva o documento; texto novo cria outro original e conserva o anterior. Não há upload/aprovação de mídia.
- Perfis: criação/revisão de nome, situação de cadastro, personagem, idioma, duração, receita candidata, voz, classes, referências, formato e limites. Valores monetários são convertidos de unidades da moeda para inteiros, com até duas casas decimais e sem arredondamento silencioso. Novos formatos têm H.264/AAC/48 kHz/SRT declarados como candidatos, não como resultado do piloto. Configurações existentes conservam codecs/formato.
- Edição de vínculos: revisões antigas de personagem/voz/referências permanecem identificáveis nos seletores. Não trocar por última revisão automaticamente. O endpoint de universo do perfil combina opções atuais com as revisões fixadas.
- Produções: criação a partir de artigo/perfil, lista, estado, revisão atual, pendências, consumo e histórico; pausa, retomada e cancelamento usam as ações permitidas pelo servidor. Nenhum percentual/ETA ou resultado audiovisual é inventado.

O cliente valida respostas com schemas públicos. Carregamento, falha e retry são explícitos; requisições obsoletas são abortadas. Durante salvamento, duplo submit é bloqueado. A mesma intenção/payload reutiliza command_id após falha de rede; mudança de dados é nova intenção. Conflitos não sobrescrevem edição: o servidor retorna 409, e o operador pode cancelar/recarregar e reconciliar.

`apps/web/vite.config.ts` serve desenvolvimento somente em loopback5173, com proxy `/api` para loopback3001. O build é um bundle; deployment, autenticação e hospedagem não foram implementados.

## Persistência S2-B01

Migração `002_productions.sql` acrescenta heads/revisões de produção, snapshots, eventos, dossiês e comandos. Migrações S1/S2 são aplicadas na mesma transação, serializadas por advisory lock. Revisões, snapshots, eventos e dossiês são imutáveis por trigger. Atualização da head usa CAS; revisão/evento/resultado do comando são gravados na mesma transação e conexão. Replay devolve o resultado original, sem criar nova produção/evento; reutilização da chave com outra intenção retorna conflito.

Cada produção fixa artigo, perfil, personagem, referências, original do Bible, request/overrides e catálogo/receita versionados. O snapshot possui hash canônico verificado no smoke. Alterações posteriores de fonte/configuração não mudam a produção existente. Não escolhe modelo real nem autoriza custos: vinculação de fornecedores ao snapshot de execução e reserva/reconciliação pertencem às etapas seguintes.

Criação exige fonte completa, autoria e identidade coerentes, interpretação confirmada, configuração essencial do perfil e referências existentes nas revisões selecionadas. Receita desconhecida ou tutorial experimental sem validação de ações são bloqueados. Recorrência exige perfil validado e registro de calibração da revisão/receita no servidor. Um perfil candidato configurado pode criar preparação de calibração; referências pendentes não autorizam geração real. Preferência de ambiente deve apontar para ambiente permitido pelo perfil.

## Máquina de preparação

| Entrada | Pré-condição | Resultado |
|---|---|---|
| Criar | Entradas elegíveis para preparação | preparing/preparation, com pendência de planejador |
| Pausar | preparing ou awaiting_decision | paused; sem promessa de interromper fornecedor |
| Retomar | paused ou failed | preparing/preparation se ainda não há dossiê; awaiting_decision se há dossiê |
| Cancelar | preparing, awaiting_decision, paused ou failed | cancelled, preservando histórico/snapshot |
| planning_started, interno | preparing/preparation e revisão exata | preparing/script_direction |
| planning_failed, interno | Planejamento ativo e revisão exata | failed com diagnóstico; não simula conclusão |
| planning_completed, interno | Planejamento ativo, dossiê íntegro e entradas exatas | Dossiê imutável + awaiting_decision com gate audiovisual pendente |

Toda operação mutável fixa a revisão esperada. Worker atrasado ou duas operações concorrentes não podem sobrescrever estado mais novo. Retomada após falha é explícita, não retry automático com custo.

O futuro worker usa `ProductionService.planning`; **não há endpoint público de inserção/conclusão de dossiê**. Validação confere artigo/perfil/personagem/produção, fontes e repertório com `inspectDossier`. Recusa mídia, jobs, avaliações, aprovações, timeline ou estados visuais aprovados que tentem apresentar geração fictícia durante planejamento. Mesmo um dossiê estruturalmente íntegro continua aguardando avaliação editorial/piloto; schema não comprova veracidade do texto. Aprovação final é recusada sem workflow/render real.

## Endpoints adicionais

| Método/caminho | Comportamento |
|---|---|
| GET /api/articles/filter-options | Todas as autoras das heads atuais |
| GET /api/profiles/:id/universe?version=N | Opções atuais + revisões fixadas pelo perfil |
| GET /api/productions | ProductionsListSchema |
| POST /api/productions | CreateProductionRequestSchema; 201 ou impedimento |
| GET /api/productions/:id?version=N | ProductionDetailSchema: estado, snapshot, dossiê/eventos até a revisão, ações |
| POST /api/productions/:id/commands | ProductionCommandSchema; revisão exata, comandos de preparação |

Contratos aditivos em `packages/contracts/src/production-api.ts` preservam a versão 0.1.0. API local conserva limites de Host/Origin, corpo e mensagens sanitizadas. Não há endpoints de geração, pagamento, upload ou aprovação fictícia.

## Evidências

- `npm run verify` passou: 17 contratos +18 infra (12 S1 e seis S2) +nove pipeline +dois web = **46 testes**; typecheck/build passaram. Infra também passou com `TEST_DATABASE_URL` no PostgreSQL 18.4 nativo dedicado. O teste específico de disco/reabertura de S1 continua PGlite; o restante pode usar pg/Pool nativo ou fallback PGlite.
- Os seis testes S2 cobrem snapshot/hash/original, revisão posterior da fonte, replay, CAS concorrente, transições/revisão antiga, falha/retomada, dossiê inválido/rollback, gravação sem geração e endpoints. Universo do perfil inclui personagem atual e antiga em teste de API.
- Navegador real em loopback5173: importação manual, edição de artigo, referência vocal, perfil candidato com valores decimais, criação de produção, pausa/retomada e histórico. Artigo e personagem foram revisados depois da criação; o perfil manteve personagem v1 selecionada e a produção conservou artigo/personagem v1.
- Smoke HTTP em `production-live-smoke.ts`: hash do snapshot, comparação com versões exatas de artigo/perfil/personagem, original do Bible e sequência de eventos. Ensaio registrado em `var/s2-http-evidence.json`: produção v3/três eventos; artigo e personagem atuais v2, ambos fixados em v1. Somente dados sintéticos, sem mídia ou gastos.
- Evidências visuais em `docs/ux/evidencias/s1-s2-producao-integrada.jpg` e `s1-perfil-versoes-fixadas.jpg`. Foram inspecionadas; não substituem avaliação humana nem auditoria completa de acessibilidade/responsividade.
- Aviso conhecido do bundler sobre `use client` em React Router permanece não bloqueante.

## Executar e continuar

Com o PostgreSQL local ativo: `npm run db:migrate`, `npm run dev:api` e `npm run dev:web`. Se necessário, `npm run dev:db` usa o cluster nativo já documentado em [S1-B01](s1-b01-entrega-v0.1.md). Não iniciar outra instância sobre o mesmo cluster. O banco de testes deve ser dedicado e definido em TEST_DATABASE_URL.

Para repetir o smoke de leitura de uma produção de ensaio, definir `LIVE_PRODUCTION_ID` e executar `npm run test:live:production`; não cria mídia nem modifica a produção. Dados da verificação no navegador estão identificados como sintéticos no banco de desenvolvimento.

Atualização posterior: [S2-C01 parcial](s2-c01-planejador-v0.1.md) já executa planejamento extrativo local e recupera preparações interrompidas. [AG-05](../ux/ag-05-handoff-v0.1.md)/[AG-06](../ux/ag-06-handoff-v0.1.md) estão PRONTOS com contratos/fixtures; não houve envio externo. Não ampliar escopo dos pacotes anteriores. Reescrita/direção semânticas, gate audiovisual, AssetStore, fila de jobs e fornecedores reais permanecem pendentes. Os resultados de 46 testes acima são históricos; a rodada atual passou com 55.
