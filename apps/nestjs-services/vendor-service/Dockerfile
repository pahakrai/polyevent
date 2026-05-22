# syntax=docker/dockerfile:1
FROM node:20-alpine AS development
WORKDIR /app
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
COPY .yarnrc.yml package.json yarn.lock nx.json tsconfig.base.json workspace.json ./
COPY libs/auth/package.json libs/auth/
COPY libs/database-client/package.json libs/database-client/
COPY libs/elasticsearch-client/package.json libs/elasticsearch-client/
COPY libs/kafka-client/package.json libs/kafka-client/
COPY libs/nats-client/package.json libs/nats-client/
COPY libs/shared-types/package.json libs/shared-types/
COPY libs/utils/package.json libs/utils/
COPY apps/nestjs-services/vendor-service/package.json apps/nestjs-services/vendor-service/
RUN --mount=type=cache,target=/root/.yarn,id=yarn corepack enable && yarn install
COPY libs/ libs/
COPY apps/nestjs-services/vendor-service/ apps/nestjs-services/vendor-service/
COPY scripts/entrypoint-dev.sh scripts/entrypoint-dev.sh
RUN chmod +x scripts/entrypoint-dev.sh
ENV NODE_ENV=development PORT=3000
EXPOSE 3000 9232
CMD ["/app/scripts/entrypoint-dev.sh", "vendor-service"]
FROM development AS builder
ENV NODE_ENV=production
RUN yarn nx build vendor-service
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
COPY .yarnrc.yml package.json yarn.lock nx.json tsconfig.base.json workspace.json ./
COPY libs/ libs/
COPY apps/nestjs-services/vendor-service/package.json apps/nestjs-services/vendor-service/
RUN --mount=type=cache,target=/root/.yarn,id=yarn corepack enable && yarn workspaces focus vendor-service --production
RUN rm -rf libs/ apps/
COPY --from=builder /app/apps/nestjs-services/vendor-service/dist dist
COPY scripts/entrypoint-prod.sh entrypoint.sh
RUN chmod +x entrypoint.sh
USER appuser
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "require('http').get('http://localhost:3000/health',(r)=>{process.exit(r.statusCode===200?0:1)})"
CMD ["/app/entrypoint.sh", "vendor-service"]
