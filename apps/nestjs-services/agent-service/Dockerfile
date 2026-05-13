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
