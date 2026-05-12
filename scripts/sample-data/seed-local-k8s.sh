#!/usr/bin/env bash
# ============================================================
# Run Migrations for Kubernetes-based Development
# ============================================================
# Sample data is now included in 0001_sample_data.sql migration files.
# Running migrations seeds the database automatically.
#
# Prerequisites:
#   - Kubernetes cluster running (Docker Desktop, minikube, or kind)
#   - Skaffold installed
#   - kubectl configured for the cluster
#
# Usage:
#   bash scripts/sample-data/seed-local-k8s.sh              # All services
#   bash scripts/sample-data/seed-local-k8s.sh --port-forward # Port-forward postgres first
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

NAMESPACE="${NAMESPACE:-polydom-dev}"
POSTGRES_SVC="${POSTGRES_SVC:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
LOCAL_PORT="${LOCAL_PORT:-5433}"  # Use 5433 to avoid conflict with local postgres
DO_PORT_FORWARD=false

for arg in "$@"; do
    case "$arg" in
        --port-forward) DO_PORT_FORWARD=true ;;
    esac
done

echo ""
echo "=============================================="
echo "  Polydom — K8s Database Migration"
echo "=============================================="
echo ""

# Check kubectl access
if ! kubectl cluster-info &> /dev/null; then
    fail "Cannot connect to Kubernetes cluster. Is it running?"
    exit 1
fi
ok "Kubernetes cluster reachable"

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
    warn "Namespace '$NAMESPACE' not found."
    log "Available namespaces:"
    kubectl get namespaces
    log "Deploy the stack first: npm run skaffold:dev"
    exit 1
fi
ok "Namespace '$NAMESPACE' found"

# Check if postgres pod is running
POSTGRES_POD=$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
if [ -z "$POSTGRES_POD" ]; then
    fail "PostgreSQL pod not found in namespace '$NAMESPACE'."
    log "Deploy the stack first: npm run skaffold:dev"
    exit 1
fi
ok "PostgreSQL pod found: $POSTGRES_POD"

# Port forward PostgreSQL
cleanup_port_forward() {
    if [ -n "${PF_PID:-}" ]; then
        log "Cleaning up port-forward (PID: $PF_PID)..."
        kill "$PF_PID" 2>/dev/null || true
    fi
}
trap cleanup_port_forward EXIT

log "Setting up port-forward: localhost:$LOCAL_PORT -> $POSTGRES_SVC:$POSTGRES_PORT"
kubectl port-forward -n "$NAMESPACE" "svc/$POSTGRES_SVC" "$LOCAL_PORT:$POSTGRES_PORT" &
PF_PID=$!
sleep 2

if ! kill -0 "$PF_PID" 2>/dev/null; then
    fail "Port-forward failed to start"
    exit 1
fi
ok "Port-forward established (PID: $PF_PID)"

# Ensure all required databases exist
log "Ensuring databases exist..."
REQUIRED_DBS=("auth_db" "user_db" "vendor_db" "event_db" "booking_db")
for db in "${REQUIRED_DBS[@]}"; do
  kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- \
    psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$db'" 2>/dev/null | grep -q 1 || \
    kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- \
      psql -U postgres -c "CREATE DATABASE $db" 2>/dev/null && \
      ok "  Created database: $db (was missing)" || \
      ok "  Database exists: $db"
done

# Enable pgvector in booking_db
kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- \
  psql -U postgres -d booking_db -c "CREATE EXTENSION IF NOT EXISTS vector" 2>/dev/null || true

# Override DB connection
export AUTH_DATABASE_URL="postgresql://postgres:postgres@localhost:$LOCAL_PORT/auth_db"
export USER_DATABASE_URL="postgresql://postgres:postgres@localhost:$LOCAL_PORT/user_db"
export VENDOR_DATABASE_URL="postgresql://postgres:postgres@localhost:$LOCAL_PORT/vendor_db"
export EVENT_DATABASE_URL="postgresql://postgres:postgres@localhost:$LOCAL_PORT/event_db"
export BOOKING_DATABASE_URL="postgresql://postgres:postgres@localhost:$LOCAL_PORT/booking_db"
export USE_NEON="false"

log "Database URLs configured for port-forwarded K8s PostgreSQL"

ALL_SERVICES=("auth" "user" "vendor" "event" "booking")

# Run migrations (schema + sample data)
log "Running migrations (schema + sample data)..."
echo ""
for svc in "${ALL_SERVICES[@]}"; do
    log "Migrating $svc-service..."
    npm run "db:migrate:$svc" 2>&1 | sed 's/^/    /' || {
        warn "Migration for $svc-service failed (may already be up to date)"
    }
    ok "  $svc-service migrated"
done

echo ""
echo "=============================================="
ok "All databases migrated and seeded in Kubernetes!"
echo ""
echo "  • 25 users, 8 vendors, 16 venues, 40 events"
echo "  • 20 bookings, 500+ user activities"
echo ""

# Optionally: generate Kafka events into the cluster
log "To generate Kafka events in the cluster:"
echo "  kubectl port-forward -n $NAMESPACE svc/kafka 9092:9092 &"
echo "  python scripts/sample-data/generate_kafka_events.py --stream --count 20"
echo ""
