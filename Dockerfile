# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies

WORKDIR /app

# Instalar dependências necessárias para compilação caso nativas
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg \
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

FROM dependencies AS build
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.json ./
RUN npm run typecheck && npm run build:web

FROM nginx:stable-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 443

FROM dependencies AS runtime
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3001 APP_TIMEZONE=America/Sao_Paulo
COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages
COPY --chown=node:node tools ./tools
COPY --chown=node:node tsconfig.json ./
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/web/dist
RUN mkdir -p /app/var/assets /backups /app/deploy/bindings \
    && chown -R node:node /app/var /backups /app/deploy
USER node
EXPOSE 3001
CMD ["sh", "-c", "node --import tsx packages/infra/src/migrate.ts && node --import tsx apps/api/src/server.ts"]
