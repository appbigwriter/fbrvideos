# S0-A01 — experiência do FBR Videos

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Versão UX 0.1 · 4 de outubro de 2026 · Autor: frente A.

Entrega de desenho e documentação visual. O protótipo não é a aplicação, não acessa fornecedores e não demonstra geração audiovisual ou aprovação humana real. Sua execução não implementa AG-01. Os originais de produto e audiovisual permanecem autoridades.

## Artefatos

- [Integração AG-07](ag-07-integracao-v0.1.md): estado, pendências, custos e comandos conectados à API; 76 testes e QA responsivo. Substitui o estado PRONTO de AG-07 nas notas anteriores.

- [Integração AG-05/06](ag-05-06-integracao-v0.1.md): componentes conectados às páginas reais, ajustes de fontes/opções/CSS, 73 testes e evidências de navegador. Substitui o estado de retorno pendente das notas anteriores.

- [AG-07 — acompanhamento e consumo](ag-07-handoff-v0.1.md): PRONTO para apresentação isolada, com ownership de quatro arquivos novos. [Auditoria dos chats e próximas ondas de repasse](../planejamento-antigravity-2026-10-05.md): AG-08/09/10 ainda bloqueados; AG-05/06 com retorno presente e revisão/integração pendentes.

- [AG-05 — resumo da produção](ag-05-handoff-v0.1.md) e [AG-06 — inspeção do dossiê](ag-06-handoff-v0.1.md): PRONTOS, contratos/fixtures e prompts de repasse.
- [GPT-6.1 Sol via OAuth](../arquitetura/s2-c01-oauth-v0.1.md): integração semântica verificada, aceite editorial humano e gate S2 pendentes.

- [Pacotes S1 liberados AG-02/03/04](antigravity-s1-pacotes-v0.1.md): contratos concretos, arquivos permitidos e prompts.
- [Entrega S1-B01 e integração AG-01](../arquitetura/s1-b01-entrega-v0.1.md): evidências e limites atuais.

- [Jornada, telas e decisões](jornada-e-telas-v0.1.md).
- [Contrato de apresentação](contrato-apresentacao-v0.1.md): projeções requeridas, ações e pontos de alinhamento com B; não substitui os schemas de domínio.
- [Pacote AG-01](ag-01-handoff-v0.1.md): desenho preparado, liberação condicionada à base técnica e revisão.
- [Protótipo navegável](prototipo-jornada.html): abrir diretamente em navegador, sem instalação ou servidor.
- [Fixtures de UX](fixtures/cenarios-v0.1.json): fictícias, sem dados pessoais, mídias ou credenciais reais.
- [Roteiro de verificação](verificacao-v0.1.md).

## Uso do protótipo

Abra `prototipo-jornada.html`. O menu permite explorar a navegação; a seleção de cenário no topo permite chegar às exceções. O caminho principal começa em Artigos. Os comandos escritos como “Simular” avançam apenas a demonstração local. Recarregar a página descarta todas as decisões do protótipo.

Não há percentual global, prazo, vídeo sintético, preço garantido, sincronização de CMS ou publicação externa. A entrega final baixa somente um recibo textual identificado como fictício, para verificar a interação de exportação.

## Limites da conclusão

O desenho cobre o aceite técnico de S0-A01; avaliação humana continua pendente. AG-01/02/03/04 integrados com controllers/API, verificados no navegador. AG-05/06 têm handoffs prontos e aguardam confirmação/revisão do retorno. Planejamento semântico GPT-6.1 Sol via OAuth conectado e verificado; aceite editorial humano, gate S2 e calibração audiovisual pendentes.
