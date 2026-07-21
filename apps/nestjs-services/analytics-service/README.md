# Analytics Service — PLANNED

This service is a **stub** and has not been implemented yet.

When built, it will handle:
- User activity tracking and event streaming
- Booking funnel analytics
- Conversion rate monitoring
- Business metrics dashboards
- Kafka integration for real-time event processing

Database `analytics_db` already exists in PostgreSQL. The API Gateway already has
`analytics/` and `tracking/` modules that can be migrated here.

For the implementation checklist, see `AGENTS.md` — "Adding a new NestJS microservice".
