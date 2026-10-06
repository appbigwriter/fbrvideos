# Piloto audiovisual S0-C01

Revisão de planejamento · 4 de outubro de 2026: [integração Higgsfield](../arquitetura/integracao-higgsfield-v0.1.md). Higgsfield é candidata a imagens e cenas de apoio; voz oficial e avatar seguem rotas separadas. Stack e jornada artigo + perfil preservadas. Acesso, qualidade e custos reais continuam não testados; esta revisão não conclui gates.


Data: 4 de outubro de 2026. Estado: **preparação entregue; piloto real não executado; gate audiovisual pendente**.

Este pacote prepara o experimento de voz oficial e avatar candidato HeyGen, com Higgsfield candidata a imagens e cenas de apoio. Não habilita um perfil nem conclui S0-C01. O aceite exige mídia real, custos medidos, revisão de integração por B e avaliação humana integral.

- [Insumos e decisões necessárias](insumos.md)
- [Contexto Game Style fornecido](contexto-gamestyle.md)
- [Protocolo de execução](protocolo.md)
- [Rubrica de avaliação](rubrica.md)
- [Matriz de capacidades e fontes primárias](capacidades.md)
- [Relatório e evidências atuais](relatorio.md)
- `entrada-piloto.json`: mínimos externos pendentes e defaults técnicos propostos pela equipe para calibração, identificados como candidatos.
- `preflight.ps1`: checagem local, sem rede, upload, geração ou despesas.

Para verificar a ficha, na raiz do projeto:

```powershell
pwsh -NoProfile -File .\docs\piloto\preflight.ps1
```

O código de saída é `2` enquanto faltarem mínimos externos ou ferramentas; `0` indica somente presença dos mínimos da ficha e disponibilidade local das ferramentas. Não significa autorização para gastos, autenticação válida, rubrica aprovada ou qualidade comprovada. O script não lê credenciais. Referências adicionais dependem da receita; uma referência combinada pode cobrir identidade/look/ambiente. Amostra vocal separada é opcional quando há voz disponível identificada no fornecedor.

Base: os quatro documentos v0.1 em `docs`. O projeto base prevalece na experiência recorrente: inspeção detalhada opcional e revisão final humana. As revisões A–F deste protocolo pertencem à calibração supervisionada, não criam formulários de direção obrigatórios no produto.
