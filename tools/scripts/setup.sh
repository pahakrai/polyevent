#!/bin/bash

set -e

echo "Setting up Event Booking App development environment..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required but not installed. Aborting."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting."; exit 1; }

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Start infrastructure services
echo "Starting infrastructure services with Docker Compose..."
docker-compose up -d postgres mongodb redis zookeeper kafka elasticsearch kibana

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Create Kafka topics
echo "Creating Kafka topics..."

declare -A TOPICS=(
  # Recommendation signal topics
  ["user-activities"]="6"
  ["event-lifecycle"]="6"
  ["booking-events"]="6"
  ["search-events"]="6"
  ["recommendation-feedback"]="6"
  ["location-context"]="6"
  # Operational topics
  ["vendor-events"]="3"
  ["notification-events"]="3"
  ["ml-training"]="3"
)

for topic in "${!TOPICS[@]}"; do
  partitions=${TOPICS[$topic]}
  echo "  Creating topic: $topic (partitions=$partitions, rf=1)"
  docker-compose exec kafka kafka-topics --create \
    --topic "$topic" \
    --partitions "$partitions" \
    --replication-factor 1 \
    --bootstrap-server localhost:9092 || true
done

# Create Elasticsearch indices
echo "Creating Elasticsearch indices..."
curl -X PUT "http://localhost:9200/events" -H 'Content-Type: application/json' -d @libs/elasticsearch-client/src/indices/event.index.json || true

echo "Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run start' to start all applications"
echo "2. Access frontend at http://localhost:3002"
echo "3. Access API Gateway at http://localhost:3000"
echo "4. Access Kibana at http://localhost:5601"