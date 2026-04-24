# Event Booking App for Casual Musicians - Architecture Guideline

## Overview
A comprehensive event booking platform connecting casual musicians and activity organizers with users looking for local events. The system supports three main user roles: Common Users, Vendors (Event Organizers), and System Administrators.

## Technology Stack

### Frontend
- **Next.js 14+** with App Router
- **Shadcn/ui** for component library
- **TanStack Query** for data fetching
- **Zustand** for client state management
- **Map Integration** (Google Maps/Mapbox) for location-based search
- **Stripe** for payment processing

### Backend Microservices (NestJS)
- **API Gateway** - Main entry point with request routing, rate limiting, circuit breaking
- **Auth Service** - JWT-based authentication, RBAC, OAuth2 integration
- **User Service** - User profile management, preferences, activity history
- **Vendor Service** - Vendor onboarding, verification, management
- **Event Service** - Event CRUD, scheduling, availability management
- **Booking Service** - Ticket bookings, payment processing, cancellation
- **Search Service** - Elasticsearch integration for events/vendors search
- **Notification Service** - Email/SMS/push notifications
- **Analytics Service** - User activity tracking, Kafka integration
- **Admin Service** - Administrative operations, reporting

### Data Infrastructure
- **PostgreSQL** - Primary relational database for transactional data
- **MongoDB** - For flexible document storage (user preferences, event details)
- **Redis** - Caching, session storage, rate limiting
- **Elasticsearch** - Full-text search, geospatial queries, personalized ranking
- **Kafka** - Event streaming for user activities, analytics pipeline

### Machine Learning (Python)
- **ML Training Pipeline** - Batch training of recommendation models
- **Inference Service** - Real-time recommendations, search ranking
- **Kafka Consumers** - Process user activity streams for model features
- **Feature Store** - Centralized feature management

### DevOps
- **Docker** - Containerization of all services
- **Kubernetes** - Orchestration, auto-scaling, service discovery
- **Helm** - Kubernetes package management
- **GitHub Actions** - CI/CD pipeline
- **Monitoring** - Prometheus, Grafana, ELK stack for logging
- **Terraform** - Infrastructure as Code

## Architecture Principles

### 1. Microservices Design
- Each service owns its data and exposes well-defined APIs
- Async communication via Kafka for eventual consistency
- API Gateway for request routing and composition
- Service discovery via Kubernetes services

### 2. Event-Driven Architecture
- User activities published to Kafka topics
- Multiple consumers for different purposes (analytics, ML, notifications)
- Event sourcing for critical business workflows

### 3. Data Consistency
- Saga pattern for distributed transactions (e.g., booking flow)
- CQRS pattern for read/write separation in search service
- Eventual consistency for non-critical data

### 4. Security
- JWT tokens with short expiration
- Role-based access control (RBAC)
- API Gateway as security perimeter
- Secrets management via Kubernetes Secrets/HashiCorp Vault

## NX Monorepo Structure

```
event-booking-app/
├── nx.json                          # NX workspace configuration
├── workspace.json                   # Workspace project definitions
├── package.json                     # Root dependencies
├── tsconfig.base.json              # Base TypeScript configuration
├── docker-compose.yml              # Local development environment
├── kubernetes/                     # K8s deployment manifests
│   ├── namespaces/
│   ├── deployments/
│   ├── services/
│   └── ingress/
├── apps/
│   ├── frontend/                   # Next.js application
│   │   ├── src/
│   │   │   ├── app/               # App router pages
│   │   │   ├── components/        # Reusable components
│   │   │   ├── lib/              # Frontend libraries
│   │   │   │   ├── api/          # API client utilities
│   │   │   │   ├── hooks/        # Custom React hooks
│   │   │   │   └── utils/        # Helper functions
│   │   │   ├── styles/           # Global styles
│   │   │   └── types/            # Frontend type definitions
│   │   ├── public/                # Static assets
│   │   ├── Dockerfile             # Frontend Docker image
│   │   └── next.config.js
│   │
│   ├── nestjs-services/
│   │   ├── api-gateway/           # Main entry point
│   │   │   ├── src/
│   │   │   │   ├── filters/       # Exception filters
│   │   │   │   ├── guards/        # Auth guards
│   │   │   │   ├── interceptors/  # Request/response interceptors
│   │   │   │   ├── middleware/    # Global middleware
│   │   │   │   └── main.ts        # Application bootstrap
│   │   │   └── Dockerfile
│   │   │
│   │   ├── auth-service/          # Authentication & RBAC
│   │   ├── user-service/          # User profiles
│   │   ├── vendor-service/        # Vendor onboarding & management
│   │   ├── event-service/         # Event CRUD & management
│   │   ├── booking-service/       # Ticket bookings & payments
│   │   ├── search-service/        # Elasticsearch integration
│   │   ├── notification-service/  # Email/SMS notifications
│   │   ├── analytics-service/     # User activity tracking
│   │   └── admin-service/         # Admin dashboard backend
│   │
│   └── python-workers/
│       ├── ml-training/           # Model training pipeline
│       │   ├── trainers/          # Training scripts
│       │   ├── models/            # Model definitions
│       │   ├── data_pipeline.py   # Data processing pipeline
│       │   └── requirements.txt
│       ├── inference/             # Real-time inference
│       │   ├── recommenders/      # Recommendation engines
│       │   ├── search_ranker.py   # Search ranking model
│       │   ├── activity_analyzer.py # User activity analysis
│       │   └── requirements.txt
│       ├── kafka-consumers/       # Event processors
│       │   ├── user_activity.py   # User activity processor
│       │   ├── booking_analytics.py # Booking analytics processor
│       │   ├── vendor_performance.py # Vendor performance processor
│       │   └── requirements.txt
│       └── Dockerfile
│
├── libs/
│   ├── shared-types/              # TypeScript interfaces
│   │   ├── src/
│   │   │   ├── user.interface.ts
│   │   │   ├── event.interface.ts
│   │   │   ├── vendor.interface.ts
│   │   │   ├── booking.interface.ts
│   │   │   ├── auth.interface.ts
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   │
│   ├── kafka-client/              # Shared Kafka utilities
│   │   ├── src/
│   │   │   ├── producers/         # Kafka producers
│   │   │   ├── consumers/         # Kafka consumers
│   │   │   ├── schemas/          # Avro/JSON schemas
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   │
│   ├── database-client/           # Database abstractions
│   │   ├── src/
│   │   │   ├── postgres/          # PostgreSQL client
│   │   │   ├── mongodb/           # MongoDB client
│   │   │   ├── redis/             # Redis client
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   │
│   ├── elasticsearch-client/      # Elasticsearch utilities
│   │   ├── src/
│   │   │   ├── client.ts          # ES client wrapper
│   │   │   ├── indices/           # Index definitions
│   │   │   └── queries/           # Search query builders
│   │   └── tsconfig.json
│   │
│   └── utils/                     # Shared utilities
│       ├── src/
│       │   ├── logger/            # Structured logging
│       │   ├── validators/        # Data validation
│       │   ├── transformers/      # Data transformation
│       │   └── index.ts
│       └── tsconfig.json
│
└── tools/
    ├── scripts/                   # Development scripts
    ├── helm-charts/               # Helm charts for services
    └── terraform/                 # Infrastructure as Code
```

## Service Details

### 1. Frontend (Next.js)
- **Pages**: Home, Search, Event Details, Booking, User Dashboard, Vendor Dashboard, Admin Panel
- **Features**: Location-based search, Real-time availability, Payment integration, Responsive design
- **State Management**: Zustand for client state, TanStack Query for server state
- **Styling**: Tailwind CSS with Shadcn/ui components

### 2. API Gateway
- **Routing**: Request routing to appropriate microservices
- **Security**: Authentication verification, rate limiting
- **Resilience**: Circuit breaker, retry logic, timeout handling
- **Monitoring**: Request logging, metrics collection

### 3. Auth Service
- **Authentication**: JWT token generation/validation, OAuth2 (Google, Facebook)
- **Authorization**: RBAC with roles (user, vendor, admin)
- **Security**: Password hashing (bcrypt), token refresh mechanism

### 4. User Service
- **Profile Management**: CRUD operations, preferences, upload avatar
- **Activity History**: Track user interactions, bookings, searches
- **Preferences**: Musical interests, location preferences, notification settings

### 5. Vendor Service
- **Onboarding**: Vendor registration, verification, document upload
- **Management**: Vendor profile, venue details, payment settings
- **Performance**: Analytics on event performance, customer ratings

### 6. Event Service
- **Event Management**: Create, update, delete events
- **Scheduling**: Date/time management, recurrence patterns
- **Availability**: Ticket inventory, capacity management
- **Pricing**: Dynamic pricing, discount codes

### 7. Booking Service
- **Reservations**: Seat selection, ticket types, group bookings
- **Payments**: Integration with Stripe/PayPal, refund processing
- **Confirmation**: Booking confirmation, QR code generation
- **Cancellation**: Cancellation policies, partial refunds

### 8. Search Service
- **Elasticsearch**: Full-text search, geospatial queries, faceted search
- **Personalization**: Ranking based on user preferences, past behavior
- **Filters**: Date, price, location, event type, musician genre

### 9. Notification Service
- **Channels**: Email, SMS, push notifications, in-app messages
- **Templates**: Customizable notification templates
- **Scheduling**: Time-based notifications (reminders, updates)

### 10. Analytics Service
- **Event Tracking**: User activities, booking funnel, conversion rates
- **Kafka Integration**: Real-time event streaming
- **Reporting**: Dashboards for business metrics

### 11. Admin Service
- **Dashboard**: System overview, user management, content moderation
- **Reporting**: Financial reports, user growth, event performance
- **System Management**: Feature flags, maintenance mode

## Data Flow

### User Search Flow
1. User enters search criteria (location, date, genre)
2. Frontend calls Search Service via API Gateway
3. Search Service queries Elasticsearch with personalized ranking
4. Results enriched with availability from Event Service
5. Response returned to frontend with pagination

### Booking Flow
1. User selects event and tickets
2. Frontend calls Booking Service to reserve tickets
3. Booking Service validates availability with Event Service
4. Payment processed via Stripe integration
5. Booking confirmed, notifications sent via Notification Service
6. Booking event published to Kafka for analytics

### Vendor Onboarding Flow
1. Vendor submits registration form
2. Vendor Service stores profile (pending verification)
3. Admin reviews and approves via Admin Service
4. Notification sent to vendor upon approval
5. Vendor can now create events

## Kafka Topics
- `user-activities` - User clicks, searches, page views
- `booking-events` - Booking creations, updates, cancellations
- `vendor-events` - Vendor registrations, event creations
- `notification-events` - Notification delivery status
- `ml-training` - Features for model training

## Deployment Strategy

- **Local dev**: Infrastructure via `docker compose`, apps via `nx serve` (hot reload)
- **Staging**: Docker images tagged with git SHA, deployed to K8s staging namespace
- **Production**: Docker images promoted from staging, K8s rolling updates with PDBs
- **CI/CD**: GitHub Actions — test → build → scan → deploy → monitor
- **Secrets**: Placeholder secrets in repo, real values via External Secrets Operator or Vault

## Quick Start — Three Ways to Develop

Choose the path that fits your workflow. All three run the full platform.

| | Path A: Local Process | Path B: Docker Compose | Path C: Kubernetes |
|---|---|---|---|
| **Best for** | Daily development | One-command setup | K8s-native dev |
| **App runtime** | Node on host | Docker containers | K8s pods |
| **Infra** | Docker Compose | Docker Compose | Docker Compose |
| **Hot reload** | Instant (native) | Volume mounts | Rebuild & redeploy |
| **Debugger** | Native attach | Needs config | Needs config |

### Prerequisites (all paths)
- **Node.js 20+** and **npm 10+**
- **Docker Desktop** (or Docker Engine + Docker Compose)

---

### Path A: Local Process (Recommended for Daily Development)

Infrastructure runs in Docker. Application services run as local Node.js processes — fastest feedback loop, native debugging, no container overhead.

```bash
# 1. Clone and install
git clone <repo-url>
cd polydom
npm install

# 2. Configure environment
cp .env.example .env
```

**`.env` for local development** — services connect to Docker Compose infra on localhost:

```bash
# Override with localhost URLs so nx-served apps reach Docker infra
AUTH_DATABASE_URL=postgresql://eventbooking:eventbooking123@localhost:5432/auth_db
USER_DATABASE_URL=postgresql://eventbooking:eventbooking123@localhost:5432/user_db
VENDOR_DATABASE_URL=postgresql://eventbooking:eventbooking123@localhost:5432/vendor_db
EVENT_DATABASE_URL=postgresql://eventbooking:eventbooking123@localhost:5432/event_db
GATEWAY_DATABASE_URL=postgresql://eventbooking:eventbooking123@localhost:5432/gateway_db
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
ELASTICSEARCH_HOSTS=http://localhost:9200
```

```bash
# 3. Start infrastructure
npm run dev:infra

# 4. Verify infra is healthy
docker compose -f docker-compose.infra.yml ps

# 5. Run services locally (each in its own terminal, or use nx run-many)
nx serve api-gateway          # → http://localhost:3000
nx serve auth-service         # → http://localhost:3001
nx serve user-service         # → http://localhost:3002
nx serve vendor-service       # → http://localhost:3003
nx serve event-service        # → http://localhost:3004

# Or start multiple at once:
nx run-many --target=serve --projects=api-gateway,auth-service,user-service
```

**Hot reload**: NestJS watch mode recompiles on every file save — near-instant. No Docker rebuild.

**Debugger**: Attach VS Code directly to the Node process. Add this to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to NestJS",
  "port": 9229,
  "restart": true
}
```

Then start a service with `--debug`:

```bash
nx serve auth-service -- --debug
```

**Run database commands** from the host (same as the service would):

```bash
npm run db:generate:auth
npm run db:migrate:auth
npm run db:seed:auth
npm run db:studio:auth
```

**Seed all services** for a working dev setup:

```bash
for svc in auth user vendor event; do
  npm run db:push:$svc
  npm run db:seed:$svc
done
```

**Stop**:

```bash
npm run dev:infra:down
# Ctrl+C in each nx serve terminal
```

| Service | Port | URL |
|---|---|---|
| API Gateway + Swagger | 3000 | http://localhost:3000 / http://localhost:3000/api-docs |
| Auth Service | 3001 | http://localhost:3001 |
| User Service | 3002 | http://localhost:3002 |
| Vendor Service | 3003 | http://localhost:3003 |
| Event Service | 3004 | http://localhost:3004 |

---

### Path B: Docker Compose (Everything in Containers)

One command, no host Node.js needed. Infrastructure and all services run in Docker with hot reload via volume mounts.

```bash
git clone <repo-url>
cd polydom
npm install
cp .env.example .env

# Start everything
npm run dev
```

First run takes a few minutes (installs dependencies). Subsequent runs use Docker cache. Source is volume-mounted — NestJS watch mode restarts inside the container on file changes.

| Service | Port | URL |
|---|---|---|
| API Gateway | 3000 | http://localhost:3000 |
| Auth Service | 3001 | http://localhost:3001 |
| User Service | 3002 | http://localhost:3002 |
| Vendor Service | 3003 | http://localhost:3003 |
| Event Service | 3004 | http://localhost:3004 |
| Frontend | 3005 | http://localhost:3005 |
| Grafana | 3001 | http://localhost:3001 (admin/admin) |
| Kibana | 5601 | http://localhost:5601 |
| Prometheus | 9090 | http://localhost:9090 |

Stop:

```bash
npm run dev:down
```

---

### Path C: Kubernetes (Local Cluster)

Infrastructure in Docker Compose, application services in a local K8s cluster.

**Additional prerequisite**: A local Kubernetes cluster:
- **Docker Desktop** — Enable Kubernetes in Settings → restart
- **Minikube** — `minikube start`
- **Kind** — `kind create cluster`

```bash
git clone <repo-url>
cd polydom
npm install
cp .env.example .env

# Start infra + deploy to K8s
npm run k8s:dev:up
```

**Build images** for your local cluster:

```bash
# Docker Desktop — images are shared automatically, just build
docker build -f apps/nestjs-services/auth-service/Dockerfile -t polydom/auth-service:dev .

# Minikube — point Docker at Minikube's daemon first
eval $(minikube docker-env)

# Kind — load after building
kind load docker-image polydom/auth-service:dev

# Build all services
for svc in api-gateway auth-service user-service vendor-service event-service; do
  docker build -f apps/nestjs-services/$svc/Dockerfile -t polydom/$svc:dev .
done
```

**Verify**:

```bash
kubectl get pods -n polydom-dev
kubectl port-forward -n polydom-dev svc/api-gateway 3000:3000
curl http://localhost:3000/health
```

**Tear down**:

```bash
npm run k8s:dev:down
```

---

### Skaffold (K8s Hot Reload — Optional)

For a fully automated K8s dev loop (watch → build → deploy), install [Skaffold](https://skaffold.dev):

```bash
skaffold dev
```

Skaffold watches source files, rebuilds Docker images, and redeploys to the cluster on every change.

---

### Shared Infrastructure Services

Both paths use the same infrastructure services. Default ports:

| Service | Port | Credentials |
|---|---|---|
| PostgreSQL | 5432 | `eventbooking` / `eventbooking123` |
| MongoDB | 27017 | `root` / `mongopass123` |
| Redis | 6379 | password: `redispass123` |
| Kafka | 9092 | — |
| Elasticsearch | 9200 | — |

---

## Database Operations

Each microservice owns its database schema. **All `db:*` commands are explicit** — nothing runs automatically.

### Generate a migration (from schema changes)

```bash
npm run db:generate:auth      # auth-service
npm run db:generate:user      # user-service
npm run db:generate:vendor    # vendor-service
npm run db:generate:event     # event-service
```

Migration SQL is written to `src/database/migrations/` — commit these files.

### Apply migrations (development only)

```bash
npm run db:migrate:auth       # apply auth-service migrations
npm run db:migrate:user       # apply user-service migrations
npm run db:migrate:vendor     # apply vendor-service migrations
npm run db:migrate:event      # apply event-service migrations
```

### Push schema directly (prototyping, skips migration files)

```bash
npm run db:push:auth
npm run db:push:user
npm run db:push:vendor
npm run db:push:event
```

### Push schema to Neon (production database)

```bash
npm run db:push:neon:all      # push all services to Neon
npm run db:push:neon:auth     # push auth-service to Neon
```

### Seed test data

```bash
npm run db:seed:auth
npm run db:seed:user
npm run db:seed:vendor
npm run db:seed:event
```

### Open Drizzle Studio (visual DB explorer)

```bash
npm run db:studio:auth
npm run db:studio:user
```

---

## Building for Production

### Build all projects

```bash
npm run build                 # nx run-many --target=build --all
nx build api-gateway          # build a single project
```

### Build Docker images

All Dockerfiles build from the **repo root** so shared libraries are available:

```bash
# Build a single service image
docker build \
  -f apps/nestjs-services/auth-service/Dockerfile \
  -t polydom/auth-service:latest \
  .

# Build with git SHA tag (CI/CD standard)
export IMAGE_TAG=$(git rev-parse --short HEAD)
docker build \
  -f apps/nestjs-services/auth-service/Dockerfile \
  -t polydom/auth-service:$IMAGE_TAG \
  -t polydom/auth-service:latest \
  .

# Build all services
for svc in api-gateway auth-service user-service vendor-service event-service; do
  docker build \
    -f apps/nestjs-services/$svc/Dockerfile \
    -t polydom/$svc:latest \
    .
done
```

### Image security scan (before pushing to registry)

```bash
docker scan polydom/auth-service:latest        # Docker Scout (built-in)
# or
trivy image polydom/auth-service:latest        # Trivy (OSS)
```

---

## Kubernetes Deployment

### Prerequisites
- **kubectl** configured with a cluster context
- **Docker registry** accessible from the cluster (Docker Hub, ECR, GCR, etc.)
- **Ingress controller** installed in the cluster (nginx-ingress)

### 1. Create the namespace

```bash
kubectl apply -f kubernetes/namespaces/production.yaml
```

### 2. Deploy secrets and config

```bash
kubectl apply -f kubernetes/secrets/
kubectl apply -f kubernetes/configmaps/
```

> **Production note**: Replace placeholder values in secrets with real credentials before applying.
> Use **Sealed Secrets** or **External Secrets Operator** for GitOps-compatible secret management.

### 3. Deploy stateful infrastructure

```bash
kubectl apply -f kubernetes/stateful/postgres.yaml
kubectl apply -f kubernetes/stateful/redis.yaml
```

For Kafka and Elasticsearch, use operators in production:
- **Kafka**: [Strimzi operator](https://strimzi.io) — see CR reference in `kubernetes/stateful/kafka.yaml`
- **Elasticsearch**: [ECK operator](https://www.elastic.co/guide/en/cloud-on-k8s/current/k8s-overview.html) — see CR reference in `kubernetes/stateful/elasticsearch.yaml`

### 4. Deploy application services

```bash
# Deploy all backend services
kubectl apply -f kubernetes/deployments/

# Deploy services (ClusterIP)
kubectl apply -f kubernetes/services/

# Deploy network policies
kubectl apply -f kubernetes/network-policies/

# Deploy pod disruption budgets
kubectl apply -f kubernetes/pod-disruption-budgets/

# Deploy service account and RBAC
kubectl apply -f kubernetes/service-accounts/
```

### 5. Deploy ingress

```bash
kubectl apply -f kubernetes/ingress/
```

### 6. Verify deployment

```bash
kubectl get pods -n production
kubectl get svc -n production
kubectl get ingress -n production

# Check health endpoints
kubectl port-forward -n production svc/api-gateway 3000:80
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
```

### 7. Apply all manifests at once

```bash
kubectl apply -f kubernetes/ --recursive
```

### Rolling restart (after image update)

```bash
kubectl rollout restart deployment/auth-service -n production
kubectl rollout status deployment/auth-service -n production
```

---

## Testing

```bash
npm run test                  # all projects
nx test auth-service          # single service
nx test auth-service --watch  # watch mode
nx test auth-service --coverage # with coverage
```

## Linting & Formatting

```bash
npm run lint                  # all projects
npm run format                # Prettier all projects
nx lint auth-service          # single service
```

## Creating a New Microservice

```bash
# Generate NestJS service
nx generate @nx/nest:application booking-service --directory=apps/nestjs-services

# Register in workspace.json under "projects"
# Add database schema in src/database/schema.ts
# Add drizzle.config.ts and package.json db scripts
# Configure API Gateway routing
```

## Code Standards

- **TypeScript**: Strict mode, ESLint, Prettier
- **Testing**: Jest for unit tests, Supertest for API tests
- **Documentation**: OpenAPI/Swagger at `/api-docs`
- **Git**: Conventional commits, PR reviews

## Monitoring & Observability

### Logging
- Structured JSON logs
- Centralized log aggregation (ELK stack)
- Log correlation via request IDs

### Metrics
- Prometheus metrics for each service
- Custom business metrics (bookings, searches, conversions)
- Grafana dashboards for visualization

### Tracing
- Distributed tracing with Jaeger
- Request flow across microservices
- Performance bottleneck identification

## Security Considerations

### Data Protection
- **Encryption**: TLS for transit, encryption at rest
- **PII**: Mask sensitive data in logs, GDPR compliance
- **Payment**: PCI DSS compliance for payment processing

### Access Control
- **Least Privilege**: Minimal permissions for each service
- **API Security**: Input validation, SQL injection prevention
- **Audit Logging**: All admin actions logged

### Infrastructure Security
- **Network Policies**: Kubernetes network segmentation
- **Secrets Management**: Encrypted secrets, rotation policies
- **Vulnerability Scanning**: Regular container scanning

## Scaling Strategy

### Horizontal Scaling
- Stateless services scale horizontally
- Database read replicas for read-heavy workloads
- Elasticsearch cluster for search performance

### Caching Strategy
- Redis cache for frequently accessed data
- CDN for static assets and images
- Browser caching for frontend assets

### Database Optimization
- Index optimization for query performance
- Connection pooling
- Query caching where appropriate

## Future Enhancements

### Short-term
1. Mobile app (React Native)
2. Social features (event sharing, reviews)
3. Advanced analytics dashboard

### Medium-term
1. AI-powered event recommendations
2. Dynamic pricing based on demand
3. Virtual event capabilities

### Long-term
1. International expansion
2. Marketplace for music instructors
3. Integration with music streaming platforms

## Team Structure Recommendations

### Development Teams
1. **Frontend Team**: Next.js, UI/UX, mobile responsive
2. **Backend Team**: Microservices, databases, APIs
3. **Data Team**: Elasticsearch, Kafka, ML pipelines
4. **DevOps Team**: Kubernetes, CI/CD, monitoring
5. **QA Team**: Testing, automation, performance

## Project Status

| Component | Status |
|---|---|
| Frontend | Basic structure (Next.js + placeholder page) |
| API Gateway | NestJS app with health endpoints, Swagger |
| Auth Service | Schema + migrations + seed data |
| User Service | Schema + migrations + seed data + onion architecture |
| Vendor Service | Schema + migrations + seed data |
| Event Service | Schema + migrations + seed data |
| Booking Service | Not generated |
| Search Service | Not generated |
| Notification Service | Not generated |
| Analytics Service | Not generated |
| Admin Service | Not generated |
| Shared Libraries | `shared-types` (complete), `database-client` (complete), others stubs |
| Docker | Multi-stage production Dockerfiles for all services |
| Kubernetes | Deployments, services, network policies, PDBs, secrets, configmaps |
| Migrations | Generated for auth, user, vendor, event services |