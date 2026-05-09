#!/bin/sh
set -e

SERVICE="$1"
if [ -z "$SERVICE" ]; then
  echo "Usage: entrypoint-dev.sh <service-name>"
  exit 1
fi

echo "=== $SERVICE: Starting (development mode) ==="

# Wait for PostgreSQL to be ready
echo "[$SERVICE] Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  DB_VAR=$(echo "$SERVICE" | sed 's/-service//' | tr '[:lower:]' '[:upper:]')_DATABASE_URL
  eval "DB_URL=\${$DB_VAR:-\${DATABASE_URL:-}}"
  if [ -z "$DB_URL" ]; then
    echo "[$SERVICE] No DATABASE_URL found, skipping DB wait."
    break
  fi
  if node -e "const{Client}=require('pg');new Client({connectionString:'$DB_URL',connectionTimeoutMillis:3000}).connect().then(()=>{console.log('ok');process.exit(0)}).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "[$SERVICE] PostgreSQL ready."
    break
  fi
  echo "[$SERVICE] Waiting for PostgreSQL ($i/30)..."
  sleep 2
done

# Create pgvector extension for agent-service before migration
if [ "$SERVICE" = "agent-service" ]; then
  echo "[agent-service] Creating pgvector extension..."
  node -e "
    const { Client } = require('pg');
    const client = new Client({ connectionString: '$DB_URL', connectionTimeoutMillis: 10000 });
    client.connect()
      .then(() => client.query('CREATE EXTENSION IF NOT EXISTS vector'))
      .then(() => client.query('SELECT extname, extversion FROM pg_extension WHERE extname = \'vector\''))
      .then((res) => {
        if (res.rows.length > 0) {
          console.log('pgvector extension verified: v' + res.rows[0].extversion);
        } else {
          console.error('pgvector extension NOT FOUND after creation attempt!');
          process.exit(1);
        }
      })
      .then(() => client.end())
      .catch((e) => { console.error('pgvector setup error:', e.message); process.exit(1); });
  " || { echo "[agent-service] ERROR: pgvector extension creation failed"; exit 1; }
fi

# Run migrations
MIGRATIONS_DIR="/app/apps/nestjs-services/$SERVICE/src/database/migrations"
if [ -d "$MIGRATIONS_DIR" ] && ls "$MIGRATIONS_DIR"/*.sql >/dev/null 2>&1; then
  echo "[$SERVICE] Running database migrations..."
  (cd "/app/apps/nestjs-services/$SERVICE" && npx drizzle-kit migrate --config=src/database/drizzle.config.ts)
  echo "[$SERVICE] Migrations complete."

  # Seed auth database
  if [ "$SERVICE" = "auth-service" ]; then
    echo "[auth-service] Seeding database..."
    (cd /app && npx tsx apps/nestjs-services/auth-service/src/database/seed.ts) || \
      echo "[auth-service] Seed skipped (non-fatal)"
  fi
else
  echo "[$SERVICE] No SQL migrations found, skipping."
fi

echo "[$SERVICE] Starting NestJS server..."
cd /app
exec npx nx run "$SERVICE:serve" --configuration=debug
