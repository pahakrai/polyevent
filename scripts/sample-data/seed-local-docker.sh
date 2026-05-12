#!/usr/bin/env bash
# ============================================================
# Run Migrations for All Databases in Local Docker PostgreSQL
# ============================================================
# Sample data is now included in 0001_sample_data.sql migration files.
# Running migrations seeds the database automatically.
#
# Prerequisites: npm run dev:infra (running PostgreSQL on localhost:5432)
#
# Usage:
#   bash scripts/sample-data/seed-local-docker.sh           # All services
#   bash scripts/sample-data/seed-local-docker.sh auth      # Auth only
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
ok()   { echo -e "${GREEN}[OK]${NC}    $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail() { echo -e "${RED}[FAIL]${NC}  $1"; }

SERVICE_FILTER=""

for arg in "$@"; do
    case "$arg" in
        auth|user|vendor|event|booking) SERVICE_FILTER="$arg" ;;
    esac
done

echo ""
echo "=============================================="
echo "  Polydom — Local Docker Database Migration"
echo "=============================================="
echo ""

# Check if PostgreSQL is running
if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "postgres"; then
    warn "PostgreSQL container not found. Starting infra..."
    npm run dev:infra
    log "Waiting for PostgreSQL to be ready..."
    sleep 5
fi

ALL_SERVICES=("auth" "user" "vendor" "event" "booking")

SERVICES=()
if [ -n "$SERVICE_FILTER" ]; then
    SERVICES=("$SERVICE_FILTER")
else
    SERVICES=("${ALL_SERVICES[@]}")
fi

log "Target services: ${SERVICES[*]}"
log "Running migrations (schema + sample data)..."
echo ""

for svc in "${SERVICES[@]}"; do
    log "Migrating $svc-service..."
    npm run "db:migrate:$svc" 2>&1 | sed 's/^/    /' || {
        fail "Migration failed for $svc-service"
        exit 1
    }
    ok "  $svc-service migrated"
done

echo ""
echo "=============================================="
log "Migration Summary:"
echo "  • 25 users (3 admins, 5 vendors, 17 regular)"
echo "  • 8 vendors (MUSIC, ART, SPORTS, ACTIVITIES)"
echo "  • 16 venues with varied capacities"
echo "  • 40 events across all categories"
echo "  • 20 bookings with payments"
echo "  • 500+ user activities for ML training"
echo ""
ok "All databases migrated and seeded successfully!"
echo ""
echo "Login credentials:"
echo "  Superadmin: pahakadmin@polydom.io / Three1288"
echo "  Admin:      admin@example.com      / admin123"
echo "  User:       user@example.com       / user123"
echo "  Vendor:     vendor@example.com     / vendor123"
echo ""
echo "Next steps:"
echo "  - Start services:   npm run dev"
echo "  - Or K8s mode:      npm run skaffold:dev"
echo "  - Generate ML data: python scripts/sample-data/generate_kafka_events.py --stream"
echo ""
