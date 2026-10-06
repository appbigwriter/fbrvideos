# Antigravity — pacotes S1 liberados

Data: 4 de outubro de 2026. Estado vigente: AG-01/02/03/04 **INTEGRADOS tecnicamente**, após retorno do responsável e conexão dos controllers à API real. Os dez arquivos dos pacotes S1 foram preservados; ver [entrega e verificação](../arquitetura/s1-a01-s2-b01-entrega-v0.1.md). QA humana permanece pendente. Os handoffs abaixo registram o escopo original da liberação, com contrato 0.1.0; domínio, persistência, credenciais e geração continuam fora dos pacotes.

| Ordem | Pacote | Entrega | Handoff |
|---|---|---|---|
| 1 | AG-02 | Lista/filtros/estados/callbacks de artigos | [AG-02](ag-02-handoff-v0.1.md) |
| 2 | AG-03 | Universo, tabs/cards/detalhes somente leitura | [AG-03](ag-03-handoff-v0.1.md) |
| 3 | AG-04 | Campos controlados e ações de formulário | [AG-04](ag-04-handoff-v0.1.md) |

Recomendação para um worker: executar nessa ordem. Os dez arquivos permitidos são distintos; trabalhos simultâneos só quando cada worker respeitar seu ownership. Não alterar os seis arquivos recebidos de AG-01, páginas, main/AppRoutes, contratos, fixtures, dependências ou backend. Componentes retornam para integração aqui em S1-A01.

## Prompt para os três pacotes

> Continue o FBR Videos em F:\Projetos\_FBR\FBRVideos, implementando AG-02, depois AG-03 e AG-04. Leia docs/ux/antigravity-s1-pacotes-v0.1.md e os três handoffs vinculados. Use os contratos e fixtures publicados de @fbr/contracts. Crie somente os arquivos permitidos de cada pacote, preservando a linguagem visual do AG-01. Não altere páginas/main/AppRoutes, contratos, dependências ou backend; não faça fetch, storage, uploads, aprovações ou geração. Entregue os três pacotes separadamente identificados, com arquivos/diff, verificações e limitações. A integração com páginas e API será feita aqui.

## Limites de liberação

S1-B01 implementa SQL, serviços e API de cadastro/importação, com testes PostgreSQL embarcado; servidor PostgreSQL/Docker local não respondeu nesta rodada. Isso não bloqueia a apresentação com contratos/fixtures. Não marcar pacote INTEGRADO só porque o Antigravity terminou; root integra e verifica. AG-05–AG-10 ainda dependem das stories/contratos posteriores. Piloto audiovisual e qualidade dos fornecedores continuam pendentes.
