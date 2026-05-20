#!/usr/bin/env bash
# Install ECK (Elasticsearch) operator.
# Run this once per cluster before deploying the platform.
#
# Usage:
#   ./tools/scripts/install-operators.sh
#
# Prerequisites:
#   - kubectl configured with cluster access
#   - Helm 3 installed

set -euo pipefail

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
echo "Next step:"
echo "  Create Elasticsearch:    ./tools/scripts/create-es-cluster.sh"
