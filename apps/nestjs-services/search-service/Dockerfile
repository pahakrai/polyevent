FROM node:20-alpine AS development
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY package.json package-lock.json nx.json tsconfig.base.json workspace.json ./
COPY libs/ libs/
COPY apps/nestjs-services/search-service/package.json apps/nestjs-services/search-service/

RUN npm ci --no-audit --no-fund && npm cache clean --force && rm -rf /tmp/* /root/.npm /root/.cache

COPY apps/nestjs-services/search-service/ apps/nestjs-services/search-service/
COPY scripts/entrypoint-dev.sh scripts/entrypoint-dev.sh

RUN npx nx build search-service && chmod +x scripts/entrypoint-dev.sh

ENV NODE_ENV=development
ENV PORT=3000
EXPOSE 3000
EXPOSE 9235

CMD ["/app/scripts/entrypoint-dev.sh", "search-service"]