#!/usr/bin/env bash
# Generate SealedSecret YAML from plain secret files.
#
# Prerequisites:
#   - kubeseal installed: https://github.com/bitnami-labs/sealed-secrets
#   - Sealed Secrets controller installed in the cluster
#
# Usage:
#   ./tools/secrets/generate-sealed-secrets.sh <namespace>
#
# This reads plain secret YAML from kubernetes/base/secrets/ and outputs
# encrypted SealedSecret YAML for safe Git storage.
#
# Output goes to: kubernetes/overlays/<namespace>/secrets/

set -euo pipefail

NAMESPACE="${1:-production}"
BASE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS_DIR="$BASE_DIR/kubernetes/base/secrets"
OUTPUT_DIR="$BASE_DIR/kubernetes/overlays/$NAMESPACE/secrets"

mkdir -p "$OUTPUT_DIR"

echo "==> Generating SealedSecrets for namespace: $NAMESPACE"

for secret_file in "$SECRETS_DIR"/*.yaml; do
  filename=$(basename "$secret_file")
  output_file="$OUTPUT_DIR/sealed-${filename}"

  echo "  $filename -> sealed-${filename}"

  kubeseal \
    --format=yaml \
    --namespace="$NAMESPACE" \
    --controller-name=sealed-secrets \
    --controller-namespace=kube-system \
    < "$secret_file" \
    > "$output_file"
done

echo "==> Done. Sealed secrets written to: $OUTPUT_DIR"
echo ""
echo "Add to kustomization.yaml resources:"
for f in "$OUTPUT_DIR"/*.yaml; do
  echo "  - secrets/$(basename "$f")"
done
