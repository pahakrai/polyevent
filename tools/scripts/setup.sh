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
docker-compose exec kafka kafka-topics --create --topic user-activities --partitions 3 --replication-factor 1 --bootstrap-server localhost:9092 || true
docker-compose exec kafka kafka-topics --create --topic booking-events --partitions 3 --replication-factor 1 --bootstrap-server localhost:9092 || true
docker-compose exec kafka kafka-topics --create --topic vendor-events --partitions 3 --replication-factor 1 --bootstrap-server localhost:9092 || true

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