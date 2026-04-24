#!/usr/bin/env bash
# Install Strimzi (Kafka) and ECK (Elasticsearch) operators.
# Run this once per cluster before deploying the platform.
#
# Usage:
#   ./tools/scripts/install-operators.sh
#
# Prerequisites:
#   - kubectl configured with cluster access
#   - Helm 3 installed

set -euo pipefail

echo "==> Installing Strimzi Kafka Operator..."

# Add Strimzi Helm repo
helm repo add strimzi https://strimzi.io/charts/ 2>/dev/null || true
helm repo update

# Install Strimzi operator
helm upgrade --install strimzi-kafka-operator strimzi/strimzi-kafka-operator \
  --namespace strimzi-system \
  --create-namespace \
  --set watchAnyNamespace=true \
  --wait

echo "==> Strimzi operator ready."

echo "==> Installing ECK (Elastic Cloud on Kubernetes) Operator..."

# Add Elastic Helm repo
helm repo add elastic https://helm.elastic.co 2>/dev/null || true
helm repo update

# Install ECK operator
helm upgrade --install elastic-operator elastic/eck-operator \
  --namespace elastic-system \
  --create-namespace \
  --wait

echo "==> ECK operator ready."
echo "==> All operators installed."

echo ""
echo "Next steps:"
echo "  1. Create Kafka cluster:    ./tools/scripts/create-kafka-cluster.sh"
echo "  2. Create Elasticsearch:    ./tools/scripts/create-es-cluster.sh"
