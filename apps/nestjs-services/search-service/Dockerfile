# Build from repo root: docker build -f apps/nestjs-services/search-service/Dockerfile .
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY libs/ libs/
COPY apps/nestjs-services/search-service/ apps/nestjs-services/search-service/

RUN npm ci --no-audit --no-fund && npx nx build search-service && npm cache clean --force && rm -rf /tmp/* /root/.npm /root/.cache

FROM node:20-alpine AS development
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY libs/ libs/
COPY apps/nestjs-services/search-service/package.json apps/nestjs-services/search-service/

RUN npm ci --no-audit --no-fund && npm cache clean --force && rm -rf /tmp/* /root/.npm /root/.cache

COPY apps/nestjs-services/search-service/ apps/nestjs-services/search-service/
COPY scripts/entrypoint-dev.sh scripts/

RUN chmod +x scripts/entrypoint-dev.sh

ENV NODE_ENV=development
ENV PORT=3000
EXPOSE 3000
EXPOSE 9235

CMD ["/app/scripts/entrypoint-dev.sh", "search-service"]

FROM node:20-alpine AS production

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=appuser:appgroup /app/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/apps/nestjs-services/search-service/dist ./

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["node", "main.js"]
