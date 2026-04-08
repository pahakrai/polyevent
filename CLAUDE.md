# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Root-level commands (from `package.json`)
- `npm start` - Start all services (via NX `run-many --target=serve --all`)
- `npm run build` - Build all projects
- `npm run test` - Run tests for all projects
- `npm run lint` - Lint all projects
- `npm run format` - Format code with Prettier
- `npm run docker:up` - Start Docker Compose services (PostgreSQL, MongoDB, Redis, Kafka, Elasticsearch, etc.)
- `npm run docker:down` - Stop Docker Compose services
- `npm run k8s:apply` - Apply Kubernetes manifests
- `npm run k8s:delete` - Delete Kubernetes resources

### Database operations (per service)
Each NestJS service has its own database. Use `npm run db:<action>:<service>` where `<service>` is `auth`, `user`, `vendor`, `event`, `booking`, `notification`, `analytics`, `admin`. Actions:
- `db:generate` - Generate Drizzle migrations
- `db:migrate` - Run migrations
- `db:seed` - Seed database
- `db:studio` - Open Drizzle Studio UI
- `db:push` - Push schema changes (development)

### NX commands
- `nx run-many --target=serve --projects=<comma-separated>` - Start specific services
- `nx build <project>` - Build a single project
- `nx test <project>` - Run tests for a single project
- `nx lint <project>` - Lint a single project

### Service-specific commands
- **Frontend**: `cd apps/frontend && npm run dev` (Next.js dev server)
- **NestJS services**: `cd apps/nestjs-services/<service> && npm run start:dev` (watch mode)
- **Python workers**: See `apps/python-workers/`

## Architecture Overview

This is an NX monorepo for an event booking platform connecting casual musicians, activity organizers, and users. The architecture follows microservices principles with event-driven communication.

### High-level structure
- **Frontend**: Next.js 14+ with App Router, Shadcn/ui, TanStack Query, Zustand
- **Backend**: NestJS microservices (API Gateway, Auth, User, Vendor, Event, Booking, Search, Notification, Analytics, Admin)
- **Data infrastructure**: PostgreSQL (per service), MongoDB, Redis, Elasticsearch, Kafka
- **Machine Learning**: Python workers for ML training, inference, and Kafka consumers
- **DevOps**: Docker, Kubernetes, Helm, GitHub Actions, monitoring (Prometheus/Grafana/ELK)

### Key architectural patterns
- **Microservices**: Each service owns its database and exposes well-defined APIs
- **Event-driven**: Async communication via Kafka for eventual consistency
- **API Gateway**: Single entry point with routing, rate limiting, circuit breaking
- **Database per service**: Each microservice has its own PostgreSQL database
- **CQRS**: Read/write separation in search service
- **Saga pattern**: Distributed transactions (e.g., booking flow)

### Data flow highlights
1. **User search**: Frontend → API Gateway → Search Service → Elasticsearch → Event Service (availability enrichment)
2. **Booking**: Frontend → Booking Service → Event Service (validation) → Stripe → Notification Service → Kafka (analytics)
3. **Vendor onboarding**: Vendor Service → Admin Service (approval) → Notification Service

## Library Architecture

Shared libraries in `libs/` vary in framework coupling:

| Library | Coupling | Status | Notes |
|---------|----------|--------|-------|
| `shared-types` | Framework-agnostic | ✅ Complete | Pure TypeScript interfaces |
| `kafka-client` | NestJS-coupled | 🚧 Stub | Base classes with `@Injectable()` |
| `database-client` | NestJS-coupled | 🚧 Stub | Client wrappers with `@Injectable()` |
| `elasticsearch-client` | Mixed | 🚧 Partial | Client is NestJS, query builders are framework-agnostic |
| `utils` | Mixed | ✅ Partial | Validators/transformers complete, logger stub |

**Important**: Most libraries are NestJS-coupled, which is acceptable as all services use NestJS. See `LIBRARY_AUDIT.md` for detailed analysis.

## Database Setup

Each microservice has its own PostgreSQL database managed with Drizzle ORM:

| Service | Database | Schema location |
|---------|----------|----------------|
| API Gateway | `gateway_db` | `apps/nestjs-services/api-gateway/src/database/` |
| Auth Service | `auth_db` | `apps/nestjs-services/auth-service/src/database/` |
| User Service | `user_db` | `apps/nestjs-services/user-service/src/database/` |
| Vendor Service | `vendor_db` | `apps/nestjs-services/vendor-service/src/database/` |
| Event Service | `event_db` | `apps/nestjs-services/event-service/src/database/` |
| Booking Service | `booking_db` | `apps/nestjs-services/booking-service/src/database/` |
| Notification Service | `notification_db` | `apps/nestjs-services/notification-service/src/database/` |
| Analytics Service | `analytics_db` | `apps/nestjs-services/analytics-service/src/database/` |
| Admin Service | `admin_db` | `apps/nestjs-services/admin-service/src/database/` |

### Setup steps
1. Copy `.env.example` to `.env` and adjust database URLs
2. `npm run docker:up` - Start PostgreSQL and other dependencies
3. Run migrations per service: `npm run db:migrate:auth`, etc.
4. Seed databases: `npm run db:seed:auth`, etc.

See `DATABASE_SETUP.md` for detailed instructions.

## Development Workflow

### Local development
1. Start dependencies: `npm run docker:up`
2. Run services: `nx run-many --target=serve --projects=frontend,api-gateway,auth-service` (or use `npm start` for all)
3. Frontend runs on http://localhost:3002, API Gateway on http://localhost:3000

### Creating a new microservice
1. Generate NestJS service: `nx generate @nx/nest:library <service-name> --directory=apps/nestjs-services`
2. Add to `docker-compose.yml` and Kubernetes manifests
3. Configure API Gateway routing
4. Create database schema and migrations

### Code standards
- TypeScript strict mode
- ESLint and Prettier configured
- Jest for unit tests, Supertest for API tests
- Conventional commits

## Service Details

### Frontend (Next.js)
- Pages: Home, Search, Event Details, Booking, User Dashboard, Vendor Dashboard, Admin Panel
- State: Zustand (client), TanStack Query (server)
- Styling: Tailwind CSS with Shadcn/ui components
- Map integration: Google Maps/Mapbox
- Payment: Stripe

### Backend services
See `README.md` for detailed descriptions of each service (Auth, User, Vendor, Event, Booking, Search, Notification, Analytics, Admin).

### Python workers
- `ml-training/`: Batch training of recommendation models
- `inference/`: Real-time recommendations, search ranking
- `kafka-consumers/`: Process user activity streams

## Important Notes

### Environment variables
- Required variables are in `.env.example`
- Each service expects its own `*_DATABASE_URL`
- Kafka, Redis, Elasticsearch connections configured via environment variables
- JWT secrets, Stripe keys, SMTP credentials needed for full functionality

### Dependency management
- **Root dependencies**: Drizzle ORM, Neon database driver, dotenv (see root `package.json`)
- **Service dependencies**: Each NestJS service has its own `package.json` with NestJS dependencies
- **Library dependencies**: Shared libraries assume peer dependencies (e.g., `@nestjs/common`) provided by consuming services
- **Python dependencies**: `requirements.txt` in `apps/python-workers/`
- **Development**: Use `npm install` at root; service-specific dependencies are hoisted via workspaces

### Claude Code settings
- Custom permissions are configured in `.claude/settings.local.json` allowing Bash commands for directory operations, PowerShell, find, and xargs grep.
- These permissions are specific to this workspace and may affect tool availability.

### Project status
| Component | Status | Notes |
|-----------|--------|-------|
| **Frontend** | Basic structure | Next.js app with placeholder page |
| **API Gateway** | Basic structure | NestJS app with Dockerfile |
| **Auth Service** | Basic structure | Database schema defined |
| **User Service** | Basic structure | Database schema defined |
| **Vendor Service** | Basic structure | Database schema defined |
| **Event Service** | Basic structure | Database schema defined |
| **Booking Service** | Not generated | Mentioned in README but not in workspace.json |
| **Search Service** | Not generated | Mentioned in README but not in workspace.json |
| **Notification Service** | Not generated | Mentioned in README but not in workspace.json |
| **Analytics Service** | Not generated | Mentioned in README but not in workspace.json |
| **Admin Service** | Not generated | Mentioned in README but not in workspace.json |
| **Python workers** | Basic structure | ML training, inference, Kafka consumers stubs |
| **Shared libraries** | Mostly stub implementations | See `LIBRARY_AUDIT.md` for details |
| **Database schemas** | Defined per service | May need expansion for full functionality |
| **Kubernetes manifests** | Basic deployment files | API Gateway and frontend only |
| **Docker Compose** | Complete | All dependencies (PostgreSQL, MongoDB, Redis, Kafka, Elasticsearch, etc.) |
| **Monitoring** | Configured | Prometheus/Grafana in Docker Compose |

**Note**: The `workspace.json` currently lists only `frontend`, `api-gateway`, `auth-service`, `user-service`, `vendor-service`, `event-service`, and shared libraries. Other services mentioned in README need to be generated using NX generators.

No Cursor rules (`.cursorrules` or `.cursor/rules/`) or GitHub Copilot instructions (`.github/copilot-instructions.md`) are present in the repository.

### Framework assumptions
- All backend services use NestJS
- Frontend uses Next.js 14+ with App Router
- Database: PostgreSQL with Drizzle ORM
- Event streaming: Kafka
- Search: Elasticsearch

### When modifying shared libraries
Consider framework coupling: If a library is marked "NestJS-coupled", it uses `@Injectable()` and assumes `@nestjs/common` is available. This is acceptable for current monorepo but limits reuse outside NestJS.

### Testing
- Run all tests: `npm run test`
- Run specific service tests: `nx test <project>`
- Test coverage: `nx test <project> --coverage`

### Deployment
- Docker images defined per service
- Kubernetes manifests in `kubernetes/`
- CI/CD via GitHub Actions (to be implemented)

Refer to `README.md` for comprehensive architecture documentation and `DATABASE_SETUP.md` for database-specific instructions.