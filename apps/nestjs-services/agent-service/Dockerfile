# syntax = docker/dockerfile:1
# Build from repo root: docker build -f apps/nestjs-services/agent-service/Dockerfile .

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY apps/nestjs-services/agent-service/package.json apps/nestjs-services/agent-service/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY libs/ libs/
COPY apps/nestjs-services/agent-service/ apps/nestjs-services/agent-service/
RUN npx nx build agent-service

FROM node:20-alpine AS development
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY apps/nestjs-services/agent-service/package.json apps/nestjs-services/agent-service/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund && \
    chown -R appuser:appgroup /app

COPY --chown=appuser:appgroup libs/ libs/
COPY --chown=appuser:appgroup apps/nestjs-services/agent-service/ apps/nestjs-services/agent-service/

USER appuser
ENV NODE_ENV=development
EXPOSE 3010
CMD ["npx", "nx", "run", "agent-service:serve"]

FROM node:20-alpine AS production
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup
WORKDIR /app
ENV NODE_ENV=production PORT=3010
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/apps/nestjs-services/agent-service/dist ./
USER appuser
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3010/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"
CMD ["node", "main.js"]
