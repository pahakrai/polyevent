#!/usr/bin/env bash
# ============================================================
# Truncate all table data across all service databases
# Keeps schemas, extensions, and database structure intact.
#
# Usage:
#   bash scripts/db-reset.sh docker              # Docker: truncate only
#   bash scripts/db-reset.sh docker --migrate    # Docker: truncate + re-migrate
#   bash scripts/db-reset.sh k8s                 # K8s: truncate only
#   bash scripts/db-reset.sh k8s --migrate       # K8s: truncate + re-migrate
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
ok()   { echo -e "${GREEN}[OK]${NC}    $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail() { echo -e "${RED}[FAIL]${NC}  $1"; }

TRUNCATE_SQL="tools/postgres-init/03-truncate-tables.sql"
ALL_SERVICES=("auth" "user" "vendor" "event" "booking" "agent")
MODE="${1:-}"
MIGRATE=false

for arg in "$@"; do
    case "$arg" in
        --migrate) MIGRATE=true ;;
    esac
done

if [ "$MODE" != "docker" ] && [ "$MODE" != "k8s" ]; then
    echo "Usage: db-reset.sh <docker|k8s> [--migrate]"
    exit 1
fi

echo ""
echo "=============================================="
echo "  Polydom — Truncate All Table Data"
echo "  Mode: $MODE | Migrate: $MIGRATE"
echo "=============================================="
echo ""

if [ ! -f "$TRUNCATE_SQL" ]; then
    fail "Truncate SQL not found: $TRUNCATE_SQL"
    exit 1
fi

if [ "$MODE" = "docker" ]; then
    # Check if postgres container is running
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "postgres"; then
        fail "PostgreSQL container not running. Start it with: npm run dev:infra"
        exit 1
    fi

    warn "This will DELETE ALL DATA in all service databases."
    warn "Press Ctrl+C within 5 seconds to cancel..."
    sleep 5

    log "Truncating all tables in Docker PostgreSQL..."
    docker exec -i polydom-postgres-1 psql -U eventbooking -d eventbooking < "$TRUNCATE_SQL"
    ok "All table data truncated (Docker)"

    if [ "$MIGRATE" = true ]; then
        log "Re-running migrations to re-populate sample data..."
        for svc in "${ALL_SERVICES[@]}"; do
            log "  Migrating $svc-service..."
            npm run "db:migrate:$svc" 2>&1 | sed 's/^/    /' || warn "Migration for $svc-service failed"
        done
        ok "Migrations complete — sample data re-populated"
    fi

elif [ "$MODE" = "k8s" ]; then
    NAMESPACE="${NAMESPACE:-polydom-dev}"
    POSTGRES_POD=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -z "$POSTGRES_POD" ]; then
        fail "PostgreSQL pod not found in namespace '$NAMESPACE'. Is Skaffold running?"
        exit 1
    fi

    warn "This will DELETE ALL DATA in all service databases."
    warn "Press Ctrl+C within 5 seconds to cancel..."
    sleep 5

    log "Truncating all tables in K8s PostgreSQL..."
    kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- psql -U postgres -d postgres < "$TRUNCATE_SQL"
    ok "All table data truncated (K8s)"

    if [ "$MIGRATE" = true ]; then
        log "Re-running migrations to re-populate sample data..."
        for svc in "${ALL_SERVICES[@]}"; do
            log "  Migrating $svc-service..."
            npm run "db:migrate:$svc" 2>&1 | sed 's/^/    /' || warn "Migration for $svc-service failed"
        done
        ok "Migrations complete — sample data re-populated"
    fi
fi

echo ""
echo "=============================================="
ok "Done. All table data cleared."
echo ""
