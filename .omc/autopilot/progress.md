# Estado persistido — 7/10/2026

Escopo autorizado: implementar TL-01–TL-18; EX-01–EX-04 permanecem externos. Implementação central e frentes integradas; finalizar revisões e verificação antes de marcar todas as tarefas.

Entregas: ProductionPipeline/start/ingest/evaluate/retry/corrections/recover; runtime sintético persistente e composição real; callbacks/invoices/budget; streams/histórico/backup; calibração/retenção/telemetria/runbook; reauditoria OAuth; quality ports. Migrações chegam à 015 e formato atual de backup 12, leitores 5–11 preservados.

Ensaio público PGlite passou artigo/perfil→planejamento→rejeição/retry→montagem→correção visual→edição de fala→montagem→aprovação→exportação, com recriação de runtime/API. Ensaio de navegador em banco temporário viu vídeo atual 4,4s e histórico 4s, ambos readyState4 sem error; entrega com MP4/SRT/VTT/manifesto; mobile360px largura útil345 sem overflow; teclado e console sem erros. Aba/servidor temporários encerrados, produções reais preservadas.

Verificação anterior `var/verify-tasklist-final.log`: 159 casos,157 aprovados,2 exclusivos de PostgreSQL omitidos; tipos/build. Nativo `var/verify-tasklist-native.log`:28 aprovados; após últimas mudanças de fila, `var/verify-tasklist-native-final.log`:19 aprovados. Mudanças de revisão posteriores exigem rodadas focais/global finais.

Revisões encerradas: lookup de recibo persistido sem retransmissão, replay do corpo/URLs fixados, beforeSend, quebras/área segura VTT e diagnóstico/evidência de qualidade foram integrados/testados. Guard do pipeline impede renders idênticos depois de falha de qualidade (dossiê e policyhash exatos). Origem usa capabilities.mode; exists verifica hash em chunks. Polling/faturamento recuperam páginas posteriores. Schema de status estável evita loop de requisições na UI.

Entrega técnica concluída: docs/arquitetura/entrega-tasklist-2026-10-07.md e tasklist com TL01–18 marcadas; EX01–04 seguem externos. Verificação entrega164casos/162pass/2skip, tipos/build; após últimas alterações3 testes públicos e16 testesweb passaram. Jornada nativa1pass, fila/recovery nativo19pass. Backup formato12 final em var/full-backups/2026-10-07T23-43-58-331Z, hash6c24f933b21cdc69925502840352b0b8456dfeba582cf365f8c54f6269bcff55.

Main API37060/worker13660 em operação, worker simulated preservado; Vite27304; PostgreSQL55432. Processo30064 é outro projeto PreListing e foi preservado. Migrações015 aplicadas, main produções continuam ids02b827ac-df24-45ba-9429-a36d3b31a65a v6 e ea955415-9926-4ed5-89a9-ee5e1e525035 v5, awaiting_decision. Health/readiness ok e geração não configurada explicitamente, sem ativar fornecedores.

Automação antiga retomar-backlog-fbrvideos removida em 7/10: contingência única de5/10 obsoleta. Último gatilho foi heartbeat: finalizar com bloco XML NOTIFY somente na conclusão/falha/ação humana; manter silêncio durante polling. Não encerrar implementação por conta do gatilho.
