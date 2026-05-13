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
COPY apps/nestjs-services/search-service/package.json apps/nestjs-services/search-service/

RUN --mount=type=cache,target=/root/.yarn,id=yarn \
    corepack enable && \
    yarn install && \
    rm -rf /tmp/* /root/.cache

# Only THIS service's source
COPY apps/nestjs-services/search-service/ apps/nestjs-services/search-service/
COPY scripts/entrypoint-dev.sh scripts/entrypoint-dev.sh

ENV PORT=3000
RUN --mount=type=cache,target=/app/.nx/cache,id=nx-cache \
    yarn nx build search-service && chmod +x scripts/entrypoint-dev.sh

ENV NODE_ENV=development
EXPOSE 3000
EXPOSE 9235

CMD ["/app/scripts/entrypoint-dev.sh", "search-service"]
