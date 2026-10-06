# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base

WORKDIR /app

# Instalar dependências necessárias para compilação caso nativas
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copiar arquivos de definição de dependências
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/infra/package.json ./packages/infra/
COPY packages/pipeline/package.json ./packages/pipeline/

# Instalar todas as dependências (incluindo devDependencies para tsx/typescript)
RUN npm ci

# Copiar o restante do código da aplicação
COPY . .

# Criar diretórios de dados locais caso necessários
RUN mkdir -p var/assets var/backup

# Variáveis de ambiente padrão
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3001 \
    APP_TIMEZONE=America/Sao_Paulo

EXPOSE 3001

# Comando padrão (pode ser sobrescrito no Easypanel para worker ou web)
CMD ["npm", "run", "dev:api"]
