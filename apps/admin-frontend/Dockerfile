# syntax = docker/dockerfile:1
# Build from repo root: docker build -f apps/admin-frontend/Dockerfile .

FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY apps/admin-frontend/package.json apps/admin-frontend/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM node:20-alpine AS development
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY apps/admin-frontend/package.json apps/admin-frontend/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund && \
    chown -R appuser:appgroup /app

COPY --chown=appuser:appgroup apps/admin-frontend/ apps/admin-frontend/

USER appuser
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npx", "nx", "run", "admin-frontend:serve"]

FROM deps AS builder
WORKDIR /app

COPY apps/admin-frontend/ apps/admin-frontend/
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
RUN npx nx build admin-frontend

FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-frontend/.next/static ./apps/admin-frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-frontend/public ./apps/admin-frontend/public
RUN rm -rf /tmp/* /root/.npm /root/.cache
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"
CMD ["node", "apps/admin-frontend/server.js"]
