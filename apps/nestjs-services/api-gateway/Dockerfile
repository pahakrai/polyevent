# syntax = docker/dockerfile:1
# Build from repo root: docker build -f apps/nestjs-services/api-gateway/Dockerfile .

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY apps/nestjs-services/api-gateway/package.json apps/nestjs-services/api-gateway/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY libs/ libs/
COPY apps/nestjs-services/api-gateway/ apps/nestjs-services/api-gateway/
RUN npx nx build api-gateway

FROM node:20-alpine AS development
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY apps/nestjs-services/api-gateway/package.json apps/nestjs-services/api-gateway/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund && \
    chown -R appuser:appgroup /app

COPY --chown=appuser:appgroup libs/ libs/
COPY --chown=appuser:appgroup apps/nestjs-services/api-gateway/ apps/nestjs-services/api-gateway/

USER appuser
ENV NODE_ENV=development
EXPOSE 3000 9229
CMD ["npx", "nx", "run", "api-gateway:serve:debug"]

FROM node:20-alpine AS production
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/apps/nestjs-services/api-gateway/dist ./
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"
CMD ["node", "main.js"]
