# Project Agent Instructions

This file provides guidance to AI agents (DeepSeek TUI, Claude Code, etc.) when working with code in this repository.

## File Location

Save this file as `AGENTS.md` in your project root so the CLI can load it automatically.

## Build and Development Commands

```bash
# Full monorepo
yarn start              # nx run-many --target=serve --all
yarn build              # nx run-many --target=build --all
yarn test               # nx run-many --target=test --all
yarn lint               # nx run-many --target=lint --all

# Per-service
nx build <project>      # Build single project
nx test <project>       # Test single project
nx lint <project>       # Lint single project

# Infrastructure
yarn dev:infra          # Start infra only (DBs, Redpanda, Redis, ES, NATS)
yarn dev:infra:down     # Stop infrastructure
yarn dev                # Docker Compose full stack (hot reload)
yarn dev:down           # Stop full stack
yarn skaffold:dev       # Skaffold watch: build + deploy to local K8s
yarn skaffold:run       # One-shot build + deploy

# Database (per service: auth, user, vendor, event, booking, notification, admin, agent)
yarn db:generate:<svc>  # Generate Drizzle migrations
yarn db:migrate:<svc>   # Run pending migrations
yarn db:seed:<svc>      # Seed with sample data
yarn db:push:<svc>      # Push schema directly (dev only)
yarn db:push:neon:<svc> # Push to Neon production
```

## Architecture Overview

**PolyDom** is an NX monorepo for an event booking platform connecting casual musicians, organizers, and users. Microservices architecture with PostgreSQL per service, event-driven async communication, and ML-powered recommendations.

**Tech stack**: NestJS (backend), Next.js 14 (frontend), PostgreSQL 15 + pgvector, Drizzle ORM, Redpanda (Kafka), NATS, Elasticsearch 8.11, Redis 7, Stripe, Docker, Kubernetes, GitHub Actions.

### Key Components

| Layer | Component | Description |
|-------|-----------|-------------|
| Frontend | `apps/frontend` | Customer Next.js app (TanStack Query, Zustand, Shadcn/ui) |
| Frontend | `apps/admin-frontend` | Admin dashboard Next.js app |
| Gateway | `apps/nestjs-services/api-gateway` | Single entry point, auth guards, proxy routing |
| Backend | `apps/nestjs-services/auth-service` | JWT auth, RBAC, OAuth2 |
| Backend | `apps/nestjs-services/user-service` | Profiles, preferences, musician profiles |
| Backend | `apps/nestjs-services/vendor-service` | Vendor onboarding, venue management |
| Backend | `apps/nestjs-services/event-service` | Event CRUD, scheduling, jam sessions |
| Backend | `apps/nestjs-services/booking-service` | Ticket bookings, Stripe payments, payouts |
| Backend | `apps/nestjs-services/search-service` | Elasticsearch + pgvector hybrid search |
| Backend | `apps/nestjs-services/notification-service` | Multi-channel (email/SMS/push) |
| Backend | `apps/nestjs-services/agent-service` | LLM agent, RAG, MCP tools, BullMQ |
| Backend | `apps/nestjs-services/admin-service` | Feature flags, audit logs, vendor mgmt |
| ML | `apps/python-workers/inference` | FastAPI recommendation inference |
| ML | `apps/python-workers/kafka-consumers` | Event stream processing |
| ML | `apps/python-workers/ml-training` | Batch ML model training (CronJob) |
| Libs | `libs/shared-types` | Framework-agnostic TypeScript interfaces |
| Libs | `libs/auth` | JWT auth module (NestJS) |
| Libs | `libs/kafka-client` | Redpanda producer/consumer (NestJS) |
| Libs | `libs/nats-client` | NATS messaging client (NestJS) |
| Libs | `libs/database-client` | PostgreSQL/MongoDB/Redis clients (NestJS) |
| Libs | `libs/elasticsearch-client` | ES client + query builders |
| Libs | `libs/utils` | Logger, validators, transformers |

### Data Flow

1. **User request** → Next.js frontend → API Gateway (port 3000)
2. API Gateway verifies JWT → proxies to target microservice
3. Each microservice owns its PostgreSQL database (Drizzle ORM)
4. **Async events** flow through Redpanda (Kafka API) + NATS
5. **Search** uses Elasticsearch with pgvector embeddings from ML pipeline
6. **ML pipeline**: Kafka consumers process user activity → Redis feature store → batch training → inference API
7. **Notifications** dispatched via notification-service (consumes Redpanda events)
8. **CI/CD**: GitHub Actions → Docker Buildx → push to ghcr.io → kustomize → ArgoCD sync

## Configuration Files

| File | Purpose |
|------|---------|
| `nx.json` | NX workspace configuration |
| `workspace.json` | NX project definitions (18 projects) |
| `package.json` | Root scripts, dependencies, Yarn workspaces |
| `tsconfig.base.json` | Shared TypeScript config with path aliases |
| `docker-compose.yml` | Full dev stack (infra + all services) |
| `docker-compose.infra.yml` | Infrastructure only (DBs, message brokers, monitoring) |
| `skaffold.yaml` | K8s dev loop (build + deploy + port-forward) |
| `.env.example` | Template for local environment variables |
| `.github/workflows/pr-check.yaml` | PR lint, test, dry-run build |
| `.github/workflows/deploy.yaml` | Build, push, update GitOps manifests |

## Extension Points

### Adding a new NestJS microservice
1. `nx generate @nx/nest:library <name> --directory=apps/nestjs-services`
2. Add to `docker-compose.yml` and `kubernetes/local/services.yaml`
3. Add proxy controller in `apps/nestjs-services/api-gateway/src/proxy/`
4. Register in `apps/nestjs-services/api-gateway/src/app.module.ts`
5. Add database to `tools/postgres-init/01-create-databases.sql` and `kubernetes/local/postgres-init.yaml`
6. Add to `skaffold.yaml` (artifact + portForward)
7. Add to `workspace.json` and CI matrices (`.github/workflows/`)
8. Create `kubernetes/base/deployments/<name>.yaml` for production
9. Add to `kubernetes/base/kustomization.yaml`
10. Add `db:*` scripts to root `package.json`

### Adding a shared library
1. `nx generate @nx/nest:library <name> --directory=libs`
2. Add to `tsconfig.base.json` paths
3. Add to `workspace.json` projects
4. Run `scripts/validate-dockerfiles.mjs` to ensure Dockerfiles reference it

## Commit Messages

Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
