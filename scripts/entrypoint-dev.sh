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
for i in $(seq 1 20); do
  DB_VAR=$(echo "$SERVICE" | sed 's/-service//' | tr '[:lower:]-' '[:upper:]_')_DATABASE_URL
  eval "DB_URL=\${$DB_VAR:-\${DATABASE_URL:-}}"
  if [ -z "$DB_URL" ]; then
    echo "[$SERVICE] No DATABASE_URL found, skipping DB wait."
    break
  fi
  if node -e "const{Client}=require('pg');new Client({connectionString:'$DB_URL',connectionTimeoutMillis:3000}).connect().then(()=>{console.log('ok');process.exit(0)}).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "[$SERVICE] PostgreSQL ready."
    break
  fi
  echo "[$SERVICE] Waiting for PostgreSQL ($i/20)..."
  sleep 2
done

# Create pgvector extension for agent-service
if [ "$SERVICE" = "agent-service" ]; then
  echo "[agent-service] Creating pgvector extension (retry up to 5 times)..."
  for i in $(seq 1 5); do
    if node -e "
      const { Client } = require('pg');
      const client = new Client({ connectionString: '$DB_URL', connectionTimeoutMillis: 10000 });
      client.connect()
        .then(() => client.query('CREATE EXTENSION IF NOT EXISTS vector'))
        .then(() => client.query('SELECT extname, extversion FROM pg_extension WHERE extname = \'vector\''))
        .then((res) => {
          if (res.rows.length > 0) {
            console.log('pgvector extension verified: v' + res.rows[0].extversion);
            process.exit(0);
          } else {
            console.error('pgvector extension NOT FOUND after creation attempt!');
            process.exit(1);
          }
        })
        .then(() => client.end())
        .catch((e) => { console.error('pgvector attempt failed:', e.message); process.exit(1); });
    " 2>/dev/null; then
      echo "[agent-service] pgvector extension ready."
      break
    fi
    echo "[agent-service] Retrying pgvector setup ($i/5)..."
    sleep 2
  done || { echo "[agent-service] ERROR: pgvector extension creation failed after retries"; exit 1; }
fi

echo "[$SERVICE] Starting NestJS server..."
cd /app
exec yarn nx run "$SERVICE:serve" --configuration=debug
