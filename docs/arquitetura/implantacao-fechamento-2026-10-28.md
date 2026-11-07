# Implantação e recuperação — fechamento de 28/10/2026

O destino definitivo permanece uma decisão do operador (FC-16). O pacote entregue oferece uma instalação privada reproduzível com Docker Compose e HTTPS. O compose de desenvolvimento existente foi preservado. Não houve publicação externa, geração paga ou ativação de descarte.

## Componentes e limites

- `Dockerfile --target runtime`: Node 24, dependências do monorepo, FFmpeg/FFprobe e usuário sem privilégios `node`; serve API, worker e comandos administrativos.
- `Dockerfile --target web`: frontend Vite compilado servido por nginx, proxy para a API e certificado TLS montado somente para leitura.
- `compose.production.yaml`: PostgreSQL persistente sem porta publicada, migração inicial, API com readiness autenticado, worker separado, frontend HTTPS e perfil de backup. API/worker compartilham AssetStore e configuração; não há porta da API publicada.
- Apenas HTTPS do frontend é publicado, em loopback por padrão. Para acesso externo, escolher explicitamente endereço, domínio, certificado, hosts e origens. A aplicação usa cookie `Secure` quando a API recebe conexões além de loopback; usar HTTP neste pacote impede a sessão correta.
- O modo inicial é `synthetic` e o planejador `extractive`: ensaio sem fornecedores pagos, sem promessa de qualidade editorial. `simulated` não produz mídia; `synthetic` produz arquivos locais; `provisioned` exige runtime real configurado e autorização por operação.
- Ingestão/probe/render preservam o limite atual de 100 MB por input. Leitura/streaming suportarem arquivo maior não amplia esse limite. Validar duração, resolução, memória, disco e tempo no destino antes de fixar volume e metas.
- Readiness verifica banco, migrações e ferramentas de mídia; estado `running` do worker é liveness de processo e não prova que uma produção avançou. Conferir a jornada e `/api/operations` após inicialização.

## Configuração e primeira instalação

1. Instalar Docker/Compose no destino e reservar espaço para PostgreSQL, mídia e backups. O runtime requer Node 24 somente fora do contêiner.
2. Copiar `deploy/production.env.example` para arquivo privado, por exemplo `deploy/installation.env` (ignorado pelo Git). Substituir senha e chave por valores aleatórios. Usar senha URL-safe com pelo menos 24 caracteres; a URL PostgreSQL do compose interpola essa senha.
3. Disponibilizar `fullchain.pem` e `privkey.pem` no diretório informado por `FBR_TLS_DIRECTORY`. Para produção, usar certificado válido para o hostname; certificado autoassinado só serve para ensaio com confiança explícita no cliente. Certificados e chaves não entram na imagem nem no Git.
4. Ajustar `FBR_ALLOWED_HOSTS`, `FBR_ALLOWED_ORIGINS`, porta e endereço de publicação em conjunto. As origens incluem esquema HTTPS e porta; os hosts não incluem esquema ou porta.
5. Executar, na raiz do projeto:

```powershell
node --env-file=deploy/installation.env tools/deployment-preflight.mjs
docker compose --env-file deploy/installation.env -f compose.production.yaml config --quiet
docker compose --env-file deploy/installation.env -f compose.production.yaml build
docker compose --env-file deploy/installation.env -f compose.production.yaml up -d
docker compose --env-file deploy/installation.env -f compose.production.yaml ps
```

O preflight imprime somente nomes e resultados das verificações. `docker compose config --quiet` valida sem imprimir os valores secretos interpolados. Não anexar a saída completa de `config`, `inspect` ou variáveis de ambiente a tickets.

Abrir `https://localhost:8443` com os padrões locais e autenticar com a chave configurada. Conferir readiness e operações pela sessão. Configurar artigo, personagem/Bible e perfil pelo aplicativo; realizar uma jornada sintética completa antes de ligar fornecedores reais.

### Planejamento e fornecedores reais

O contêiner não incorpora sessão OAuth do computador nem instala automaticamente o executável Codex. Para `FBR_PLANNER=codex_oauth`, provisionar executável nativo Linux compatível e sua sessão autorizada no destino com acesso exclusivo do usuário de serviço. Um caminho Windows não funciona no contêiner Linux. Alternativamente usar operação local Windows existente ou manter `extractive` com suas limitações explícitas até a rota semântica estar disponível.

Montar o módulo real em `deploy/bindings` e apontar `FBR_PROVIDER_BINDINGS_MODULE` para `deploy/bindings/<arquivo>.ts`. O loader exige um arquivo dentro do projeto exportando `createProviderRuntime({db,files})`; compor com os adapters existentes. Validar contas, modelos, parâmetros, estimativas/quotes, uploads, faturamento e autorização conforme o piloto. Colocar credenciais somente na configuração privada server-side. API e worker precisam receber o mesmo modo e módulo. A montagem `deploy/bindings` é somente leitura.

Não marcar fornecedor como disponível apenas porque uma chave existe. Confirmar cada rota do repertório com evidência de acesso e resultado real. Não usar fallback automático para fornecedor pago nem apresentar custo desconhecido como zero.

## Backup persistente e cópia externa

O perfil de manutenção usa o mecanismo de backup completo existente, com hashes de mídia e metadados publicados após cópia verificada. Cada execução cria um diretório diferente em `/backups`:

```powershell
docker compose --env-file deploy/installation.env -f compose.production.yaml --profile maintenance run --rm backup
```

Registrar `destination`, `metadata_key` e `metadata_hash` retornados. O volume `fbr_backups` persiste entre chamadas, mas não protege contra perda do host. Copiar snapshots para destino externo segundo a política escolhida; o agendamento e o destino externo devem ser definidos pelo operador conforme metas reais de recuperação. Para copiar sem imprimir segredos, usar um contêiner temporário que monte o volume de backup somente para leitura e uma pasta de exportação dedicada; conferir manifesto e hashes no destino. Não copiar `.env`, perfis OAuth ou cookies junto aos backups de conteúdo.

Não executar `docker compose down --volumes`: esse comando remove volumes persistentes. A parada normal usa `stop`; recriação de serviços preserva volumes.

## Restauração isolada

O comando `tools/restore-backup.ts` não inicia serviços e exige banco e diretório de mídia de destino vazios. O mecanismo de restore recusa tabelas preenchidas e verifica hashes. Para um ensaio, provisionar outro banco vazio e outra pasta, sem alterar a configuração dos serviços ativos.

Definir em arquivo privado de restauração:

```dotenv
FBR_RESTORE_DATABASE_URL=postgresql://usuario:senha_url_safe@127.0.0.1:PORTA/banco_novo
FBR_RESTORE_ASSET_ROOT=CAMINHO_ABSOLUTO_PASTA_NOVA
FBR_RESTORE_BACKUP_ROOT=CAMINHO_ABSOLUTO_SNAPSHOT_EXPORTADO
FBR_RESTORE_METADATA_KEY=metadata/HASH.json
FBR_RESTORE_METADATA_HASH=HASH
```

Executar com Node 24 e as dependências instaladas:

```powershell
node --env-file=restore.env --import tsx tools/restore-backup.ts
```

O comando migra o banco de destino, verifica a referência do manifesto e restaura com o mecanismo existente. Recusa mídia de destino preenchida e sobreposição com a pasta de backup; se `DATABASE_URL`/`FBR_ASSET_ROOT` também estiverem no ambiente, recusa os destinos ativos identificados. Essas verificações não substituem a escolha correta de destino pelo operador. Se falhar após copiar arquivos, inspecionar esse destino de ensaio e usar outro destino vazio para repetir; o comando não remove conteúdo automaticamente.

Conferir contagens, mídia/histórico, decisões, recibos e hashes antes de apontar qualquer instalação para o destino restaurado. Serviços só devem ser iniciados manualmente depois dessa conferência para evitar novos envios ou retomadas inesperadas.

## Retenção, atualização e rollback

Descarte automático permanece desativado. A API oferece dry-run e registra backup como não verificado; não basta executar backup para autorizar limpeza. Até existir política aprovada, comprovante ligado ao inventário e guard que exclua todos os escritores, conservar mídia/histórico e acompanhar crescimento do disco. A rotina manual deve preservar todos os arquivos referenciados e snapshots necessários.

Antes de atualizar: registrar imagem/tag/configuração não secreta, tirar e verificar backup, executar as verificações do código novo e ensaiar migração/restore isolados. Depois, reconstruir imagens e recriar serviços; a migração é aditiva. Rollback só volta ao código anterior se ele compreender o estado persistido novo; caso contrário restaurar para novos banco/pasta e trocar configuração após conferência. Não aplicar down migration destrutiva.

A liberação final ainda depende de piloto real, calibração, aceite humano, definição das metas de operação e teste de recuperação no destino. O pacote local não declara esses gates concluídos.
