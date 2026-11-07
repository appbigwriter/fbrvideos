# Pacote de evidências do piloto real

Ferramenta local para preparar e conferir o inventário de FC-09–FC-15. Não lê `.env`, não acessa fornecedores, não gera mídia, não habilita perfil e não transforma presença de arquivo em aceite audiovisual.

## Preparação

Preserve `entrada-piloto.json` até receber insumos reais. Crie uma pasta de evidências nova:

```powershell
node --import tsx tools/pilot-evidence.ts init var/piloto-real-001 piloto-real-001
```

O pai (`var`) deve existir. A criação falha se a pasta já existir; não substitui evidências. Preencha `pilot-evidence.json` com IDs/versionrefs reais e caminhos relativos à própria pasta. Copie os arquivos que serão referenciados para essa pasta e calcule SHA-256 e bytes:

```powershell
Get-FileHash -LiteralPath var/piloto-real-001/video.mp4 -Algorithm SHA256
Get-Item -LiteralPath var/piloto-real-001/video.mp4 | Select-Object Length
```

Não coloque credenciais, URLs assinadas, sessões ou dumps completos de requests nesse pacote. Os registros de acesso e autorização devem ser relatórios sanitizados, com referência ao local protegido quando necessário.

## Inventário

`files` identifica artigo, Bible, referência visual, voz, render final, SRT, VTT, manifesto e relatórios. Cada registro exige `id`, `role`, `path`, `sha256` e `bytes`. Os IDs são usados como referências de evidência, evitando links temporários. Os caminhos devem permanecer dentro da pasta mesmo depois de resolver symlinks.

`setup` declara revisor, receita/formato escolhidos, moeda/teto em unidades menores e IDs dos relatórios de direitos, rubrica e autorização. A ferramenta confere apenas presença e integridade; a validade dessas declarações precisa ser julgada por quem tem responsabilidade sobre elas.

`routes` registra as operações reais usadas no piloto (áudio, imagem, animação e avatar), fornecedor/modelo, ID do job, custo confirmado e relatório de evidência. Resultado incerto ou faturamento não reconciliado mantém `confirmed_minor:null` e a pendência. Não gerar operações extras apenas para completar o JSON; se uma rota sair do escopo, registrar e revisar o protocolo.

`reviews` contém os critérios de fidelidade, identidade, voz, lip sync, continuidade, legendas, mix, entrega, correção localizada, restart e calibração da política. Cada decisão tem revisor, data, hash do render, relatório e justificativa. `fail` mantém bloqueio. `not_applicable` exige decisão de escopo: a ferramenta não o trata automaticamente como aprovado. Decisões conflitantes também permanecem abertas nesse formato offline.

`calibration` referencia relatório do corpus e decisão humana vinculados ao perfil. A habilitação acontece pelo workflow da aplicação com suas verificações; este arquivo não altera status.

## Conferência

```powershell
node --import tsx tools/pilot-evidence.ts inspect var/piloto-real-001/pilot-evidence.json
node --import tsx --test tools/test/pilot-evidence.test.ts
```

Saída `2` significa arquivo inválido ou inventário incompleto/inconsistente. Saída `0` significa somente inventário completo e íntegro segundo esse formato. Mesmo assim, `product_acceptance` permanece `requires_authorized_human_decision`: o utilitário não autentica o revisor, não prova que os arquivos vieram do fornecedor e não avalia estética ou fidelidade.

Execute também `docs/piloto/preflight.ps1` para os mínimos de entrada e ferramentas. Depois siga [protocolo](protocolo.md) e [rubrica](rubrica.md). Primeiro registre os resultados reais; só depois atualize relatório, capabilities e calibração com as decisões correspondentes. Arquivos sintéticos devem ser identificados como `synthetic` e nunca satisfazem o gate real.
