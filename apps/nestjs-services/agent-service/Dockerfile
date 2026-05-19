# syntax=docker/dockerfile:1
FROM node:20-alpine AS development
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Root config
COPY .yarnrc.yml ./
COPY package.json yarn.lock nx.json tsconfig.base.json workspace.json ./

# All shared libs (common infrastructure — NOT per-service)
COPY libs/ libs/

# Only THIS service's package.json (not other services)
COPY apps/nestjs-services/agent-service/package.json apps/nestjs-services/agent-service/

RUN --mount=type=cache,target=/root/.yarn,id=yarn \
    corepack enable && \
    yarn install && \
    rm -rf /tmp/* /root/.cache

# Only THIS service's source
COPY apps/nestjs-services/agent-service/ apps/nestjs-services/agent-service/
COPY scripts/entrypoint-dev.sh scripts/entrypoint-dev.sh

ENV PORT=3010
RUN --mount=type=cache,target=/app/.nx/cache,id=nx-cache \
    yarn nx build agent-service && chmod +x scripts/entrypoint-dev.sh

ENV NODE_ENV=development
EXPOSE 3010
EXPOSE 9234

CMD ["/app/scripts/entrypoint-dev.sh", "agent-service"]

# ---- Stage 2: builder (production build) ----
FROM development AS builder
ENV NODE_ENV=production
RUN yarn nx build agent-service

# ---- Stage 3: production (minimal runtime) ----
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup

COPY .yarnrc.yml package.json yarn.lock nx.json tsconfig.base.json workspace.json ./
COPY libs/ libs/
COPY apps/nestjs-services/agent-service/package.json apps/nestjs-services/agent-service/

RUN --mount=type=cache,target=/root/.yarn,id=yarn \
    corepack enable && yarn workspaces focus agent-service --production

COPY --from=builder /app/apps/nestjs-services/agent-service/dist dist
COPY scripts/entrypoint-prod.sh entrypoint.sh
RUN chmod +x entrypoint.sh

USER appuser
ENV NODE_ENV=production
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3010/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"
CMD ["/app/entrypoint.sh", "agent-service"]
