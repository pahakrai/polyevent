# ============================================================
# Production-grade multi-stage Dockerfile — monorepo context
# Build from repo root: docker build -f apps/frontend/Dockerfile .
# Uses nx build for dependency-graph-aware compilation and caching.
# Requires output: 'standalone' in next.config.js.
# ============================================================

# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace root files for npm ci
COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY apps/frontend/package.json apps/frontend/

RUN npm ci --no-audit --no-fund && npm cache clean --force && rm -rf /tmp/* /root/.npm /root/.cache

# ---- Stage 2: Development (hot reload) ----
FROM node:20-alpine AS development
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY apps/frontend/ apps/frontend/

RUN npm ci --no-audit --no-fund && npm cache clean --force && rm -rf /tmp/* /root/.npm /root/.cache \
    && chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=development
EXPOSE 3000

CMD ["npx", "nx", "run", "frontend:serve"]

# ---- Stage 3: Build Next.js with NX ----
FROM deps AS builder
WORKDIR /app

# Copy frontend source (libs/ not needed — frontend has no workspace deps yet;
# add COPY libs/ here when workspace packages are adopted)
COPY apps/frontend/ apps/frontend/

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npx nx build frontend

# ---- Stage 4: Production runtime ----
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone output (requires output: 'standalone' in next.config.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public

# Security hardening
RUN rm -rf /tmp/* /root/.npm /root/.cache

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["node", "apps/frontend/server.js"]
