# Sample Data for Local Testing

This directory contains scripts to generate and load comprehensive sample data for local development and testing.

## Quick Start

```bash
# 1. Start infrastructure
npm run dev:infra

# 2. Seed all databases (Docker Compose)
npm run sample-data:docker:migrate

# 3. Initialize ML pipeline data (embeddings, feature store)
python scripts/sample-data/init_ml_pipeline_data.py

# 4. Start generating Redpanda events (streaming)
npm run sample-data:kafka:stream
```

## What's Included

### Sample Data Summary

| Entity | Count | Details |
|--------|-------|---------|
| Users | 25 | 3 admins, 5 vendors, 17 regular users across Finland |
| Vendors | 8 | MUSIC (2), ART (2), SPORTS (2), ACTIVITIES (2) |
| Venues | 16 | Various types, capacities 30-800, in Helsinki area |
| Time Slots | 500+ | Across all venues, 30-day window, mixed statuses |
| Events | 40 | 12 MUSIC, 8 ART, 10 SPORTS, 10 ACTIVITIES |
| Bookings | 20 | Various statuses (CONFIRMED, ATTENDED, CANCELLED, etc.) |
| Payments | 20 | Stripe, credit card, PayPal, Apple/Google Pay |
| User Activities | 500+ | Searches, views, bookings, reviews (90-day window) |
| Event Embeddings | 40 | 64-dim vectors with HNSW index in pgvector |
| User Embeddings | 25 | 64-dim vectors with HNSW index in pgvector |
| Feature Vectors | 65 | 139-dim user + event features in Redis FeatureStore |

### Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Superadmin | pahakadmin@polydom.io | Three1288 |
| Admin | admin@example.com | admin123 |
| User | user@example.com | user123 |
| Vendor | vendor@example.com | vendor123 |

All other sample users use password: `user123`

## Available Commands

### Database Seeding

```bash
# Seed all databases using TypeScript (recommended)
npm run sample-data:seed              # Seed only
npm run sample-data:seed:migrate      # Run migrations + seed

# Seed all databases in Docker Compose
npm run sample-data:docker            # Seed only
npm run sample-data:docker:migrate    # Migrate + seed

# Seed all databases in Kubernetes (Skaffold)
npm run sample-data:k8s               # Seed only (requires port-forward)
npm run sample-data:k8s:migrate       # Migrate + seed

# Seed a specific service only
npx tsx scripts/sample-data/master-seed.ts --service=auth
npx tsx scripts/sample-data/master-seed.ts --service=event

# Seed individual services directly
npm run db:seed:auth
npm run db:seed:user
npm run db:seed:vendor
npm run db:seed:event
npm run db:seed:booking
```

### Event Generation

```bash
# One-shot: generate 50 events per topic
npm run sample-data:kafka

# Stream continuously (20 events/topic every 10 seconds)
npm run sample-data:kafka:stream

# Advanced usage
python scripts/sample-data/generate_kafka_events.py \
  --stream --count 100 --delay 5 --topics user-activities,search-events

# Generate to file without Redpanda
python scripts/sample-data/generate_kafka_events.py \
  --count 100 --stdout-only --output sample-events.jsonl
```

### ML Pipeline Data

```bash
# Initialize Redis FeatureStore + pgvector embeddings
python scripts/sample-data/init_ml_pipeline_data.py

# Redis only
python scripts/sample-data/init_ml_pipeline_data.py --redis-only

# pgvector only
python scripts/sample-data/init_ml_pipeline_data.py --pgvector-only

# With custom connection URLs
python scripts/sample-data/init_ml_pipeline_data.py \
  --redis-url redis://my-redis:6379 \
  --vector-db-url postgresql://user:pass@host:5432/vector_db
```

## Architecture

### Data Flow

```
sample-data-constants.ts (single source of truth for all IDs)
    │
    ├──> auth-service/seed.ts     → auth_db (25 users)
    ├──> user-service/seed.ts     → user_db (25 profiles + 500 activities)
    ├──> vendor-service/seed.ts   → vendor_db (8 vendors + 16 venues + 500+ slots)
    ├──> event-service/seed.ts    → event_db (40 events)
    └──> booking-service/seed.ts  → booking_db (20 bookings + 20 payments)
    
master-seed.ts (orchestrates all seeds in dependency order)

generate_kafka_events.py → Redpanda (6 topics) → Python workers → Redis + pgvector
init_ml_pipeline_data.py → Redis FeatureStore + pgvector embeddings
```

### Cross-Service References

All IDs are deterministic and shared across services:
- `user-001` through `user-025` — user IDs
- `vendor-001` through `vendor-008` — vendor IDs
- `venue-001` through `venue-016` — venue IDs (linked to vendors)
- `event-001` through `event-040` — event IDs (linked to vendors + venues)
- `booking-001` through `booking-020` — booking IDs (linked to users + events + vendors)

### Service Dependency Order

1. **auth-service** — Users must exist first (no dependencies)
2. **user-service** — User profiles mirror auth users (no DB FK, logical dependency on auth)
3. **vendor-service** — Vendors reference user IDs, venues reference vendor IDs
4. **event-service** — Events reference vendor IDs and venue IDs
5. **booking-service** — Bookings reference user, event, and vendor IDs

## ML Pipeline Testing

After seeding all data, you can test the full ML pipeline:

```bash
# 1. Ensure Redpanda is running (comes with dev:infra)
# 2. Start streaming events
npm run sample-data:kafka:stream

# 3. In another terminal, start the Python workers
cd apps/python-workers
python -m kafka-consumers.user_activity

# 4. Start the inference API
uvicorn inference.api:app --port 8000 --reload

# 5. Test recommendations
curl "http://localhost:8000/recommendations?user_id=user-009&category=MUSIC&limit=10"

# 6. Test similar events
curl "http://localhost:8000/similar-events/event-001"

# 7. Test search personalization
curl -X POST "http://localhost:8000/search/personalize" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-009", "results": [...]}'

# 8. Run batch ML training
python -m ml-training.data_pipeline --mode full
```

## Resetting Data

```bash
# To reset and re-seed everything:
npm run sample-data:docker:migrate

# To clear specific service data, use the seed script (it clears before inserting):
npm run db:seed:auth
npm run db:seed:event
```
