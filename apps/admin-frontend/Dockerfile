# Production-grade multi-stage Dockerfile — monorepo context
# Build from repo root: docker build -f apps/admin-frontend/Dockerfile .
# syntax=docker/dockerfile:1

# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY .yarnrc.yml ./
COPY package.json yarn.lock nx.json tsconfig.base.json workspace.json ./
COPY libs/auth/package.json libs/auth/
COPY libs/database-client/package.json libs/database-client/
COPY libs/elasticsearch-client/package.json libs/elasticsearch-client/
COPY libs/kafka-client/package.json libs/kafka-client/
COPY libs/nats-client/package.json libs/nats-client/
COPY libs/shared-types/package.json libs/shared-types/
COPY libs/utils/package.json libs/utils/
COPY apps/frontend/package.json apps/frontend/
COPY apps/admin-frontend/package.json apps/admin-frontend/
COPY apps/nestjs-services/api-gateway/package.json apps/nestjs-services/api-gateway/
COPY apps/nestjs-services/auth-service/package.json apps/nestjs-services/auth-service/
COPY apps/nestjs-services/user-service/package.json apps/nestjs-services/user-service/
COPY apps/nestjs-services/vendor-service/package.json apps/nestjs-services/vendor-service/
COPY apps/nestjs-services/event-service/package.json apps/nestjs-services/event-service/
COPY apps/nestjs-services/booking-service/package.json apps/nestjs-services/booking-service/
COPY apps/nestjs-services/agent-service/package.json apps/nestjs-services/agent-service/
COPY apps/nestjs-services/search-service/package.json apps/nestjs-services/search-service/

RUN --mount=type=cache,target=/root/.yarn,id=yarn \
    corepack enable && \
    yarn install && \
    rm -rf /tmp/* /root/.cache

# ---- Stage 2: Development (hot reload) ----
FROM node:20-alpine AS development
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY .yarnrc.yml ./
COPY package.json yarn.lock nx.json tsconfig.base.json workspace.json ./
COPY libs/auth/package.json libs/auth/
COPY libs/database-client/package.json libs/database-client/
COPY libs/elasticsearch-client/package.json libs/elasticsearch-client/
COPY libs/kafka-client/package.json libs/kafka-client/
COPY libs/nats-client/package.json libs/nats-client/
COPY libs/shared-types/package.json libs/shared-types/
COPY libs/utils/package.json libs/utils/
COPY apps/frontend/package.json apps/frontend/
COPY apps/admin-frontend/package.json apps/admin-frontend/
COPY apps/nestjs-services/api-gateway/package.json apps/nestjs-services/api-gateway/
COPY apps/nestjs-services/auth-service/package.json apps/nestjs-services/auth-service/
COPY apps/nestjs-services/user-service/package.json apps/nestjs-services/user-service/
COPY apps/nestjs-services/vendor-service/package.json apps/nestjs-services/vendor-service/
COPY apps/nestjs-services/event-service/package.json apps/nestjs-services/event-service/
COPY apps/nestjs-services/booking-service/package.json apps/nestjs-services/booking-service/
COPY apps/nestjs-services/agent-service/package.json apps/nestjs-services/agent-service/
COPY apps/nestjs-services/search-service/package.json apps/nestjs-services/search-service/

RUN --mount=type=cache,target=/root/.yarn,id=yarn \
    corepack enable && \
    yarn install && \
    rm -rf /tmp/* /root/.cache

COPY apps/admin-frontend/ apps/admin-frontend/

ENV NODE_ENV=development
EXPOSE 3000

CMD ["yarn", "nx", "run", "admin-frontend:serve"]

# ---- Stage 3: Build Next.js with NX ----
FROM deps AS builder
WORKDIR /app

COPY apps/admin-frontend/ apps/admin-frontend/

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN yarn nx build admin-frontend

# ---- Stage 4: Production runtime ----
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-frontend/.next/static ./apps/admin-frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-frontend/public ./apps/admin-frontend/public

RUN rm -rf /tmp/* /root/.yarn /root/.cache

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["node", "apps/admin-frontend/server.js"]
