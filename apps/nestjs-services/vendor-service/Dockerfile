# syntax = docker/dockerfile:1
# Build from repo root: docker build -f apps/nestjs-services/vendor-service/Dockerfile .

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY apps/nestjs-services/vendor-service/package.json apps/nestjs-services/vendor-service/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY libs/ libs/
COPY apps/nestjs-services/vendor-service/ apps/nestjs-services/vendor-service/
RUN npx nx build vendor-service

FROM node:20-alpine AS development
WORKDIR /app

RUN apk add --no-cache postgresql-libs

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY apps/nestjs-services/vendor-service/package.json apps/nestjs-services/vendor-service/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund && \
    chown -R appuser:appgroup /app

COPY --chown=appuser:appgroup libs/ libs/
COPY --chown=appuser:appgroup apps/nestjs-services/vendor-service/ apps/nestjs-services/vendor-service/

USER appuser
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=480"
EXPOSE 3000 9232
CMD ["npx", "nx", "serve", "vendor-service", "--configuration=debug"]

FROM node:20-alpine AS production
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/apps/nestjs-services/vendor-service/dist ./
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"
CMD ["node", "main.js"]
